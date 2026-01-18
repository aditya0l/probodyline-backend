import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
    if (
      data.transactionType === StockTransactionType.OUT ||
      data.transactionType === StockTransactionType.SALE
    ) {
      const currentStock = await this.getCurrentStock(data.productId);
      if (currentStock < Math.abs(data.quantity)) {
        throw new BadRequestException(
          `Insufficient stock. Current stock: ${currentStock}, requested: ${Math.abs(data.quantity)}`,
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

    // Determine quantity with correct sign based on transaction type
    let quantity = data.quantity;
    if (
      data.transactionType === StockTransactionType.OUT ||
      data.transactionType === StockTransactionType.SALE
    ) {
      quantity = -Math.abs(data.quantity);
    } else if (
      data.transactionType === StockTransactionType.IN ||
      data.transactionType === StockTransactionType.PURCHASE
    ) {
      quantity = Math.abs(data.quantity);
    }
    // For ADJUSTMENT, we trust the sign provided, or could enforce logic if needed.

    const transaction = await this.prisma.stockTransaction.create({
      data: {
        ...data,
        quantity, // Use the signed quantity
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
    // Get the transaction to find productId and current details
    const transaction = await this.prisma.stockTransaction.findUnique({
      where: { id },
      select: { productId: true, transactionType: true, quantity: true },
    });

    if (!transaction) {
      throw new NotFoundException('Stock transaction not found');
    }

    // Determine quantity with correct sign if quantity or type is changing
    let quantityToSave: number | undefined;

    if (data.quantity !== undefined || data.transactionType !== undefined) {
      const type =
        (data.transactionType as StockTransactionType) ||
        transaction.transactionType;
      const qty =
        data.quantity !== undefined ? data.quantity : transaction.quantity;

      if (
        type === StockTransactionType.OUT ||
        type === StockTransactionType.SALE
      ) {
        quantityToSave = -Math.abs(qty);
      } else if (
        type === StockTransactionType.IN ||
        type === StockTransactionType.PURCHASE
      ) {
        quantityToSave = Math.abs(qty);
      } else {
        quantityToSave = qty;
      }
    }

    const updated = await this.prisma.stockTransaction.update({
      where: { id },
      data: {
        ...data,
        ...(quantityToSave !== undefined && { quantity: quantityToSave }),
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

  async getLowStockProducts(threshold: number = 10): Promise<any[]> {
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
   * Bulk get stock projection for multiple products
   */
  async getBulkProjectedStock(productIds: string[], selectedDate: string) {
    // 1. Get all products with necessary fields
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        todaysStock: true,
      },
    });

    const results = await Promise.all(
      products.map(async (product) => {
        try {
          const projection = await this.getStockProjection(
            product.id,
            selectedDate,
          );
          return {
            productId: product.id,
            ...projection,
            // Map to frontend expected keys if different, but getStockProjection returns extensive data
            stockAtDispatch: projection.stockAfterOrderOnDate,
            stockPlus30: projection.stockAfterOrderPlus30Days,
            currentStock: projection.todaysPhysicalStock,
          };
        } catch (e) {
          return {
            productId: product.id,
            stockAtDispatch: 0,
            stockPlus30: 0,
            currentStock: 0,
            status: 'SAFE',
          };
        }
      }),
    );

    return results;
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

    // Calculate Today's Real Physical Stock (Total - Future Changes)
    let futureSum = 0;
    futureTransactions.forEach((tx) => {
      // Logic: If Sum = Past + Future. Past = Sum - Future.
      // But we need to subract the 'change'.
      // IN adds to stock. OUT subtracts.
      // So FutureNetChange = Sum(IN) - Sum(OUT).
      // TodayStock = CurrentStock - FutureNetChange.
      const change =
        tx.transactionType === 'IN' || tx.transactionType === 'PURCHASE'
          ? tx.quantity
          : tx.transactionType === 'OUT' || tx.transactionType === 'SALE'
            ? -Math.abs(tx.quantity)
            : tx.quantity;
      futureSum += change;
    });

    const todaysPhysicalStock = currentStock - futureSum;

    // 3. Helper to calculate MINIMUM Projected Balance starting from a specific date (Available to Promise)
    // Matches logic in stockDetailClient.tsx (findMinBalance)
    const calculateMinProjectedBalance = (
      startDateStr: string,
      lookAheadDays: number = 365,
    ): number => {
      const startDate = new Date(startDateStr);
      startDate.setHours(23, 59, 59, 999); // Start checking from end of this day

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + lookAheadDays);

      // First, get balance AT the start date
      let currentBalance = todaysPhysicalStock;

      // Advance to start date
      for (const tx of futureTransactions) {
        const txDate = new Date(tx.date);
        if (txDate > startDate) break;

        const change =
          tx.transactionType === 'IN' || tx.transactionType === 'PURCHASE'
            ? tx.quantity
            : tx.transactionType === 'OUT' || tx.transactionType === 'SALE'
              ? -Math.abs(tx.quantity)
              : tx.quantity;

        currentBalance += change;
      }

      // Now scan forward from start date to find min balance
      let minBalance = currentBalance;
      let runningBalance = currentBalance;

      // Find index of first transaction after startDate
      // Optimization: we could track index in previous loop, but this is fine for now
      for (const tx of futureTransactions) {
        const txDate = new Date(tx.date);
        if (txDate <= startDate) continue; // Already processed
        if (txDate > endDate) break; // Outside window

        const change =
          tx.transactionType === 'IN' || tx.transactionType === 'PURCHASE'
            ? tx.quantity
            : tx.transactionType === 'OUT' || tx.transactionType === 'SALE'
              ? -Math.abs(tx.quantity)
              : tx.quantity;

        runningBalance += change;
        if (runningBalance < minBalance) {
          minBalance = runningBalance;
        }
      }

      return minBalance;
    };

    // Helper for Status: Check min balance from TODAY to Today+30
    // Replaced by using calculateMinProjectedBalance(today, 30)
    const minBal30 = calculateMinProjectedBalance(
      today.toISOString().split('T')[0],
      30,
    );

    // Dates
    const selectedDateObj = new Date(selectedDate);
    const plus15Date = new Date(selectedDateObj);
    plus15Date.setDate(plus15Date.getDate() + 15);
    const plus30Date = new Date(selectedDateObj);
    plus30Date.setDate(plus30Date.getDate() + 30);
    const plus360Date = new Date(selectedDateObj);
    plus360Date.setDate(plus360Date.getDate() + 360);

    // Calculate Available Stock (Min Projected)
    const stockOnSelectedDate = calculateMinProjectedBalance(selectedDate);
    const stockPlus15Days = calculateMinProjectedBalance(
      plus15Date.toISOString().split('T')[0],
    );
    const stockPlus30Days = calculateMinProjectedBalance(
      plus30Date.toISOString().split('T')[0],
    );
    const stockPlus360Days = calculateMinProjectedBalance(
      plus360Date.toISOString().split('T')[0],
    );

    // 4. Next In Date Logic
    // Find first IN transaction > Today
    const nextInTx = futureTransactions.find(
      (tx) => tx.transactionType === 'IN' || tx.transactionType === 'PURCHASE',
    );
    const nextInInfo = nextInTx
      ? {
        date: new Date(nextInTx.date).toISOString().split('T')[0],
        quantity: nextInTx.quantity,
      }
      : { date: null, quantity: null };

    // 5. Determine Status
    let status: 'SAFE' | 'AT RISK' | 'WAITING LIST' = 'SAFE';
    // Use Physical Stock for immediate status check
    if (todaysPhysicalStock < 0) {
      status = 'WAITING LIST';
    } else {
      // Check for any dips in the next 30 days
      const minBal30 = calculateMinProjectedBalance(
        today.toISOString().split('T')[0],
        30,
      );
      if (minBal30 < 0) {
        status = 'AT RISK';
      }
    }

    // 6. Resolve Names
    const resolveProductName = async (
      modelNumbers: string[] | null,
    ): Promise<string | null> => {
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
      return relatedProducts.map((p) => p.name).join(', ') || null;
    };

    const [cousinMachineName, orderTogetherName, swapMachineName] =
      await Promise.all([
        resolveProductName(product.cousinMachine),
        resolveProductName(product.orderTogether),
        resolveProductName(product.swapMachine),
      ]);

    return {
      todaysPhysicalStock, // New field for frontend
      stockOnDate: stockOnSelectedDate,
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
