import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardSummary() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Total sales (approved/converted quotations)
    const salesSummary = await this.prisma.quotation.aggregate({
      where: {
        deletedAt: null,
        status: { in: ['approved', 'converted'] },
      },
      _sum: {
        grandTotal: true,
      },
      _count: {
        id: true,
      },
    });

    // Monthly sales
    const monthlySales = await this.prisma.quotation.aggregate({
      where: {
        deletedAt: null,
        status: { in: ['approved', 'converted'] },
        createdAt: { gte: startOfMonth },
      },
      _sum: {
        grandTotal: true,
      },
      _count: {
        id: true,
      },
    });

    // Total quotations
    const totalQuotations = await this.prisma.quotation.count({
      where: {
        deletedAt: null,
      },
    });

    // Pending quotations
    const pendingQuotations = await this.prisma.quotation.count({
      where: {
        deletedAt: null,
        status: { in: ['draft', 'sent'] },
      },
    });

    // Total products
    const totalProducts = await this.prisma.product.count({
      where: {
        deletedAt: null,
      },
    });

    // Total customers
    const totalCustomers = await this.prisma.customer.count({
      where: {
        deletedAt: null,
      },
    });

    // Low stock products count - optimized with single aggregation query
    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        todaysStock: true,
      },
    });

    if (products.length === 0) {
      return {
        sales: {
          total: salesSummary._sum.grandTotal?.toNumber() || 0,
          totalTransactions: salesSummary._count.id,
          monthly: monthlySales._sum.grandTotal?.toNumber() || 0,
          monthlyTransactions: monthlySales._count.id,
        },
        quotations: {
          total: totalQuotations,
          pending: pendingQuotations,
          conversionRate:
            totalQuotations > 0
              ? Number(
                  (
                    ((totalQuotations - pendingQuotations) / totalQuotations) *
                    100
                  ).toFixed(2),
                )
              : 0,
        },
        inventory: {
          totalProducts,
          lowStockCount: 0,
        },
        customers: {
          total: totalCustomers,
        },
      };
    }

    // Calculate stock for all products in a single query
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

    // Count low stock products
    let lowStockCount = 0;
    products.forEach((product) => {
      const currentStock = stockMap.get(product.id) || product.todaysStock || 0;
      if (currentStock <= 10) {
        lowStockCount++;
      }
    });

    return {
      sales: {
        total: salesSummary._sum.grandTotal?.toNumber() || 0,
        totalTransactions: salesSummary._count.id,
        monthly: monthlySales._sum.grandTotal?.toNumber() || 0,
        monthlyTransactions: monthlySales._count.id,
      },
      quotations: {
        total: totalQuotations,
        pending: pendingQuotations,
        conversionRate:
          totalQuotations > 0
            ? Number(
                (
                  ((totalQuotations - pendingQuotations) / totalQuotations) *
                  100
                ).toFixed(2),
              )
            : 0,
      },
      inventory: {
        totalProducts,
        lowStockCount,
      },
      customers: {
        total: totalCustomers,
      },
    };
  }

  async getSalesTrends(
    period: 'daily' | 'weekly' | 'monthly' = 'monthly',
    startDate?: string,
    endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Default: last 90 days
    const end = endDate ? new Date(endDate) : new Date();

    const quotations = await this.prisma.quotation.findMany({
      where: {
        deletedAt: null,
        status: { in: ['approved', 'converted'] },
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        createdAt: true,
        grandTotal: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by period
    const trends: Record<string, { date: string; revenue: number; count: number }> = {};

    quotations.forEach((q) => {
      const date = new Date(q.createdAt);
      let key: string;

      if (period === 'daily') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!trends[key]) {
        trends[key] = { date: key, revenue: 0, count: 0 };
      }
      trends[key].revenue += q.grandTotal.toNumber();
      trends[key].count += 1;
    });

    return Object.values(trends).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getTopProducts(
    limit: number = 10,
    startDate?: string,
    endDate?: string,
  ) {
    const where: Prisma.QuotationItemWhereInput = {
      quotation: {
        deletedAt: null,
        status: { in: ['approved', 'converted'] },
        ...(startDate &&
          endDate && {
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
      },
    };

    const items = await this.prisma.quotationItem.findMany({
      where,
      include: {
        product: {
          select: { id: true, name: true, modelNumber: true },
        },
      },
    });

    // Aggregate by product
    const productMap = new Map<
      string,
      { product: any; totalQuantity: number; totalRevenue: number }
    >();

    items.forEach((item) => {
      const productId = item.productId || 'unknown';
      if (!productMap.has(productId)) {
        productMap.set(productId, {
          product: item.product || { name: item.productName },
          totalQuantity: 0,
          totalRevenue: 0,
        });
      }
      const entry = productMap.get(productId)!;
      entry.totalQuantity += item.quantity;
      entry.totalRevenue += item.totalAmount.toNumber();
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit)
      .map((entry, index) => ({
        rank: index + 1,
        product: entry.product,
        totalQuantity: entry.totalQuantity,
        totalRevenue: entry.totalRevenue,
      }));
  }

  async getTopCustomers(
    limit: number = 10,
    startDate?: string,
    endDate?: string,
  ) {
    const where: Prisma.QuotationWhereInput = {
      deletedAt: null,
      status: { in: ['approved', 'converted'] },
      customerId: { not: null },
      ...(startDate &&
        endDate && {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
    };

    const quotations = await this.prisma.quotation.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, gymName: true },
        },
      },
    });

    // Aggregate by customer
    const customerMap = new Map<
      string,
      { customer: any; totalRevenue: number; orderCount: number }
    >();

    quotations.forEach((q) => {
      if (!q.customerId || !q.customer) return;
      const customerId = q.customerId;
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customer: q.customer,
          totalRevenue: 0,
          orderCount: 0,
        });
      }
      const entry = customerMap.get(customerId)!;
      entry.totalRevenue += q.grandTotal.toNumber();
      entry.orderCount += 1;
    });

    return Array.from(customerMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit)
      .map((entry, index) => ({
        rank: index + 1,
        customer: entry.customer,
        totalRevenue: entry.totalRevenue,
        orderCount: entry.orderCount,
        averageOrderValue: entry.totalRevenue / entry.orderCount,
      }));
  }
}

