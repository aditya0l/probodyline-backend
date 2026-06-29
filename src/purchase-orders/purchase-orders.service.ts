import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { syncProductStock } from '../utils/stock-sync';
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

    const po = await this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierName: data.supplierName,
          factoryId: data.factoryId,
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
          for (const item of stockTxs) {
            await syncProductStock(tx, item.productId);
          }
        }
      }

      return po;
    });

    // Broadcast OUTSIDE the transaction — only after commit
    this.eventsGateway.broadcastEntityUpdate('PURCHASE_ORDER', po.id);
    for (const item of po.items) {
      if (item.productId) {
        this.eventsGateway.broadcastEntityUpdate('STOCK', item.productId);
      }
    }

    return po;
  }

  async findAll(search?: string, page: number = 0, limit: number = 100): Promise<{ data: any[]; total: number }> {
    const whereClause: Prisma.PurchaseOrderWhereInput = {};
    if (search) {
      whereClause.OR = [
        { poNumber: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { items: { some: { modelNumber: { contains: search, mode: 'insensitive' } } } },
        { items: { some: { productName: { contains: search, mode: 'insensitive' } } } }
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where: whereClause,
        include: {
          items: true,
          splits: true,
          factory: true,
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
          include: {
            items: true,
          },
        },
        factory: true,
      },
    });
  }

  async update(id: string, data: any) {
    const txResult = await this.prisma.$transaction(async (tx) => {
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

      // Determine which product IDs need master transaction resync
      // Surgical: only resync products whose qty changed, or ALL if dates changed
      const jaipurArrivalChanged = data.jaipurArrival !== undefined &&
        new Date(data.jaipurArrival).getTime() !== po.jaipurArrival?.getTime();

      const productIdsToSync = new Set<string>();
      po.items.forEach(i => i.productId && productIdsToSync.add(i.productId));

      // Refresh PO with current items and splits from DB
      const refreshedPo = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true, splits: { include: { items: true } } },
      });

      if (refreshedPo) {
        refreshedPo.items.forEach(i => i.productId && productIdsToSync.add(i.productId));
      }

      // Determine which products actually changed qty
      let changedProductIds: Set<string>;
      if (data.items || jaipurArrivalChanged) {
        // If items were replaced or jaipur date changed, resync ALL products
        changedProductIds = productIdsToSync;
      } else {
        // Only date/status/notes changed — still resync all if date changed
        changedProductIds = productIdsToSync;
      }

      // Delete master PO stock transactions for affected products
      if (changedProductIds.size > 0) {
        await tx.stockTransaction.deleteMany({
          where: {
            referenceType: 'PURCHASE_ORDER',
            referenceId: id,
            productId: { in: Array.from(changedProductIds) },
          },
        });
      }

      // Recreate master transactions with correct pending qty
      if (refreshedPo && refreshedPo.jaipurArrival && refreshedPo.status !== 'CANCELLED') {
        for (const poItem of refreshedPo.items.filter(i => i.productId && changedProductIds.has(i.productId!))) {
          // Calculate allocated qty from existing splits
          const allocatedQty = refreshedPo.splits.reduce((sum, split) => {
            const splitItem = split.items.find(
              i => i.purchaseOrderItemId === poItem.id
            );
            return sum + (splitItem?.quantity ?? 0);
          }, 0);

          const pendingQty = poItem.quantity - allocatedQty;

          if (pendingQty > 0) {
            await tx.stockTransaction.create({
              data: {
                productId: poItem.productId!,
                transactionType: 'IN',
                quantity: pendingQty,
                referenceType: 'PURCHASE_ORDER',
                referenceId: id,
                date: refreshedPo.jaipurArrival,
                notes: `PO Pending — ${refreshedPo.poNumber} (${pendingQty} of ${poItem.quantity} unallocated)`,
              },
            });
          }
          // If pendingQty <= 0, splits cover 100% — no master entry
        }
      }

      // Sync all involved product stock totals
      for (const pid of productIdsToSync) {
        await syncProductStock(tx, pid);
      }

      return { updatedPo, affectedProductIds: Array.from(productIdsToSync) };
    });

    // Broadcast OUTSIDE the transaction — only after commit
    this.eventsGateway.broadcastEntityUpdate('PURCHASE_ORDER', id);
    for (const pid of txResult.affectedProductIds) {
      this.eventsGateway.broadcastEntityUpdate('STOCK', pid);
    }

    return txResult.updatedPo;
  }

  async delete(id: string) {
    const txResult = await this.prisma.$transaction(async (tx) => {
      // Fetch PO with items and splits before deletion
      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true, splits: true },
      });
      if (!po) throw new NotFoundException('Purchase Order not found');

      const splitIds = po.splits.map((s) => s.id);

      // Delete all stock transactions for master PO
      await tx.stockTransaction.deleteMany({
        where: { referenceType: 'PURCHASE_ORDER', referenceId: id },
      });

      // Delete all stock transactions for splits
      if (splitIds.length > 0) {
        await tx.stockTransaction.deleteMany({
          where: {
            referenceType: 'PURCHASE_ORDER_SPLIT',
            referenceId: { in: splitIds },
          },
        });
      }

      // Delete the PO (cascades to items, splits, split items)
      await tx.purchaseOrder.delete({ where: { id } });

      // Sync stock totals for all affected products
      const affectedProductIds: string[] = [];
      for (const item of po.items) {
        if (item.productId) {
          await syncProductStock(tx, item.productId);
          affectedProductIds.push(item.productId);
        }
      }

      return { po, affectedProductIds };
    });

    // Broadcast OUTSIDE the transaction — only after commit
    this.eventsGateway.broadcastEntityUpdate('PURCHASE_ORDER', id);
    for (const pid of txResult.affectedProductIds) {
      this.eventsGateway.broadcastEntityUpdate('STOCK', pid);
    }

    return txResult.po;
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

      // Delete master PO stock transactions — will be recreated with correct pending qty
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
            splitNumber: splitInput.splitNumber || i + 1,
            jaipurArrival: (splitInput.jaipurArrival || splitInput.date)
              ? new Date(String(splitInput.jaipurArrival || splitInput.date))
              : null,
            label: splitInput.label,
            sortDate: splitInput.sortDate ? new Date(splitInput.sortDate) : null,
            status: 'CONFIRMED', // Auto-confirm PO splits for stock
          },
        });

        // DUAL-WRITE: Find or Create FactorySplit
        let factorySplitId: string | undefined = undefined;
        if (po.factoryId && splitInput.label) {
          const sortDate = splitInput.sortDate ? new Date(splitInput.sortDate) : null;
          let fs = await tx.factorySplit.findFirst({
            where: {
              factoryId: po.factoryId,
              dateRangeLabel: splitInput.label,
            }
          });

          if (!fs) {
            fs = await tx.factorySplit.create({
              data: {
                factoryId: po.factoryId,
                dateRangeLabel: splitInput.label,
                sortDate: sortDate,
              }
            });
          } else if (sortDate && fs.sortDate?.getTime() !== sortDate.getTime()) {
            // Update sortDate if it changed
            fs = await tx.factorySplit.update({
              where: { id: fs.id },
              data: { sortDate }
            });
          }
          factorySplitId = fs.id;
        }

        // Create items
        if (splitInput.items && splitInput.items.length > 0) {
          const itemsToCreate = splitInput.items
            .map((item) => ({
              purchaseOrderSplitId: split.id,
              factorySplitId: factorySplitId,
              purchaseOrderItemId: item.itemId || item.purchaseOrderItemId,
              quantity: item.quantity,
            }))
            .filter((i) => i.quantity > 0);

          if (itemsToCreate.length > 0) {
            await tx.purchaseOrderSplitItem.createMany({
              data: itemsToCreate,
            });

            // Create Stock Transactions (IN) for each split item
            for (const splitItem of itemsToCreate) {
              const poItem = po.items.find(
                (pi) => pi.id === splitItem.purchaseOrderItemId,
              );
              if (poItem && poItem.productId) {
                await tx.stockTransaction.create({
                  data: {
                    productId: poItem.productId,
                    transactionType: 'IN',
                    quantity: splitItem.quantity,
                    referenceType: 'PURCHASE_ORDER_SPLIT',
                    referenceId: split.id,
                    date: split.jaipurArrival || po.jaipurArrival || new Date(),
                    notes: `PO: ${po.poNumber} / Sp-${split.splitNumber} / ${split.label || ''}`,
                  },
                });
              }
            }
          }
        }
        newSplits.push(split);
      }

      // 3. Sync master pending qty — read from DB, not from request payload
      const savedSplits = await tx.purchaseOrderSplit.findMany({
        where: { purchaseOrderId: id },
        include: { items: true },
      });

      for (const poItem of po.items.filter(i => i.productId)) {
        const allocatedQty = savedSplits.reduce((sum, split) => {
          const splitItem = split.items.find(
            i => i.purchaseOrderItemId === poItem.id
          );
          return sum + (splitItem?.quantity ?? 0);
        }, 0);

        const pendingQty = poItem.quantity - allocatedQty;

        if (pendingQty > 0 && po.jaipurArrival && po.status !== 'CANCELLED') {
          await tx.stockTransaction.create({
            data: {
              productId: poItem.productId!,
              transactionType: 'IN',
              quantity: pendingQty,
              referenceType: 'PURCHASE_ORDER',
              referenceId: id,
              date: po.jaipurArrival,
              notes: `PO Pending — ${po.poNumber} (${pendingQty} of ${poItem.quantity} unallocated)`,
            },
          });
        }
        // If pendingQty <= 0, no master entry — splits cover 100%
      }

      // 4. Sync product stock totals
      const productIdsToSync = new Set<string>();
      po.items.forEach(i => i.productId && productIdsToSync.add(i.productId));
      for (const pid of productIdsToSync) {
        await syncProductStock(tx, pid);
      }

      const result = await tx.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: true,
          splits: {
            include: { items: true },
            orderBy: { splitNumber: 'asc' },
          },
        },
      });

      return { result, affectedProductIds: Array.from(productIdsToSync) };
    }).then(({ result, affectedProductIds }) => {
      // 5. Broadcast OUTSIDE the transaction — only after commit
      this.eventsGateway.broadcastEntityUpdate('PURCHASE_ORDER', id);
      for (const pid of affectedProductIds) {
        this.eventsGateway.broadcastEntityUpdate('STOCK', pid);
      }
      return result;
    });
  }
}
