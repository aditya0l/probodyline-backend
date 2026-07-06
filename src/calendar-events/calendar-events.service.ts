import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateCalendarEventDto, UpdateCalendarEventDto } from './dto/calendar-event.dto';

@Injectable()
export class CalendarEventsService {
  constructor(private prisma: PrismaService) {}

  async getAggregatedEvents(month: string) {
    // month format: "YYYY-MM"
    const startDate = new Date(`${month}-01T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const [salesOrders, dispatchSplits, purchaseOrders, customEvents] = await Promise.all([
      // 1. Sales Orders with dispatch date
      this.prisma.salesOrder.findMany({
        where: {
          status: { not: 'COMPLETED' },
          splits: { none: {} },
          quotation: {
            dispatchDate: {
              gte: startDate,
              lt: endDate,
            },
          },
        },
        include: {
          quotation: {
            select: {
              gymName: true,
              clientName: true,
              dispatchDate: true,
              items: { select: { quantity: true } }
            }
          }
        }
      }),

      // 2. Dispatch Splits
      this.prisma.dispatchSplit.findMany({
        where: {
          dispatchDate: {
            gte: startDate,
            lt: endDate,
          },
        },
        include: {
          salesOrder: {
            select: {
              id: true,
              soNumber: true,
              quotationId: true,
              quotation: {
                select: { gymName: true, clientName: true }
              }
            }
          },
          items: { select: { quantity: true } }
        }
      }),

      // 3. Purchase Orders
      this.prisma.purchaseOrder.findMany({
        where: {
          jaipurArrival: {
            gte: startDate,
            lt: endDate,
          },
        },
        include: {
          items: { select: { quantity: true } }
        }
      }),

      // 4. Custom Calendar Events
      this.prisma.calendarEvent.findMany({
        where: {
          date: {
            gte: startDate,
            lt: endDate,
          },
        },
      }),
    ]);

    return {
      salesOrders: salesOrders.map(so => ({
        id: so.id,
        salesOrderId: so.id,
        soNumber: so.soNumber,
        quotationId: so.quotationId,
        gymName: so.quotation?.gymName || so.quotation?.clientName || 'Unknown Gym',
        dispatchDate: so.quotation?.dispatchDate,
        totalQuantity: so.quotation?.items.reduce((sum, item) => sum + item.quantity, 0) || 0,
      })),
      dispatchSplits: dispatchSplits.map(ds => ({
        id: ds.id,
        salesOrderId: ds.salesOrder?.id,
        soNumber: ds.salesOrder?.soNumber,
        quotationId: ds.salesOrder?.quotationId,
        gymName: ds.salesOrder?.quotation?.gymName || ds.salesOrder?.quotation?.clientName || 'Unknown Gym',
        dispatchDate: ds.dispatchDate,
        splitLabel: ds.label || `Split ${ds.splitNumber}`,
        splitQuantity: ds.items.reduce((sum, item) => sum + item.quantity, 0) || 0,
      })),
      purchaseOrders: purchaseOrders.map(po => ({
        id: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        jaipurArrival: po.jaipurArrival,
        totalQuantity: po.items.reduce((sum, item) => sum + item.quantity, 0) || 0,
      })),
      customEvents,
    };
  }

  async getCustomEvents(month: string) {
    const startDate = new Date(`${month}-01T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    return this.prisma.calendarEvent.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  async createEvent(data: CreateCalendarEventDto, userId?: string) {
    return this.prisma.calendarEvent.create({
      data: {
        ...data,
        date: new Date(data.date),
        createdBy: userId,
      },
    });
  }

  async updateEvent(id: string, data: UpdateCalendarEventDto) {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      },
    });
  }

  async deleteEvent(id: string) {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    return this.prisma.calendarEvent.delete({
      where: { id },
    });
  }
}
