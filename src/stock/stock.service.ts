import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
import { UpdateStockTransactionDto } from './dto/update-stock-transaction.dto';
import { StockTransaction, Prisma, StockTransactionType } from '@prisma/client';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) { }

  async createTransaction(
    data: CreateStockTransactionDto,
  ): Promise<StockTransaction> {
    // Validate quantity is not zero
    if (data.quantity === 0) {
      throw new BadRequestException('Quantity cannot be zero');
    }

    // Validate product exists
    const product = await this.prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // For OUT/SALE transactions, check stock availability and prevent negative stock
    if (data.transactionType === StockTransactionType.OUT ||
      data.transactionType === StockTransactionType.SALE) {
      const currentStock = await this.getCurrentStock(data.productId);
      if (currentStock < Math.abs(data.quantity)) {
        throw new BadRequestException(
          `Insufficient stock. Current stock: ${currentStock}, requested: ${Math.abs(data.quantity)}`
        );
      }
    }

    // Validate referenceId exists if referenceType provided
    if (data.referenceType && data.referenceId) {
      // Validate quotation exists if referenceType is 'quotation'
      if (data.referenceType === 'quotation') {
        const quotation = await this.prisma.quotation.findUnique({
          where: { id: data.referenceId },
        });
        if (!quotation) {
          throw new NotFoundException('Referenced quotation not found');
        }
      }
    }

    const transaction = await this.prisma.stockTransaction.create({
      data: {
        ...data,
        date: new Date(data.date),
      },
      include: {
        product: {
          select: { id: true, name: true, modelNumber: true },
        },
      },
    });

    // Update product stock synchronously
    const stockResult = await this.prisma.stockTransaction.aggregate({
      where: { productId: data.productId },
      _sum: { quantity: true },
    });
    const currentStock = stockResult._sum.quantity || 0;
    await this.prisma.product.update({
      where: { id: data.productId },
      data: { todaysStock: currentStock },
    });

    return transaction;
  }

  async findAll(
    productId?: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      transactionType?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ data: StockTransaction[]; total: number }> {
    // Build date filter - handle cases where only startDate or only endDate is provided
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (filters?.startDate) {
      dateFilter.gte = new Date(filters.startDate);
    }
    if (filters?.endDate) {
      // If date is in YYYY-MM-DD format, append time to get end of day
      const endDateStr = filters.endDate.includes('T')
        ? filters.endDate
        : `${filters.endDate}T23:59:59.999Z`;
      dateFilter.lte = new Date(endDateStr);
    }

    const where: Prisma.StockTransactionWhereInput = {
      ...(productId && { productId }),
      ...((filters?.startDate || filters?.endDate) && {
        date: dateFilter,
      }),
      ...(filters?.transactionType && {
        transactionType: filters.transactionType as any,
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.stockTransaction.findMany({
        where,
        skip: (filters?.page || 0) * (filters?.limit || 50),
        take: filters?.limit || 50,
        orderBy: { date: 'desc' },
        include: {
          product: {
            select: { id: true, name: true, modelNumber: true },
          },
        },
      }),
      this.prisma.stockTransaction.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string): Promise<StockTransaction | null> {
    return this.prisma.stockTransaction.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });
  }

  async getCurrentStock(productId: string): Promise<number> {
    // First try to get from product.todaysStock (faster, already maintained)
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { todaysStock: true },
    });

    if (product?.todaysStock !== null && product?.todaysStock !== undefined) {
      return product.todaysStock;
    }

    // Fallback to aggregation if todaysStock is not set
    const result = await this.prisma.stockTransaction.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });
    const currentStock = result._sum.quantity || 0;

    // Update product's todaysStock for future queries
    await this.prisma.product.update({
      where: { id: productId },
      data: { todaysStock: currentStock },
    });

    return currentStock;
  }

  /**
   * Calculate stock level for a specific date based on transactions
   * This is used for event-based stock calculation - stock = SUM(IN) - SUM(OUT)
   */
  async getStockOnDate(productId: string, date: string): Promise<number> {
    // Get all transactions up to and including the specified date
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999); // End of day

    const result = await this.prisma.stockTransaction.aggregate({
      where: {
        productId,
        date: {
          lte: endDate,
        },
      },
      _sum: { quantity: true },
    });

    return result._sum.quantity || 0;
  }

  async getStockHistory(
    productId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<StockTransaction[]> {
    const where: Prisma.StockTransactionWhereInput = {
      productId,
      ...(startDate &&
        endDate && {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    };

    return this.prisma.stockTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        product: {
          select: { id: true, name: true, modelNumber: true },
        },
      },
    });
  }

  async update(
    id: string,
    data: UpdateStockTransactionDto,
  ): Promise<StockTransaction> {
    // Get the transaction to find productId
    const transaction = await this.prisma.stockTransaction.findUnique({
      where: { id },
      select: { productId: true },
    });

    if (!transaction) {
      throw new NotFoundException('Stock transaction not found');
    }

    const updated = await this.prisma.stockTransaction.update({
      where: { id },
      data: {
        ...data,
        ...(data.date && { date: new Date(data.date) }),
      },
    });

    // Update product stock synchronously
    const stockResult = await this.prisma.stockTransaction.aggregate({
      where: { productId: transaction.productId },
      _sum: { quantity: true },
    });
    const currentStock = stockResult._sum.quantity || 0;
    await this.prisma.product.update({
      where: { id: transaction.productId },
      data: { todaysStock: currentStock },
    });

    return updated;
  }

  async remove(id: string): Promise<StockTransaction> {
    // Get the transaction to find productId before deletion
    const transaction = await this.prisma.stockTransaction.findUnique({
      where: { id },
      select: { productId: true },
    });

    if (!transaction) {
      throw new NotFoundException('Stock transaction not found');
    }

    const deleted = await this.prisma.stockTransaction.delete({
      where: { id },
    });

    // Update product stock synchronously
    const stockResult = await this.prisma.stockTransaction.aggregate({
      where: { productId: transaction.productId },
      _sum: { quantity: true },
    });
    const currentStock = stockResult._sum.quantity || 0;
    await this.prisma.product.update({
      where: { id: transaction.productId },
      data: { todaysStock: currentStock },
    });

    return deleted;
  }

  async getLowStockProducts(
    threshold: number = 10,
  ): Promise<any[]> {
    // Get all products
    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        modelNumber: true,
        todaysStock: true,
        categoryId: true,
        price: true,
        productType: true,
        seriesName: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Calculate stock for all products in a single query using groupBy
    const stockAggregations = await this.prisma.stockTransaction.groupBy({
      by: ['productId'],
      where: {
        productId: { in: products.map((p) => p.id) },
      },
      _sum: {
        quantity: true,
      },
    });

    // Create a map of productId -> currentStock
    const stockMap = new Map<string, number>();
    stockAggregations.forEach((agg) => {
      stockMap.set(agg.productId, agg._sum.quantity || 0);
    });

    // Combine products with their stock values
    const productsWithStock = products.map((product) => {
      const currentStock = stockMap.get(product.id) || product.todaysStock || 0;
      return {
        ...product,
        currentStock,
      };
    });

    // Filter low stock products
    return productsWithStock.filter((p) => p.currentStock <= threshold);
  }

  /**
   * Calculate stock after orders (bookings) on a specific date
   * This subtracts confirmed booking allocations from base stock
   */
  async getStockAfterOrderOnDate(
    productId: string,
    date: string,
  ): Promise<number> {
    // Get base stock on date
    const baseStock = await this.getStockOnDate(productId, date);

    // TODO: Get bookings when Booking model is added to schema
    // For now, return base stock without booking allocation
    // const bookings = await this.prisma.booking.findMany({
    //   where: {
    //     productId,
    //     dispatchDate: {
    //       lte: new Date(date),
    //     },
    //   },
    //   orderBy: [
    //     { dispatchDate: 'asc' },
    //     { bookedOn: 'asc' },
    //   ],
    // });

    // Simulate allocation: subtract confirmed booking quantities from stock
    // let availableStock = baseStock;
    // for (const booking of bookings) {
    //   if (availableStock >= booking.requiredQuantity) {
    //     availableStock -= booking.requiredQuantity;
    //   } else if (availableStock > 0) {
    //     availableStock = 0;
    //     break;
    //   } else {
    //     break;
    //   }
    // }

    return baseStock;
  }

  /**
   * Get next incoming stock information (from transactions or bookings)
   * Returns the earliest incoming stock date and quantity
   */
  async getNextInInfo(
    productId: string,
  ): Promise<{ date: string | null; quantity: number | null }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find next IN or PURCHASE transaction
    const nextTransaction = await this.prisma.stockTransaction.findFirst({
      where: {
        productId,
        transactionType: {
          in: ['IN', 'PURCHASE'],
        },
        date: {
          gt: today,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // TODO: Find next booking when Booking model is added to schema
    // const nextBooking = await this.prisma.booking.findFirst({
    //   where: {
    //     productId,
    //     dispatchDate: {
    //       gt: today,
    //     },
    //   },
    //   orderBy: [
    //     { dispatchDate: 'asc' },
    //     { bookedOn: 'asc' },
    //   ],
    // });

    // Compare and return the earliest date
    // if (nextTransaction && nextBooking) {
    //   const transactionDate = new Date(nextTransaction.date);
    //   const bookingDate = new Date(nextBooking.dispatchDate);
    //   if (transactionDate <= bookingDate) {
    //     return {
    //       date: transactionDate.toISOString().split('T')[0],
    //       quantity: nextTransaction.quantity,
    //     };
    //   } else {
    //     return {
    //       date: transactionDate.toISOString().split('T')[0],
    //       quantity: nextTransaction.quantity,
    //     };
    //   }
    // } else 
    if (nextTransaction) {
      return {
        date: new Date(nextTransaction.date).toISOString().split('T')[0],
        quantity: nextTransaction.quantity,
      };
    }
    // else if (nextBooking) {
    //   return {
    //     date: null,
    //     quantity: null,
    //   };
    // }

    return {
      date: null,
      quantity: null,
    };
  }

  /**
   * Get comprehensive stock projection data for a product
   * Includes base stock, after-order stock, next IN info, and product relationships
   * Implements Anchored Balance Logic: Start from Current Stock and simulate forward
   */
  async getStockProjection(
    productId: string,
    selectedDate: string,
  ): Promise<any> {
    // 1. Get product current stock and relationships
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        todaysStock: true,
        cousinMachine: true,
        orderTogether: true,
        swapMachine: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const currentStock = product.todaysStock || 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 2. Fetch ALL future transactions from Today onwards
    // We need to simulate the running balance starting from 'currentStock' (which is EOD today)
    const futureTransactions = await this.prisma.stockTransaction.findMany({
      where: {
        productId,
        date: {
          gt: today, // Strictly greater than today (tomorrow onwards)
        },
      },
      orderBy: { date: 'asc' }, // Order by date ascending to simulate timeline
    });

    // 3. Helper to find Min Balance in a date range
    // We simulate the ledger: 
    // - Start with `currentBalance` = `currentStock` (Today's EOD)
    // - Iterate day by day (or transaction by transaction) forward
    // - Track the Minimum Balance seen in the window of interest

    const calculateMinBalance = (startDateStr: string, endDateStr: string): number => {
      const startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0); // Normalize

      const endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999); // End of day

      let runningBalance = currentStock;
      let minBalance = Infinity;

      // If startDate is in the past relative to today, we default to currentStock or handle differently
      // Ideally, the "Available to Promise" is forward looking.
      // If selectedDate is Today, we start min check from Today.
      // Since `currentStock` IS Today's EOD balance, the first check is just `currentStock`.

      // If the start date is today or past, initial min is currentStock
      if (startDate <= today) {
        minBalance = runningBalance;
      }

      // Iterate through future transactions
      // We need to check balance AFTER each transaction date
      // Note: Ledger logic sums NET change per day.

      // Group future transactions by Date for daily processing
      const dailyChanges = new Map<string, number>();
      futureTransactions.forEach(tx => {
        const d = tx.date.toISOString().split('T')[0];
        const change = tx.transactionType === 'IN' ? tx.quantity : -tx.quantity;
        dailyChanges.set(d, (dailyChanges.get(d) || 0) + change);
      });

      // Get all unique dates from transactions + start/end boundaries if needed?
      // Actually, we just need to iterate through the sorted transactions.
      // But efficiently: we walk the timeline.

      // "Available to Promise" logic:
      // Minimum running balance from [StartDate, EndDate]

      // 1. If today > StartDate, we need to handle "Backwards" logic? 
      //    No, list view is usually "Future Availability". 
      //    We assume List View asks "If I order on [SelectedDate]..."
      //    So we only care about the timeline from SelectedDate onwards.

      // ALGORITHM:
      // 1. Walk from Today -> Future
      // 2. Update Running Balance
      // 3. If Date >= StartDate AND Date <= EndDate: Track Min Balance

      // Initial state: Today (EOD)
      // If StartDate <= Today, we consider Today's balance as a candidate
      if (startDate <= today) {
        minBalance = Math.min(minBalance, runningBalance);
      }

      // We need to walk potentially 365 days? No, just iterate transactions.
      // BUT periods between transactions also matter (they hold the previous balance).

      // Let's iterate future dates via transactions
      // We must check the balance at the START of the window (if no transactions yet)

      let cursorDate = new Date(today);
      cursorDate.setDate(cursorDate.getDate() + 1); // Start checking from tomorrow

      // We process transactions in order
      for (const tx of futureTransactions) {
        const txDate = new Date(tx.date);
        txDate.setHours(0, 0, 0, 0);

        // Before processing this transaction, key check:
        // If we are currently INSIDE the window [StartDate, EndDate], 
        // the `runningBalance` (which is the balance BEFORE this transaction) is valid for the days between prev tx and this tx.
        // So we verify: if (prevDate...txDate) overlaps with Window, `runningBalance` is a candidate.

        // Simplified approach:
        // Update balance.
        // If txDate >= StartDate, check min.

        const change = tx.transactionType === 'IN' ? tx.quantity : -tx.quantity;
        runningBalance += change;

        if (txDate >= startDate && txDate <= endDate) {
          minBalance = Math.min(minBalance, runningBalance);
        }
      }

      // If we haven't found any transactions in the window, or minBalance is still Infinity (because window started after all transactions)
      // The balance is simply the runningBalance carried forward.
      if (minBalance === Infinity) {
        // If the window is valid (StartDate <= EndDate)
        if (startDate <= endDate) {
          minBalance = runningBalance;
        } else {
          minBalance = 0; // Invalid window?
        }
      }

      // Safety: If StartDate is way in the future beyond all transactions,
      // the loop finished, runningBalance is the final balance.
      // We should check if we ever entered the window.
      // Actually, standard logic:
      // The balance is a step function. We need the minimum value of this step function in the interval.

      // Let's refine:
      // We need the min value of function B(t) for t in [Start, End].
      // Start with `currentBalance` (Today).
      // `min` = Infinity.

      // We scan through all critical points (transaction dates) AND the StartDate.

      // Reset for robust calc
      runningBalance = currentStock;

      // 1. Calculate Balance AT StartDate
      // Walk transactions from Tomorrow until StartDate
      for (const tx of futureTransactions) {
        const txDate = new Date(tx.date);
        txDate.setHours(0, 0, 0, 0);
        if (txDate < startDate) {
          const change = tx.transactionType === 'IN' ? tx.quantity : -tx.quantity;
          runningBalance += change;
        } else {
          break; // Stop at StartDate
        }
      }

      // This is the balance at the beginning of StartDate
      minBalance = runningBalance;

      // 2. Now walk from StartDate to EndDate
      for (const tx of futureTransactions) {
        const txDate = new Date(tx.date);
        txDate.setHours(0, 0, 0, 0);

        if (txDate >= startDate && txDate <= endDate) {
          const change = tx.transactionType === 'IN' ? tx.quantity : -tx.quantity;
          runningBalance += change;
          // Check min after update? Or before?
          // Standard ledger: End of Day balance.
          // So update first, then check.
          minBalance = Math.min(minBalance, runningBalance);
        }
      }

      return minBalance;
    };

    // Dates
    const selectedDateObj = new Date(selectedDate);
    const plus15Date = new Date(selectedDateObj);
    plus15Date.setDate(plus15Date.getDate() + 15);
    const plus30Date = new Date(selectedDateObj);
    plus30Date.setDate(plus30Date.getDate() + 30);
    const plus360Date = new Date(selectedDateObj);
    plus360Date.setDate(plus360Date.getDate() + 360); // 1 Year lookahead

    // Calculate Min Balances ("Stock After Order On")
    // "Stock on Selected Date" = Min Balance from SelectedDate -> +365
    // "Stock + 15" = Min Balance from +15 -> +365
    // "Stock + 30" = Min Balance from +30 -> +365
    // "Stock + 360" = Just the balance at +360? Or Min? Often "Closing Balance"
    // The prompt says "After Order Stock On (Today + 360)". Usually implies projected closing.
    // Let's use simple closing balance for +360, but Min for the availability ones.

    const stockOnSelectedDate = calculateMinBalance(selectedDate, plus360Date.toISOString().split('T')[0]);
    const stockPlus15Days = calculateMinBalance(plus15Date.toISOString().split('T')[0], plus360Date.toISOString().split('T')[0]);
    const stockPlus30Days = calculateMinBalance(plus30Date.toISOString().split('T')[0], plus360Date.toISOString().split('T')[0]);

    // For +360 specifically, maybe just get the final balance?
    // Let's stick to the min behavior for consistency unless "Stock On" implies snapshot.
    // "after order stock on" phrasing usually implies "Available".
    // Let's use calculateMinBalance for consistency.
    const stockPlus360Days = calculateMinBalance(plus360Date.toISOString().split('T')[0], plus360Date.toISOString().split('T')[0]);


    // 4. Next In Date Logic
    // Find first IN transaction > Today
    const nextInTx = futureTransactions.find(tx => tx.transactionType === 'IN');
    const nextInInfo = nextInTx ? {
      date: new Date(nextInTx.date).toISOString().split('T')[0],
      quantity: nextInTx.quantity
    } : { date: null, quantity: null };

    // 5. Determine Status
    // Same logic: If Current < 0 -> Waiting. If +30 Min < 0 -> At Risk.
    let status: 'SAFE' | 'AT RISK' | 'WAITING LIST' = 'SAFE';
    if (currentStock < 0) {
      status = 'WAITING LIST';
    } else if (stockPlus30Days < 0) {
      status = 'AT RISK';
    }

    // 6. Resolve Names
    const resolveProductName = async (modelNumbers: string[] | null): Promise<string | null> => {
      if (!modelNumbers || modelNumbers.length === 0) return null;
      const relatedProducts = await this.prisma.product.findMany({
        where: {
          modelNumber: { in: modelNumbers },
          deletedAt: null,
        },
        select: {
          name: true,
        },
      });
      return relatedProducts.map(p => p.name).join(', ') || null;
    };

    const [cousinMachineName, orderTogetherName, swapMachineName] = await Promise.all([
      resolveProductName(product.cousinMachine),
      resolveProductName(product.orderTogether),
      resolveProductName(product.swapMachine),
    ]);

    return {
      stockOnDate: stockOnSelectedDate, // Mapping to frontend expectation
      stockPlus30Days,
      status,
      // Extended fields
      stockAfterOrderOnDate: stockOnSelectedDate,
      stockAfterOrderPlus15Days: stockPlus15Days,
      stockAfterOrderPlus30Days: stockPlus30Days,
      stockPlus360Days,
      nextInDate: nextInInfo.date,
      nextInQuantity: nextInInfo.quantity,
      cousinMachineName,
      orderTogetherName,
      swapMachineName,
    };
  }
}


