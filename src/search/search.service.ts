import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(query: string) {
    const term = `%${query}%`;
    const termInsensitive = { contains: query, mode: 'insensitive' as const };

    const [clients, gyms, products, bookings, salesOrders, purchaseOrders] = await Promise.all([
      // Clients
      this.prisma.client.findMany({
        where: {
          OR: [
            { clientName: termInsensitive },
            { stateCode: termInsensitive },
            { city: termInsensitive },
          ]
        },
        select: { id: true, clientName: true },
        take: 5
      }),
      // Gyms
      this.prisma.gym.findMany({
        where: {
          OR: [
            { gymName: termInsensitive },
            { gymCode: termInsensitive },
          ]
        },
        select: { id: true, gymName: true, gymCode: true },
        take: 5
      }),
      // Products
      this.prisma.product.findMany({
        where: {
          OR: [
            { modelNumber: termInsensitive },
            { name: termInsensitive },
          ]
        },
        select: { id: true, modelNumber: true, name: true },
        take: 5
      }),
      // Bookings
      this.prisma.booking.findMany({
        where: {
          OR: [
            { quoteNumber: termInsensitive },
            { customerName: termInsensitive },
            { gymName: termInsensitive },
            { modelNumber: termInsensitive },
          ]
        },
        select: { id: true, quoteNumber: true, customerName: true, gymName: true },
        take: 5
      }),
      // Sales Orders
      this.prisma.salesOrder.findMany({
        where: {
          OR: [
            { soNumber: termInsensitive },
          ]
        },
        select: { id: true, soNumber: true },
        take: 5
      }),
      // Purchase Orders
      this.prisma.purchaseOrder.findMany({
        where: {
          OR: [
            { poNumber: termInsensitive },
            { supplierName: termInsensitive },
          ]
        },
        select: { id: true, poNumber: true, supplierName: true },
        take: 5
      })
    ]);

    const results: any[] = [];

    for (const item of clients) {
      results.push({
        id: item.id,
        type: 'CLIENT',
        label: item.clientName || 'Unknown Client',
        link: `/dashboard/clients/${item.id}`
      });
    }

    for (const item of gyms) {
      results.push({
        id: item.id,
        type: 'GYM',
        label: item.gymCode ? `${item.gymName} [${item.gymCode}]` : item.gymName,
        link: `/dashboard/gyms/${item.id}`
      });
    }

    for (const item of products) {
      results.push({
        id: item.id,
        type: 'PRODUCT',
        label: item.name ? `${item.modelNumber} - ${item.name}` : item.modelNumber,
        link: `/dashboard/stock/detail/${item.id}`
      });
    }

    for (const item of bookings) {
      results.push({
        id: item.id,
        type: 'BOOKING',
        label: `${item.quoteNumber} - ${item.customerName || item.gymName}`,
        link: `/dashboard/bookings`
      });
    }

    for (const item of salesOrders) {
      results.push({
        id: item.id,
        type: 'SALES_ORDER',
        label: `${item.soNumber}`,
        link: `/dashboard/sales-orders`
      });
    }

    for (const item of purchaseOrders) {
      results.push({
        id: item.id,
        type: 'PURCHASE_ORDER',
        label: `${item.poNumber} - ${item.supplierName}`,
        link: `/dashboard/purchase-orders`
      });
    }

    return { results };
  }
}
