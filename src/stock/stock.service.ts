import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
import { UpdateStockTransactionDto } from './dto/update-stock-transaction.dto';
import { StockTransaction, Prisma, StockTransactionType } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';
import { fromZonedTime } from 'date-fns-tz';
import { calculateFifoAllocation, processStrictFifoLedger } from '../utils/fifo-allocator';

@Injectable()
export class StockService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  private async enrichStockTransactions(data: any[]): Promise<any[]> {
    const dispatchSplitIds = Array.from(new Set(data
      .filter((tx) => (tx.referenceType === 'DISPATCH_SPLIT' || tx.referenceType === 'UNBOOK_SO' || tx.referenceType === 'REVERT_DISPATCH_SPLIT') && tx.referenceId)
      .map((tx) => tx.referenceId as string)));

    const poSplitIds = Array.from(new Set(data
      .filter((tx) => tx.referenceType === 'PURCHASE_ORDER_SPLIT' && tx.referenceId)
      .map((tx) => tx.referenceId as string)));

    const poIds = Array.from(new Set(data
      .filter((tx) => tx.referenceType === 'PURCHASE_ORDER' && tx.referenceId)
      .map((tx) => tx.referenceId as string)));

    const quotationIds = Array.from(new Set(data
      .filter((tx) => (tx.referenceType === 'QUOTATION' || tx.referenceType === 'PI_BOOKING') && tx.referenceId)
      .map((tx) => tx.referenceId as string)));

    const dispatchSplits = dispatchSplitIds.length > 0
      ? await this.prisma.dispatchSplit.findMany({
          where: { id: { in: dispatchSplitIds } },
          include: { 
            salesOrder: { 
              include: { 
                quotation: { include: { customer: true } },
                _count: { select: { splits: true } }
              } 
            } 
          },
        })
      : [];

    const poSplits = poSplitIds.length > 0
      ? await this.prisma.purchaseOrderSplit.findMany({
          where: { id: { in: poSplitIds } },
          include: { purchaseOrder: true },
        })
      : [];

    const pos = poIds.length > 0
      ? await this.prisma.purchaseOrder.findMany({
          where: { id: { in: poIds } },
        })
      : [];

    const quotations = quotationIds.length > 0
      ? await this.prisma.quotation.findMany({
          where: { id: { in: quotationIds } },
          include: { customer: true },
        })
      : [];

    const dispatchSplitMap = new Map(dispatchSplits.map((s) => [s.id, s]));
    const poSplitMap = new Map(poSplits.map((s) => [s.id, s]));
    const poMap = new Map(pos.map((p) => [p.id, p]));
    const quotationMap = new Map(quotations.map((q) => [q.id, q]));

    return data.map((tx) => {
      let extraData: any = {};
      if ((tx.referenceType === 'DISPATCH_SPLIT' || tx.referenceType === 'UNBOOK_SO' || tx.referenceType === 'REVERT_DISPATCH_SPLIT') && tx.referenceId) {
        const split = dispatchSplitMap.get(tx.referenceId);
        if (split) {
          // If pending split is not saved, _count.splits will be less than the highest split number. Use Math.max to correctly infer total columns.
          const totalSplits = Math.max(split.salesOrder?._count?.splits || 0, split.splitNumber);
          const firstLetter = String.fromCharCode(64 + split.splitNumber);
          const secondLetter = String.fromCharCode(64 + totalSplits);
          const splitSuffix = `${firstLetter}/${secondLetter}`;
          const soNumberWithSplit = `${split.salesOrder?.soNumber} ${splitSuffix}`;
          
          extraData = {
            splitNumber: split.splitNumber,
            formattedSplitLabel: splitSuffix,
            splitLabel: split.label,
            orderNumber: soNumberWithSplit,
            customerName: split.salesOrder?.quotation?.clientName || (split.salesOrder?.quotation as any)?.customer?.name,
            gymName: split.salesOrder?.quotation?.gymName,
            bookedOn: split.salesOrder?.quotation?.bookingDate,
            city: split.salesOrder?.quotation?.clientCity,
            stateCode: (split.salesOrder?.quotation as any)?.customer?.stateCode || null,
          };
        }
      } else if (tx.referenceType === 'PURCHASE_ORDER_SPLIT' && tx.referenceId) {
        const split = poSplitMap.get(tx.referenceId);
        if (split) {
          extraData = {
            splitNumber: split.splitNumber,
            splitLabel: split.label,
            orderNumber: split.purchaseOrder?.poNumber,
            supplierName: split.purchaseOrder?.supplierName,
          };
        }
      } else if (tx.referenceType === 'PURCHASE_ORDER' && tx.referenceId) {
        const po = poMap.get(tx.referenceId);
        if (po) {
          extraData = {
            orderNumber: po.poNumber,
            supplierName: po.supplierName,
          };
        }
      } else if ((tx.referenceType === 'QUOTATION' || tx.referenceType === 'PI_BOOKING') && tx.referenceId) {
        const quotation = quotationMap.get(tx.referenceId);
        if (quotation) {
          extraData = {
            customerName: quotation.clientName || (quotation as any).customer?.name || null,
            gymName: quotation.gymName || null,
            orderNumber: quotation.quoteNumber || null,
            bookedOn: quotation.bookingDate || tx.createdAt,
            city: quotation.clientCity || null,
            stateCode: (quotation as any).customer?.stateCode || null,
          };
        }
      }
      return { ...tx, ...extraData };
    });
  }

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
    const currentStock = (stockResult._sum.quantity || 0);
    await this.prisma.product.update({
      where: { id: data.productId },
      data: { todaysStock: currentStock },
    });

    // Broadcast stock update globally
    this.eventsGateway.broadcastEntityUpdate('STOCK', data.productId);

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
  ): Promise<{ data: any[]; total: number }> {
    // Build date filter using date-fns-tz for correct IST parsing
    const dateFilter: { gte?: Date; lte?: Date } = {};
    const timeZone = 'Asia/Kolkata';

    if (filters?.startDate) {
      dateFilter.gte = fromZonedTime(`${filters.startDate}T00:00:00`, timeZone);
    }
    if (filters?.endDate) {
      // If date is in YYYY-MM-DD format, append time to get end of day
      const endDateStr = filters.endDate.includes('T')
        ? filters.endDate
        : `${filters.endDate}T23:59:59.999`;
      dateFilter.lte = fromZonedTime(endDateStr, timeZone);
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

    // Calculate start balance before the requested date range
    let startBalance = 0;
    if (productId && dateFilter.gte) {
      const startBalanceResult = await this.prisma.stockTransaction.aggregate({
        where: {
          productId,
          date: { lt: dateFilter.gte },
        },
        _sum: { quantity: true },
      });
      startBalance = startBalanceResult._sum.quantity || 0;
    }

    const [dataRaw, total] = await Promise.all([
      this.prisma.stockTransaction.findMany({
        where,
        skip: (filters?.page || 0) * (filters?.limit || 10000), // Default high limit for ledger
        take: filters?.limit || 10000,
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }], // Initial fetch order doesn't matter much as we resort in memory
        include: {
          product: {
            select: { id: true, name: true, modelNumber: true },
          },
        },
      }),
      this.prisma.stockTransaction.count({ where }),
    ]);

    // 1. Fetch Quotations to enrich bookedOn date BEFORE sorting
    const quotationIds = Array.from(new Set(dataRaw
      .filter((tx) => tx.referenceType === 'QUOTATION' || tx.referenceType === 'PI_BOOKING')
      .map((tx) => tx.referenceId)
      .filter(Boolean) as string[]));

    let quotationsMap = new Map<string, any>();
    if (quotationIds.length > 0) {
      const quotations = await this.prisma.quotation.findMany({
        where: { id: { in: quotationIds } },
        select: {
          id: true,
          bookingDate: true,
          clientName: true,
          clientCity: true,
          gymName: true,
          quoteNumber: true,
        },
      });
      quotationsMap = new Map(quotations.map((q) => [q.id, q]));
    }

    // 2. Pre-enrich data with bookedOn and other fields
    const preEnrichedData = dataRaw.map((tx) => {
      const enriched = { ...tx } as any;
      
      if (tx.referenceType === 'QUOTATION' || tx.referenceType === 'PI_BOOKING') {
        const quote = quotationsMap.get(tx.referenceId as string);
        if (quote) {
          enriched.bookedOn = quote.bookingDate;
          enriched.customerName = quote.clientName;
          enriched.gymName = quote.gymName;
          enriched.city = quote.clientCity;
          enriched.orderNumber = quote.quoteNumber;
        }
      }
      return enriched;
    });

    // 3. Process strict FIFO simulation
    const resultsAsc = processStrictFifoLedger(preEnrichedData, startBalance);

    // 4. For display, we return strictly ascending (oldest first) to match user requested FIFO display
    const data = resultsAsc;

    // 5. Final enrichment (POs etc)
    const fullyEnrichedData = await this.enrichStockTransactions(data);
    return { data: fullyEnrichedData, total };
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
    const currentStock = (result._sum.quantity || 0);

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

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true }
    });

    return (result._sum.quantity || 0);
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

    const transactions = await this.prisma.stockTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        product: {
          select: { id: true, name: true, modelNumber: true },
        },
      },
    });

    return this.enrichStockTransactions(transactions);
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
    
    const product = await this.prisma.product.findUnique({
      where: { id: transaction.productId },
      select: { id: true }
    });
    
    const currentStock = (stockResult._sum.quantity || 0);
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
    
    const product = await this.prisma.product.findUnique({
      where: { id: transaction.productId },
      select: { id: true }
    });
    
    const currentStock = (stockResult._sum.quantity || 0);
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
        image: true,
        thumbnail: true,
        isDormant: true,
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

    // 2. Fetch ALL transactions from Today (midnight) onwards
    // These are transactions that affect stock from today forward
    const tomorrowMidnight = new Date(today);
    tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);

    const futureTransactions = await this.prisma.stockTransaction.findMany({
      where: {
        productId,
        date: {
          gte: tomorrowMidnight, // Strictly tomorrow midnight onwards
        },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate Today's Real Physical Stock (Total - Future Changes)
    let futureSum = 0;
    futureTransactions.forEach((tx) => {
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
      startDate.setHours(23, 59, 59, 999); // End of the start day

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + lookAheadDays);

      // Start from today's physical stock and advance to startDate
      let currentBalance = todaysPhysicalStock;

      // Advance to start date by applying all transactions up to and including startDate
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
    const plus360Date = new Date(today);
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

    // 4. Next In Date Logic (Relative to selectedDate or today)
    const targetNextInDate = selectedDate ? new Date(selectedDate) : today;
    targetNextInDate.setHours(0, 0, 0, 0);

    const nextInTx = await this.prisma.stockTransaction.findFirst({
      where: {
        productId,
        date: { gt: targetNextInDate },
        transactionType: { in: ['IN', 'PURCHASE'] },
      },
      orderBy: { date: 'asc' },
    });

    const nextInInfo = nextInTx
      ? {
          date: new Date(nextInTx.date).toISOString().split('T')[0],
          quantity: nextInTx.quantity,
        }
      : { date: null, quantity: null };

    // 5. Determine Status based on selectedDate
    let status: 'SAFE' | 'AT RISK' | 'WAITING LIST' = 'SAFE';
    
    // Use the stock on the selected date (stockOnSelectedDate) for immediate status check
    if (stockOnSelectedDate <= 0) {
      status = 'WAITING LIST';
    } else {
      // Check for any dips in the 30 days following the selected date
      const minBal30 = calculateMinProjectedBalance(
        selectedDateObj.toISOString().split('T')[0],
        30,
      );
      if (minBal30 <= 0) {
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

  async syncAllProductsStock(): Promise<{ updated: number }> {
    const products = await this.prisma.product.findMany({
      select: { id: true, todaysStock: true }
    });
    
    let updatedCount = 0;
    for (const product of products) {
      const result = await this.prisma.stockTransaction.aggregate({
        where: { productId: product.id },
        _sum: { quantity: true },
      });
      const actualStock = result._sum.quantity || 0;
      
      if (actualStock !== (product.todaysStock || 0)) {
        await this.prisma.product.update({
          where: { id: product.id },
          data: { todaysStock: actualStock }
        });
        updatedCount++;
      }
    }
    
    return { updated: updatedCount };
  }
}

