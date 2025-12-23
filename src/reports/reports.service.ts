import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSalesReport(
    filters?: {
      startDate?: string;
      endDate?: string;
      customerId?: string;
      productId?: string;
      status?: string[];
    },
  ) {
    const where: Prisma.QuotationWhereInput = {
      deletedAt: null,
      ...(filters?.startDate &&
        filters?.endDate && {
          createdAt: {
            gte: new Date(filters.startDate),
            lte: new Date(filters.endDate),
          },
        }),
      ...(filters?.customerId && { customerId: filters.customerId }),
      ...(filters?.status && { status: { in: filters.status } }),
      ...(filters?.productId && {
        items: {
          some: {
            productId: filters.productId,
          },
        },
      }),
    };

    const quotations = await this.prisma.quotation.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, gymName: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, modelNumber: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate summary
    const summary = await this.prisma.quotation.aggregate({
      where,
      _sum: {
        subtotal: true,
        gstAmount: true,
        grandTotal: true,
      },
      _count: {
        id: true,
      },
      _avg: {
        grandTotal: true,
      },
    });

    return {
      quotations,
      summary: {
        totalQuotations: summary._count.id,
        totalRevenue: summary._sum.grandTotal?.toNumber() || 0,
        totalSubtotal: summary._sum.subtotal?.toNumber() || 0,
        totalGst: summary._sum.gstAmount?.toNumber() || 0,
        averageOrderValue: summary._avg.grandTotal?.toNumber() || 0,
      },
    };
  }

  async getStockReport(
    filters?: {
      lowStockThreshold?: number;
      productId?: string;
      categoryId?: string;
    },
  ) {
    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(filters?.productId && { id: filters.productId }),
        ...(filters?.categoryId && { categoryId: filters.categoryId }),
      },
      select: {
        id: true,
        srNo: true,
        priority: true,
        name: true,
        modelNumber: true,
        image: true,
        images: true,
        price: true,
        productType: true,
        categoryId: true,
        seriesName: true,
        packagingDescription: true,
        keyword: true,
        todaysStock: true,
        stockPlus360Days: true,
        dateSelectStock: true,
        mrpStickers: true,
        customDeclarations: true,
        cartonLabel: true,
        machineArtwork: true,
        brochure: true,
        thumbnail: true,
        cousinMachine: true,
        orderTogether: true,
        swapMachine: true,
        brand: true,
        warranty: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        category: {
          select: { id: true, name: true },
        },
      },
    });

    // Calculate stock for all products in a single query using groupBy
    const productIds = products.map((p) => p.id);
    const stockAggregations = await this.prisma.stockTransaction.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
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
        isLowStock:
          filters?.lowStockThreshold !== undefined
            ? currentStock <= filters.lowStockThreshold
            : false,
      };
    });

    // Filter low stock if threshold provided
    const threshold = filters?.lowStockThreshold ?? 10;
    const lowStockProducts = productsWithStock.filter(
      (p) => p.currentStock <= threshold,
    );

    return {
      products: productsWithStock,
      summary: {
        totalProducts: productsWithStock.length,
        lowStockCount: lowStockProducts.length,
        lowStockProducts,
      },
    };
  }

  async getQuotationReport(
    filters?: {
      startDate?: string;
      endDate?: string;
    },
  ) {
    const where: Prisma.QuotationWhereInput = {
      deletedAt: null,
      ...(filters?.startDate &&
        filters?.endDate && {
          createdAt: {
            gte: new Date(filters.startDate),
            lte: new Date(filters.endDate),
          },
        }),
    };

    // Status breakdown
    const statusBreakdown = await this.prisma.quotation.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
      _sum: {
        grandTotal: true,
      },
    });

    // Conversion rate (approved + converted / total)
    const totalQuotations = await this.prisma.quotation.count({ where });
    const convertedQuotations = await this.prisma.quotation.count({
      where: {
        ...where,
        status: { in: ['approved', 'converted'] },
      },
    });

    const conversionRate =
      totalQuotations > 0 ? (convertedQuotations / totalQuotations) * 100 : 0;

    return {
      statusBreakdown: statusBreakdown.map((s) => ({
        status: s.status,
        count: s._count.id,
        totalRevenue: s._sum.grandTotal?.toNumber() || 0,
      })),
      summary: {
        totalQuotations,
        convertedQuotations,
        conversionRate: Number(conversionRate.toFixed(2)),
      },
    };
  }

  async getFinancialReport(
    filters?: {
      startDate?: string;
      endDate?: string;
    },
  ) {
    const where: Prisma.QuotationWhereInput = {
      deletedAt: null,
      status: { in: ['approved', 'converted'] }, // Only count approved/converted
      ...(filters?.startDate &&
        filters?.endDate && {
          createdAt: {
            gte: new Date(filters.startDate),
            lte: new Date(filters.endDate),
          },
        }),
    };

    const summary = await this.prisma.quotation.aggregate({
      where,
      _sum: {
        subtotal: true,
        gstAmount: true,
        grandTotal: true,
      },
      _count: {
        id: true,
      },
      _avg: {
        grandTotal: true,
      },
    });

    // GST summary
    const gstSummary = await this.prisma.quotation.groupBy({
      by: ['gstRate'],
      where,
      _sum: {
        gstAmount: true,
        grandTotal: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      summary: {
        totalRevenue: summary._sum.grandTotal?.toNumber() || 0,
        totalSubtotal: summary._sum.subtotal?.toNumber() || 0,
        totalGst: summary._sum.gstAmount?.toNumber() || 0,
        totalTransactions: summary._count.id,
        averageTransactionValue: summary._avg.grandTotal?.toNumber() || 0,
      },
      gstBreakdown: gstSummary.map((g) => ({
        gstRate: g.gstRate.toNumber(),
        totalGst: g._sum.gstAmount?.toNumber() || 0,
        totalRevenue: g._sum.grandTotal?.toNumber() || 0,
        transactionCount: g._count.id,
      })),
    };
  }
}

