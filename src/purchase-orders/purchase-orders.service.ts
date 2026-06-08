import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async create(data: any) {
    const currentYear = new Date().getFullYear();
    const lastPo = await this.prisma.purchaseOrder.findFirst({
      where: { poNumber: { startsWith: `PO_${currentYear}` } },
      orderBy: { createdAt: 'desc' },
      select: { poNumber: true }
    });

    let nextNumber = 1;
    if (lastPo && lastPo.poNumber) {
      const match = lastPo.poNumber.match(/PO_\d{4}(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const poNumber = `PO_${currentYear}${nextNumber.toString().padStart(4, '0')}`;

    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierName: data.supplierName,
          bookedOn: data.bookedOn ? new Date(data.bookedOn) : new Date(),
          jaipurArrival: data.jaipurArrival
            ? new Date(data.jaipurArrival)
            : undefined,
          jaipurArrivalManual: data.jaipurArrivalManual || false,
          piNo: data.piNo,
          approvedOn: data.approvedOn ? new Date(data.approvedOn) : undefined,
          status: 'DRAFT',
          notes: data.notes,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              productImage: item.productImage,
              modelNumber: item.modelNumber,
              rate: item.rate,
              quantity: item.quantity,
              amount: item.amount,
            })),
          },
        },
        include: { items: true, splits: { include: { items: true } } },
      });

      if (po.jaipurArrival && po.status !== 'CANCELLED') {
        const stockTxs = po.items
          .filter(item => item.productId)
          .map((item) => ({
          productId: item.productId as string,
          quantity: item.quantity,
          transactionType: 'IN' as const,
          referenceType: 'PURCHASE_ORDER',
          referenceId: po.id,
          date: po.jaipurArrival!,
        }));
        if (stockTxs.length > 0) {
          await tx.stockTransaction.createMany({ data: stockTxs });
        }
      }

      this.eventsGateway.broadcastEntityUpdate('PURCHASE_ORDER', po.id);
      return po;
    });
  }

  async findAll(search?: string, page: number = 0, limit: number = 100): Promise<{ data: any[]; total: number }> {
    const whereClause: Prisma.PurchaseOrderWhereInput = {};
    if (search) {
      whereClause.OR = [
        { poNumber: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where: whereClause,
        select: {
          id: true,
          poNumber: true,
          createdAt: true,
          status: true,
          bookedOn: true,
          jaipurArrival: true,
          supplierName: true,
          items: true,
        },
        skip: page * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseOrder.count({ where: whereClause })
    ]);
    return { data, total };
  }

  async findOne(id: string) {
    return this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: true,
        splits: {
          include: { items: true },
          orderBy: { splitNumber: 'asc' },
        },
      },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!po) throw new NotFoundException('Purchase Order not found');

      const updatedPo = await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierName:
            data.supplierName !== undefined
              ? data.supplierName
              : po.supplierName,
          bookedOn:
            data.bookedOn !== undefined ? new Date(data.bookedOn) : po.bookedOn,
          jaipurArrival:
            data.jaipurArrival !== undefined
              ? new Date(data.jaipurArrival)
              : po.jaipurArrival,
          jaipurArrivalManual:
            data.jaipurArrivalManual !== undefined
              ? data.jaipurArrivalManual
              : po.jaipurArrivalManual,
          piNo: data.piNo !== undefined ? data.piNo : po.piNo,
          approvedOn:
            data.approvedOn !== undefined
              ? data.approvedOn
                ? new Date(data.approvedOn)
                : null
              : po.approvedOn,
          status: data.status !== undefined ? data.status : po.status,
          notes: data.notes !== undefined ? data.notes : po.notes,
        },
        include: { items: true, splits: { include: { items: true } } },
      });

      // Update items if provided
      if (data.items) {
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });

        await tx.purchaseOrderItem.createMany({
          data: data.items.map((item) => ({
            purchaseOrderId: id,
            productId: item.productId,
            productName: item.productName,
            productImage: item.productImage,
            modelNumber: item.modelNumber,
            rate: item.rate,
            quantity: item.quantity,
            amount: item.amount,
          })),
        });
      }

      // Handle stock transactions
      await tx.stockTransaction.deleteMany({
        where: { referenceType: 'PURCHASE_ORDER', referenceId: id },
      });

      const refreshedPo = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true, splits: true }
      });

      if (refreshedPo && refreshedPo.splits.length === 0 && refreshedPo.jaipurArrival && refreshedPo.status !== 'CANCELLED') {
        const stockTxs = refreshedPo.items
          .filter(item => item.productId)
          .map((item) => ({
          productId: item.productId as string,
          quantity: item.quantity,
          transactionType: 'IN' as const,
          referenceType: 'PURCHASE_ORDER',
          referenceId: id,
          date: refreshedPo.jaipurArrival!,
        }));
        if (stockTxs.length > 0) {
          await tx.stockTransaction.createMany({ data: stockTxs });
        }
      }

      this.eventsGateway.broadcastEntityUpdate('PURCHASE_ORDER', id);
      return updatedPo;
    });
  }

  async delete(id: string) {
    return this.prisma.$transaction(async (tx) => {
      // Delete stock transactions
      await tx.stockTransaction.deleteMany({
        where: { referenceType: 'PURCHASE_ORDER', referenceId: id },
      });
      await tx.stockTransaction.deleteMany({
        where: {
          referenceType: 'PURCHASE_ORDER_SPLIT',
          referenceId: { startsWith: id },
        }, // approximate, better to fetch splits
      });

      const splits = await tx.purchaseOrderSplit.findMany({
        where: { purchaseOrderId: id },
      });
      const splitIds = splits.map((s) => s.id);
      if (splitIds.length > 0) {
        await tx.stockTransaction.deleteMany({
          where: {
            referenceType: 'PURCHASE_ORDER_SPLIT',
            referenceId: { in: splitIds },
          },
        });
      }

      const po = await tx.purchaseOrder.delete({ where: { id } });
      this.eventsGateway.broadcastEntityUpdate('PURCHASE_ORDER', id);
      return po;
    });
  }

  async updateMatrixSplits(id: string, splitsData: any[]) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true, splits: { include: { items: true } } },
      });
      if (!po) throw new NotFoundException('Purchase Order not found');

      // 1. Delete all existing splits and items
      await tx.purchaseOrderSplitItem.deleteMany({
        where: { split: { purchaseOrderId: id } },
      });
      await tx.purchaseOrderSplit.deleteMany({
        where: { purchaseOrderId: id },
      });

      // Delete old stock transactions for these splits
      const oldSplitIds = po.splits.map((s) => s.id);
      if (oldSplitIds.length > 0) {
        await tx.stockTransaction.deleteMany({
          where: {
            referenceType: 'PURCHASE_ORDER_SPLIT',
            referenceId: { in: oldSplitIds },
          },
        });
      }

      // Delete master PO stock transactions since splits are taking over
      await tx.stockTransaction.deleteMany({
        where: { referenceType: 'PURCHASE_ORDER', referenceId: id },
      });

      // 2. Re-create splits
      const newSplits: any[] = [];
      for (let i = 0; i < splitsData.length; i++) {
        const splitInput = splitsData[i];

        const split = await tx.purchaseOrderSplit.create({
          data: {
            purchaseOrderId: id,
            splitNumber: i + 1,
            jaipurArrival: splitInput.jaipurArrival
              ? new Date(splitInput.jaipurArrival)
              : null,
            label: splitInput.label,
            status: 'CONFIRMED', // Auto-confirm PO splits for stock
          },
        });

        // Create items
        if (splitInput.items && splitInput.items.length > 0) {
          const itemsToCreate = splitInput.items
            .map((item) => ({
              purchaseOrderSplitId: split.id,
              purchaseOrderItemId: item.itemId || item.purchaseOrderItemId,
              quantity: item.quantity,
            }))
            .filter((i) => i.quantity > 0);

          if (itemsToCreate.length > 0) {
            await tx.purchaseOrderSplitItem.createMany({
              data: itemsToCreate,
            });

            // Create Stock Transactions (IN)
            for (const splitItem of itemsToCreate) {
              const poItem = po.items.find(
                (pi) => pi.id === splitItem.purchaseOrderItemId,
              );
              if (poItem && poItem.productId) {
                await tx.stockTransaction.create({
                  data: {
                    productId: poItem.productId,
                    transactionType: 'IN', // PO means stock is coming IN
                    quantity: splitItem.quantity,
                    referenceType: 'PURCHASE_ORDER_SPLIT',
                    referenceId: split.id,
                    date: split.jaipurArrival || po.jaipurArrival || new Date(),
                    notes: `PO: ${po.poNumber} / Sp-${split.splitNumber} / ${split.label || ''}`,
                  },
                });
                this.eventsGateway.broadcastEntityUpdate(
                  'STOCK',
                  poItem.productId,
                );
              }
            }
          }
        }
        newSplits.push(split);
      }

      this.eventsGateway.broadcastEntityUpdate('PURCHASE_ORDER', id);

      return tx.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: true,
          splits: {
            include: { items: true },
            orderBy: { splitNumber: 'asc' },
          },
        },
      });
    });
  }
}
