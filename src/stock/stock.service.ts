import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
import { UpdateStockTransactionDto } from './dto/update-stock-transaction.dto';
import { StockTransaction, Prisma, StockTransactionType } from '@prisma/client';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

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
   */
  async getStockProjection(
    productId: string,
    selectedDate: string,
  ): Promise<any> {
    // Get product
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

    // Calculate base stock values
    const stockOnDate = await this.getStockOnDate(productId, selectedDate);
    
    // Calculate future dates
    const selectedDateObj = new Date(selectedDate);
    const plus15Date = new Date(selectedDateObj);
    plus15Date.setDate(plus15Date.getDate() + 15);
    const plus30Date = new Date(selectedDateObj);
    plus30Date.setDate(plus30Date.getDate() + 30);

    const plus15DateStr = plus15Date.toISOString().split('T')[0];
    const plus30DateStr = plus30Date.toISOString().split('T')[0];

    // Calculate stock after orders
    const [
      stockAfterOrderOnDate,
      stockAfterOrderPlus15Days,
      stockAfterOrderPlus30Days,
      stockPlus30Days,
      nextInInfo,
    ] = await Promise.all([
      this.getStockAfterOrderOnDate(productId, selectedDate),
      this.getStockAfterOrderOnDate(productId, plus15DateStr),
      this.getStockAfterOrderOnDate(productId, plus30DateStr),
      this.getStockOnDate(productId, plus30DateStr),
      this.getNextInInfo(productId),
    ]);

    // Determine status
    let status: 'SAFE' | 'AT RISK' | 'WAITING LIST' = 'SAFE';
    const todaysStock = product.todaysStock || 0;
    if (todaysStock < 0) {
      status = 'WAITING LIST';
    } else if (stockPlus30Days < 0) {
      status = 'AT RISK';
    }

    // Resolve product relationships (model numbers to product names)
    const resolveProductName = async (modelNumber: string | null): Promise<string | null> => {
      if (!modelNumber) return null;
      const relatedProduct = await this.prisma.product.findFirst({
        where: {
          modelNumber,
          deletedAt: null,
        },
        select: {
          name: true,
        },
      });
      return relatedProduct?.name || null;
    };

    const [cousinMachineName, orderTogetherName, swapMachineName] = await Promise.all([
      resolveProductName(product.cousinMachine),
      resolveProductName(product.orderTogether),
      resolveProductName(product.swapMachine),
    ]);

    return {
      stockOnDate,
      stockPlus30Days,
      status,
      stockAfterOrderOnDate,
      stockAfterOrderPlus15Days,
      stockAfterOrderPlus30Days,
      nextInDate: nextInInfo.date,
      nextInQuantity: nextInInfo.quantity,
      cousinMachineName,
      orderTogetherName,
      swapMachineName,
    };
  }
}

