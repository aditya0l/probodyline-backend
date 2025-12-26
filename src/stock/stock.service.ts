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
    const where: Prisma.StockTransactionWhereInput = {
      ...(productId && { productId }),
      ...(filters?.startDate &&
        filters?.endDate && {
          date: {
            gte: new Date(filters.startDate),
            lte: new Date(filters.endDate),
          },
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
}

