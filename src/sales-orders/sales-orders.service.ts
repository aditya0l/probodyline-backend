import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { syncProductStock } from '../utils/stock-sync';
import { Prisma } from '@prisma/client';

import { EventsGateway } from '../events/events.gateway';
import { userContext } from '../common/context';

@Injectable()
export class SalesOrdersService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  // 1. Ensure Master Sales Order exists (Commercial Entity)
  async ensureMasterSO(quotationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || this.prisma;
    let so = await db.salesOrder.findUnique({
      where: { quotationId },
    });

    if (!so) {
      const quotation = await db.quotation.findUnique({
        where: { id: quotationId },
      });
      if (!quotation) throw new NotFoundException('Quotation not found');

      const soNumber = quotation.quoteNumber
        .replace('QO', 'SO')
        .replace('Q', 'SO'); // Handle both old and new formats

      so = await db.salesOrder.create({
        data: {
          quotationId,
          soNumber,
          subtotal: quotation.subtotal,
          gstAmount: quotation.gstAmount,
          grandTotal: quotation.grandTotal,
        },
      });

      const user = userContext.getStore();
      await db.salesOrderActivity.create({
        data: {
          salesOrderId: so.id,
          action: 'Sales Order initialized',
          changedBy: user?.id,
          details: `Generated from Quotation ${quotation.quoteNumber}`,
        },
      });

      // Copy QuotationItems to SalesOrderItems
      const quotationItems = await db.quotationItem.findMany({
        where: { quotationId },
      });

      if (quotationItems.length > 0) {
        const salesOrderItemsData = quotationItems.map((qi, index) => ({
          salesOrderId: so!.id,
          quotationItemId: qi.id,
          productId: qi.productId,
          productName: qi.productName,
          modelNumber: qi.modelNumber,
          quantity: qi.quantity,
          rate: qi.rate,
          mrp: qi.rate, // fallback mrp
          totalAmount: qi.totalAmount,
          notes: qi.notes,
          sortOrder: index + 1
        }));

        await db.salesOrderItem.createMany({
          data: salesOrderItemsData
        });
      }
    } else {
      // SO already exists - no resync needed as SO is decoupled from QO after creation.
    }

    // Return with FULL details
    return db.salesOrder.findUnique({
      where: { id: so.id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                modelNumber: true,
                thumbnail: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        quotation: {
          select: {
            id: true,
            quoteNumber: true,
            clientName: true,
            gymName: true,
            clientCity: true,
            bookingDate: true,
            dispatchDate: true,
            status: true,
          },
        },
        splits: {
          include: {
            items: {
              include: { quotationItem: true },
              orderBy: { quotationItem: { srNo: 'asc' } },
            },
          },
          orderBy: { splitNumber: 'asc' },
        },
      },
    });
  }

  // 2. Create a new Operational Dispatch Split
  async createDispatchSplit(salesOrderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const so = await tx.salesOrder.findUnique({
        where: { id: salesOrderId },
        include: { quotation: { include: { items: true } } },
      });
      if (!so) throw new NotFoundException('Sales Order not found');

      // Find next split number
      const count = await tx.dispatchSplit.count({
        where: { salesOrderId },
      });
      const splitNumber = count + 1;

      // Create Split
      const split = await tx.dispatchSplit.create({
        data: {
          salesOrderId,
          splitNumber,
          status: 'DRAFT',
        },
      });

      // Initialize all items with 0 quantity
      const splitItemsInfo = so.quotation.items.map((qItem) => ({
        dispatchSplitId: split.id,
        quotationItemId: qItem.id,
        quantity: 0,
      }));

      if (splitItemsInfo.length > 0) {
        await tx.dispatchSplitItem.createMany({
          data: splitItemsInfo,
        });
      }

      const user = userContext.getStore();
      await tx.salesOrderActivity.create({
        data: {
          salesOrderId: salesOrderId,
          action: 'Split Created',
          changedBy: user?.id,
          details: `Split #${splitNumber} created`,
        },
      });

      return this.getSplitWithDetails(split.id, tx);
    });
  }

  // 3. Update Dispatch Split (Quantities & Date)
  async updateDispatchSplit(
    splitId: string,
    updates: {
      dispatchDate?: string;
      items?: { id: string; quantity: number }[]; // id is dispatchSplitItemId
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const split = await tx.dispatchSplit.findUnique({
        where: { id: splitId },
      });
      if (!split) throw new NotFoundException('Split not found');
      if (updates.dispatchDate) {
        const newDispatchDate = new Date(updates.dispatchDate);
        await tx.dispatchSplit.update({
          where: { id: splitId },
          data: { dispatchDate: newDispatchDate },
        });

        // If it's already BOOKED, sync associated records
        if (split.status === 'BOOKED') {
          // Sync Stock Transactions
          await tx.stockTransaction.updateMany({
            where: {
              referenceId: splitId,
              referenceType: 'DISPATCH_SPLIT',
            },
            data: { date: newDispatchDate },
          });

          // Sync Bookings
          await tx.booking.updateMany({
            where: { dispatchSplitId: splitId },
            data: { dispatchDate: newDispatchDate },
          });
        }
      }

      if (updates.items) {
        for (const item of updates.items) {
          await tx.dispatchSplitItem.update({
            where: { id: item.id },
            data: { quantity: item.quantity },
          });
        }
      }

      const user = userContext.getStore();
      const detailParts: string[] = [];
      if (updates.dispatchDate) detailParts.push(`Date changed to ${updates.dispatchDate}`);
      if (updates.items) detailParts.push(`Quantities updated`);
      
      if (detailParts.length > 0) {
        await tx.salesOrderActivity.create({
          data: {
            salesOrderId: split.salesOrderId,
            action: `Split #${split.splitNumber} Updated`,
            changedBy: user?.id,
            details: detailParts.join(', '),
          },
        });
      }

      const result = await this.getSplitWithDetails(splitId, tx);
      this.eventsGateway.broadcastEntityUpdate(
        'SALES_ORDER',
        split.salesOrderId,
      );
      return result;
    });
  }

  // 4. Book Dispatch Split
  async bookDispatchSplit(splitId: string) {
    return this.prisma.$transaction(async (tx) => {
      const split = await this.getSplitWithDetails(splitId, tx);
      if (!split) throw new NotFoundException('Split not found');

      if (!split.dispatchDate)
        throw new BadRequestException('Dispatch Date is required');

      if (split.status === 'BOOKED')
        throw new BadRequestException('Split is already BOOKED');

      // A. Validate Quantities
      // Need to check specific item limits (Total Ordered vs Total Booked so far + Current)

      // Get all OTHER booked splits for this SO
      const otherBookedSplits = await tx.dispatchSplit.findMany({
        where: {
          salesOrderId: split.salesOrderId,
          status: 'BOOKED',
          id: { not: splitId },
        },
        include: { items: true },
      });

      // Iterate through current items
      let hasPositiveQty = false;

      for (const item of split.items) {
        if (item.quantity > 0) {
          hasPositiveQty = true;
          const orderedQty = item.quotationItem.quantity;

          // Sum from other booked splits
          let alreadyBooked = 0;
          for (const otherSplit of otherBookedSplits) {
            const otherItem = otherSplit.items.find(
              (i) => i.quotationItemId === item.quotationItemId,
            );
            if (otherItem) alreadyBooked += otherItem.quantity;
          }

          if (alreadyBooked + item.quantity > orderedQty) {
            throw new BadRequestException(
              `Cannot book. Item ${item.quotationItem.modelNumber} exceeds ordered quantity. Ordered: ${orderedQty}, Booked: ${alreadyBooked}, Attempting: ${item.quantity}`,
            );
          }
        }
      }

      if (!hasPositiveQty)
        throw new BadRequestException('Cannot book with 0 total quantity');

      // B. Delete 0-quantity rows
      await tx.dispatchSplitItem.deleteMany({
        where: {
          dispatchSplitId: splitId,
          quantity: 0,
        },
      });

      // C. Stock Deduction & Booking (Operational)
      // Re-fetch items after deletion? Or just filter from memory
      const finalItems = split.items.filter((i) => i.quantity > 0);

      for (const item of finalItems) {
        if (!item.quotationItem.productId) continue;

        // Stock OUT
        await tx.stockTransaction.create({
          data: {
            productId: item.quotationItem.productId,
            transactionType: 'OUT',
            quantity: -item.quantity,
            referenceType: 'DISPATCH_SPLIT',
            referenceId: split.id,
            date: split.dispatchDate!,
            notes: `Disp: ${split.salesOrder.soNumber} / Sp-${split.splitNumber}`,
          },
        });

        // We do NOT create a 'booking' record here because the commercial booking
        // logic is separate. BUT, if the user expects "Booking Status" to update,
        // we might need to track it.
        // For now, adhering to instruction: "Start simple, no new Booking record".
        // But wait, the prompt says "Create Booking records" in section 8.
        // "Create Booking records"
        // "Dispatch Splits ... Roll up to the SAME Booking"

        // If we create a booking record, it might duplicate the "demand".
        // Let's assume we create a Booking record to track the specific dispatch timeline for the Dashboard.

        await tx.booking.create({
          data: {
            quotationId: split.salesOrder.quotationId,
            quotationItemId: item.quotationItemId,
            quoteNumber: split.salesOrder.quotation.quoteNumber,
            productId: item.quotationItem.productId!,
            productName: item.quotationItem.productName,
            modelNumber: item.quotationItem.modelNumber,
            dispatchDate: split.dispatchDate!,
            bookedOn: new Date(),
            requiredQuantity: item.quantity,
            status: 'CONFIRM',
            waitingQuantity: 0,
            customerName: split.salesOrder.quotation.clientName,
            gymName: split.salesOrder.quotation.gymName,
            city: split.salesOrder.quotation.clientCity,
            dispatchSplitId: splitId,
          },
        });
      }

      // D. Lock Split
      await tx.dispatchSplit.update({
        where: { id: splitId },
        data: {
          status: 'BOOKED',
          bookedAt: new Date(),
        },
      });

      const user = userContext.getStore();
      await tx.salesOrderActivity.create({
        data: {
          salesOrderId: split.salesOrderId,
          action: `Split #${split.splitNumber} Booked`,
          changedBy: user?.id,
          details: `${finalItems.length} items booked for dispatch on ${split.dispatchDate?.toISOString().split('T')[0]}`,
        },
      });

      const result = await this.getSplitWithDetails(splitId, tx);
      this.eventsGateway.broadcastEntityUpdate(
        'SALES_ORDER',
        String(split.salesOrderId),
      );
      for (const item of finalItems) {
        if (item.quotationItem.productId) {
          await syncProductStock(tx, item.quotationItem.productId);
          this.eventsGateway.broadcastEntityUpdate(
            'STOCK',
            String(item.quotationItem.productId),
          );
        }
      }
      return result;
    });
  }

  async deleteDispatchSplit(splitId: string) {
    const split = await this.prisma.dispatchSplit.findUnique({
      where: { id: splitId },
    });
    if (!split) throw new NotFoundException('Split not found');
    if (split.status === 'BOOKED')
      throw new BadRequestException('Cannot delete a BOOKED split');

    return this.prisma.dispatchSplit.delete({ where: { id: splitId } });
  }

  async findAll(filters?: {
    gymName?: string;
    clientName?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number }> {
    const whereClause: Prisma.SalesOrderWhereInput = {
      status: { not: 'UNBOOKED' }
    };
    
    const user = userContext.getStore();
    if (user && user.role === 'SALES') {
      whereClause.quotation = { createdBy: user.id };
    }

    if (filters?.gymName || filters?.clientName || filters?.search) {
      whereClause.quotation = whereClause.quotation || {};
      if (filters.gymName) (whereClause.quotation as any).gymName = filters.gymName;
      if (filters.clientName) (whereClause.quotation as any).clientName = filters.clientName;
      if (filters.search) {
        whereClause.OR = [
          { soNumber: { contains: filters.search, mode: 'insensitive' } },
          { quotation: { clientName: { contains: filters.search, mode: 'insensitive' } } },
          { quotation: { gymName: { contains: filters.search, mode: 'insensitive' } } },
          { quotation: { quoteNumber: { contains: filters.search, mode: 'insensitive' } } }
        ];
      }
    }

    const page = filters?.page || 0;
    const limit = filters?.limit || 100;

    const [data, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where: whereClause,
        skip: page * limit,
        take: limit,
        select: {
          id: true,
          soNumber: true,
          quotationId: true,
          createdAt: true,
          status: true,
          grandTotal: true,
          quotation: {
            select: {
              id: true,
              quoteNumber: true,
              clientName: true,
              gymName: true,
              dispatchDate: true,
            },
          },
          splits: {
            select: {
              id: true,
              splitNumber: true,
              status: true,
            },
          },
          _count: {
            select: { splits: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.salesOrder.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  async findOne(id: string) {
    return this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                modelNumber: true,
                thumbnail: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        quotation: {
          select: {
            id: true,
            quoteNumber: true,
            clientName: true,
            gymName: true,
            clientCity: true,
            bookingDate: true,
            dispatchDate: true,
            status: true,
          },
        },
        splits: {
          include: {
            items: true,
          },
          orderBy: { splitNumber: 'asc' },
        },
        activities: {
          orderBy: { changedAt: 'desc' },
          take: 50,
        },
        quantityRequests: {
          where: { status: 'PENDING' },
          include: {
            user: {
              select: { id: true, name: true, role: true },
            },
          },
        },
      },
    });
  }

  // 5. Auto-create BOOKED split from PI (for legacy/simple flow compatibility)
  async createAutoBookedSplitFromQuotation(
    quotationId: string,
    tx?: Prisma.TransactionClient,
  ) {
    // First ensure Master SO exists (pass tx!)
    const so = await this.ensureMasterSO(quotationId, tx) as any;
    if (!so) throw new Error('Failed to ensure Sales Order');

    // Check if any active splits exist
    const activeSplits = so.splits ? so.splits.filter(s => s.status !== 'UNBOOKED') : [];
    if (activeSplits.length > 0) {
      return so; // Already has active splits, don't auto-create
    }

    const nextSplitNumber = so.splits ? so.splits.length + 1 : 1;

    const executeLogic = async (paramTx: Prisma.TransactionClient) => {
      // Create Split
      const split = await paramTx.dispatchSplit.create({
        data: {
          salesOrderId: so.id,
          splitNumber: nextSplitNumber,
          status: 'BOOKED',
          dispatchDate: so.quotation.dispatchDate || new Date(),
          bookedAt: new Date(),
        },
      });

      // Create Split Items with full quantity
      const splitItemsInfo = so.quotation.items.map((qItem) => ({
        dispatchSplitId: split.id,
        quotationItemId: qItem.id,
        quantity: qItem.quantity, // Auto-allocate full quantity
      }));

      if (splitItemsInfo.length > 0) {
        await paramTx.dispatchSplitItem.createMany({
          data: splitItemsInfo,
        });
      }

      // Restore the Master SO status to DRAFT in case it was UNBOOKED
      await paramTx.salesOrder.update({
        where: { id: so.id },
        data: { status: 'DRAFT' },
      });

      return this.getSplitWithDetails(split.id, paramTx);
    };

    if (tx) {
      return executeLogic(tx);
    } else {
      return this.prisma.$transaction(async (newTx) => {
        return executeLogic(newTx);
      });
    }
  }

  async unbookSalesOrder(salesOrderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const so = await tx.salesOrder.findUnique({
        where: { id: salesOrderId },
        include: {
          splits: {
            include: {
              items: { include: { quotationItem: true } },
            },
          },
        },
      });

      if (!so) throw new NotFoundException('Sales Order not found');
      if (so.status === 'UNBOOKED')
        throw new BadRequestException('Sales Order is already unbooked');

      // Process each split
      for (const split of so.splits) {
        if (split.status === 'BOOKED') {
          // Physically delete DISPATCH_SPLIT Stock OUT transactions
          await tx.stockTransaction.deleteMany({
            where: {
              referenceId: split.id,
              referenceType: 'DISPATCH_SPLIT',
            },
          });

          try {
            await tx.booking.deleteMany({
              where: { dispatchSplitId: split.id },
            });
          } catch (e) {
            console.warn('Failed to delete booking during unbook', e);
          }

          // Update Split Status
          await tx.dispatchSplit.update({
            where: { id: split.id },
            data: { status: 'UNBOOKED' },
          });
        }
      }

      // Update Master SO Status
      const result = await tx.salesOrder.update({
        where: { id: salesOrderId },
        data: { 
          status: 'UNBOOKED',
          needsResync: true,
          subtotal: 0,
          gstAmount: 0,
          grandTotal: 0
        },
      });

      const user = userContext.getStore();
      await tx.salesOrderActivity.create({
        data: {
          salesOrderId: salesOrderId,
          action: 'Sales Order Unbooked',
          changedBy: user?.id,
          details: 'All splits unbooked and stock reservations released',
        },
      });

      // Physically delete all PI_BOOKING Stock OUT transactions and Bookings for this Quotation
      if (so.quotationId) {
        await tx.stockTransaction.deleteMany({
          where: {
            referenceId: so.quotationId,
            referenceType: 'PI_BOOKING',
          },
        });
        
        await tx.booking.deleteMany({
          where: {
            quotationId: so.quotationId,
            dispatchSplitId: null, // Only delete auto-created bookings not tied to a specific split
          },
        });
      }

      // Revert Quotation status to DRAFT so it can be confirmed again
      if (so.quotationId) {
        await tx.quotation.update({
          where: { id: so.quotationId },
          data: { status: 'DRAFT' },
        });
        this.eventsGateway.broadcastEntityUpdate('QUOTATION', so.quotationId);
      }
      this.eventsGateway.broadcastEntityUpdate('SALES_ORDER', salesOrderId);
      for (const split of so.splits) {
        for (const item of split.items) {
          if (item.quotationItem.productId) {
            await syncProductStock(tx, item.quotationItem.productId);
            this.eventsGateway.broadcastEntityUpdate(
              'STOCK',
              item.quotationItem.productId,
            );
          }
        }
      }
      return result;
    });
  }

  async updateMatrixSplits(id: string, splitsData: any[]) {
    return this.prisma.$transaction(async (tx) => {
      const so = await tx.salesOrder.findUnique({
        where: { id },
        include: {
          quotation: { include: { items: true } },
          splits: { include: { items: true } },
        },
      });
      if (!so) throw new NotFoundException('Sales Order not found');

      // Delete master PI_BOOKING/QUOTATION OUT transactions since they are replaced by splits
      await tx.stockTransaction.deleteMany({
        where: {
          referenceId: so.quotationId,
          referenceType: { in: ['QUOTATION', 'PI_BOOKING'] },
          transactionType: 'OUT'
        }
      });

      // Physically delete old DISPATCH_SPLIT stock OUT transactions
      const oldSplitIds = so.splits.map((s) => s.id);
      if (oldSplitIds.length > 0) {
        await tx.stockTransaction.deleteMany({
          where: {
            referenceId: { in: oldSplitIds },
            referenceType: 'DISPATCH_SPLIT'
          }
        });

        // Try to delete bookings
        try {
          await tx.booking.deleteMany({
            where: { dispatchSplitId: { in: oldSplitIds } },
          });
        } catch (e) {
          console.warn('Failed to delete booking during matrix update', e);
        }

        // Now delete splits and items
        await tx.dispatchSplitItem.deleteMany({
          where: { dispatchSplitId: { in: oldSplitIds } },
        });
        await tx.dispatchSplit.deleteMany({
          where: { id: { in: oldSplitIds } },
        });
      }

      const totalMatrixSplits = splitsData.length > 0 ? Math.max(...splitsData.map(s => s.splitNumber || 1)) : 1;
      
      // Re-create new splits from matrix
      for (let i = 0; i < splitsData.length; i++) {
        const splitInput = splitsData[i];

        const split = await tx.dispatchSplit.create({
          data: {
            salesOrderId: id,
            splitNumber: splitInput.splitNumber || i + 1,
            dispatchDate: (splitInput.dispatchDate || splitInput.date)
              ? new Date(String(splitInput.dispatchDate || splitInput.date))
              : null,
            label: splitInput.label,
            status: 'BOOKED', // Matrix directly creates booked splits
            bookedAt: new Date(),
          },
        });

        if (splitInput.items && splitInput.items.length > 0) {
          const itemsToCreate = splitInput.items
            .map((item) => ({
              dispatchSplitId: split.id,
              quotationItemId: item.itemId || item.quotationItemId,
              quantity: item.quantity,
            }));

          if (itemsToCreate.length > 0) {
            await tx.dispatchSplitItem.createMany({
              data: itemsToCreate,
            });

            // Create Stock Transactions (OUT) and Bookings
            for (const splitItem of itemsToCreate) {
              
              const qItem = so.quotation.items.find(
                (qi) => qi.id === splitItem.quotationItemId,
              );
              if (qItem && qItem.productId) {
                await tx.stockTransaction.create({
                  data: {
                    productId: qItem.productId,
                    transactionType: 'OUT',
                    quantity: -splitItem.quantity,
                    referenceType: 'DISPATCH_SPLIT',
                    referenceId: split.id,
                    date:
                      split.dispatchDate ||
                      so.quotation.dispatchDate ||
                      new Date(),
                    notes: `Disp: ${so.soNumber} / Sp-${split.splitNumber} / ${split.label || ''}`,
                  },
                });

                const firstLetter = String.fromCharCode(64 + split.splitNumber);
                const secondLetter = String.fromCharCode(64 + totalMatrixSplits);
                const quoteNumberWithSplit = `${so.soNumber} ${firstLetter}/${secondLetter}`;

                await tx.booking.create({
                  data: {
                    quotationId: so.quotationId,
                    quotationItemId: qItem.id,
                    quoteNumber: quoteNumberWithSplit,
                    productId: qItem.productId,
                    productName: qItem.productName,
                    modelNumber: qItem.modelNumber,
                    dispatchDate:
                      split.dispatchDate ||
                      so.quotation.dispatchDate ||
                      new Date(),
                    bookedOn: new Date(),
                    requiredQuantity: splitItem.quantity,
                    status: 'CONFIRM',
                    waitingQuantity: 0,
                    customerName: so.quotation.clientName,
                    gymName: so.quotation.gymName,
                    city: so.quotation.clientCity,
                    dispatchSplitId: split.id,
                  },
                });

                // Broadcast will be handled outside the loop to prevent flooding
              }
            }
          }
        }
      }

      this.eventsGateway.broadcastEntityUpdate('SALES_ORDER', id);
      this.eventsGateway.broadcastEntityUpdate('BOOKING', id); // Broadcast BOOKING updates when matrix changes

      // Deduplicate STOCK broadcasts
      const broadcastProductIds = new Set<string>();
      splitsData.forEach(split => {
        split.items?.forEach(item => {
          const qItem = so.quotation.items.find(qi => qi.id === (item.itemId || item.quotationItemId));
          if (qItem?.productId) {
            broadcastProductIds.add(qItem.productId);
          }
        });
      });
      for (const productId of broadcastProductIds) {
        await syncProductStock(tx, productId);
        this.eventsGateway.broadcastEntityUpdate('STOCK', productId);
      }

      return tx.salesOrder.findUnique({
        where: { id },
        include: {
          quotation: { include: { items: true } },
          splits: {
            include: {
              items: {
                include: { quotationItem: true },
                orderBy: { quotationItem: { srNo: 'asc' } },
              },
            },
            orderBy: { splitNumber: 'asc' },
          },
        },
      });
    });
  }

  async findUnbooked(search?: string, page: number = 0, limit: number = 100): Promise<{ data: any[]; total: number }> {
    const whereClause: Prisma.SalesOrderWhereInput = { 
      status: 'UNBOOKED'
    };
    if (search) {
      whereClause.AND = [
        {
          OR: [
            { soNumber: { contains: search, mode: 'insensitive' } },
            { quotation: { clientName: { contains: search, mode: 'insensitive' } } },
            { quotation: { gymName: { contains: search, mode: 'insensitive' } } },
            { quotation: { quoteNumber: { contains: search, mode: 'insensitive' } } }
          ]
        }
      ];
    }
    
    const [data, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where: whereClause,
        include: {
          quotation: { include: { items: true } },
          splits: { include: { items: true } },
        },
        skip: page * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.salesOrder.count({ where: whereClause })
    ]);
    return { data, total };
  }

  // 6. Update Master Sales Order Date (Quotation Date)
  async updateMasterDispatchDate(salesOrderId: string, dispatchDate: string) {
    return this.prisma.$transaction(async (tx) => {
      const so = await tx.salesOrder.findUnique({
        where: { id: salesOrderId },
        include: { quotation: true },
      });

      if (!so) throw new NotFoundException('Sales Order not found');

      const newDispatchDate = new Date(dispatchDate);

      // A. Update Master Quotation
      await tx.quotation.update({
        where: { id: so.quotationId },
        data: { dispatchDate: newDispatchDate },
      });

      // B. Sync Stock Transactions (Confirmed PIs or Quote-linked)
      await tx.stockTransaction.updateMany({
        where: {
          referenceId: so.quotationId,
          transactionType: 'OUT',
          referenceType: { in: ['QUOTATION', 'PI_BOOKING'] },
        },
        data: { date: newDispatchDate },
      });

      // C. Sync Bookings
      await tx.booking.updateMany({
        where: { quotationId: so.quotationId },
        data: { dispatchDate: newDispatchDate },
      });

      // D. Sync Dispatch Splits
      const splits = await tx.dispatchSplit.findMany({
        where: { salesOrderId },
      });

      for (const split of splits) {
        await tx.dispatchSplit.update({
          where: { id: split.id },
          data: { dispatchDate: newDispatchDate },
        });

        if (split.status === 'BOOKED') {
          await tx.stockTransaction.updateMany({
            where: {
              referenceId: split.id,
              referenceType: 'DISPATCH_SPLIT',
            },
            data: { date: newDispatchDate },
          });

          await tx.booking.updateMany({
            where: { dispatchSplitId: split.id },
            data: { dispatchDate: newDispatchDate },
          });
        }
      }

      const updatedSO = await tx.salesOrder.findUnique({
        where: { id: salesOrderId },
        include: {
          quotation: { include: { items: true } },
          splits: {
            include: {
              items: {
                include: { quotationItem: true },
                orderBy: { quotationItem: { srNo: 'asc' } },
              },
            },
            orderBy: { splitNumber: 'asc' },
          },
        },
      });

      this.eventsGateway.broadcastEntityUpdate('SALES_ORDER', salesOrderId);
      return updatedSO;
    });
  }

  // 7. Update Generated Date
  async updateGeneratedDate(salesOrderId: string, createdAt: string) {
    return this.prisma.$transaction(async (tx) => {
      const so = await tx.salesOrder.findUnique({
        where: { id: salesOrderId },
        include: { quotation: true },
      });

      if (!so) throw new NotFoundException('Sales Order not found');

      const newDate = new Date(createdAt);

      await tx.salesOrder.update({
        where: { id: salesOrderId },
        data: { createdAt: newDate },
      });

      await tx.quotation.update({
        where: { id: so.quotationId },
        data: { createdAt: newDate },
      });

      this.eventsGateway.broadcastEntityUpdate('SALES_ORDER', salesOrderId);
      
      return tx.salesOrder.findUnique({
        where: { id: salesOrderId },
        include: {
          quotation: { include: { items: true } },
          splits: {
            include: {
              items: {
                include: { quotationItem: true },
                orderBy: { quotationItem: { srNo: 'asc' } },
              },
            },
            orderBy: { splitNumber: 'asc' },
          },
        },
      });
    });
  }

  // Helper
  private async getSplitWithDetails(splitId: string, tx: any) {
    return tx.dispatchSplit.findUnique({
      where: { id: splitId },
      include: {
        salesOrder: { include: { quotation: true } },
        items: {
          include: { quotationItem: true },
        },
      },
    });
  }

  async getSalesOrderDetail(id: string) {
    const so = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true, quantityRequests: true },
          orderBy: { createdAt: 'asc' }, // Or whatever order is appropriate
        },
        quantityRequests: {
          include: { user: true, reviewer: true },
          orderBy: { createdAt: 'desc' }
        },
        quotation: {
          include: {
            customer: true,
            clients: true,
            items: {
              include: { product: true },
              orderBy: { srNo: 'asc' },
            },
          },
        },
        splits: {
          include: {
            items: {
              include: { quotationItem: true },
            },
          },
        },
        activities: {
          include: { user: true },
          orderBy: { changedAt: 'desc' },
        },
      },
    });

    if (!so) throw new NotFoundException('Sales Order not found');
    return so;
  }

  async getSalesOrderStockStatus(id: string) {
    const so = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
          orderBy: { createdAt: 'asc' },
        },
        quotation: true,
      },
    });

    if (!so) throw new NotFoundException('Sales Order not found');

    const masterDispatchDate = so.quotation?.dispatchDate;
    if (!masterDispatchDate) return [];

    const statuses = await Promise.all(
      so.items.map(async (item) => {
        const product = item.product;
        if (!product) return null;

        const ledgerTransactions = await this.prisma.stockTransaction.findMany({
          where: { productId: product.id },
          orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        });

        let runningStock = 0;
        let todaysStock = 0;
        let stockOnDispatchDate = 0;

        const today = new Date();
        today.setHours(23, 59, 59, 999);

        for (const tx of ledgerTransactions) {
          if (tx.transactionType === 'IN') runningStock += tx.quantity;
          else if (tx.transactionType === 'OUT') runningStock -= tx.quantity;

          if (tx.date <= today) {
            todaysStock = runningStock;
          }
          if (tx.date <= masterDispatchDate) {
            stockOnDispatchDate = runningStock;
          }
        }

        const requiredQty = item.quantity;
        let status = 'WAITING LIST';
        let statusQty = 0;

        if (stockOnDispatchDate >= requiredQty) {
          status = 'CONFIRM';
          statusQty = requiredQty;
        } else if (stockOnDispatchDate > 0) {
          status = 'PARTIAL';
          statusQty = stockOnDispatchDate;
        }

        return {
          productId: product.id,
          productName: product.name,
          modelNo: product.modelNumber,
          currentQty: requiredQty,
          todaysStock,
          stockOnDispatchDate,
          status,
          statusQty,
        };
      })
    );

    return statuses.filter(Boolean);
  }

  // Quantity Management Methods
  async createQuantityRequest(salesOrderId: string, body: any) {
    const user = userContext.getStore();
    if (!user) throw new UnauthorizedException();

    const request = await this.prisma.quantityChangeRequest.create({
      data: {
        salesOrderId,
        salesOrderItemId: body.salesOrderItemId,
        requestedBy: user.id,
        currentQty: body.currentQty,
        requestedQty: body.requestedQty,
        reason: body.reason,
        status: 'PENDING',
      },
      include: {
        salesOrder: true,
      }
    });

    this.eventsGateway.broadcastEntityUpdate('QUANTITY_REQUEST', salesOrderId);
    return request;
  }

  async getPendingQuantityRequests() {
    return this.prisma.quantityChangeRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        salesOrder: true,
        salesOrderItem: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getQuantityRequestsForSO(salesOrderId: string) {
    return this.prisma.quantityChangeRequest.findMany({
      where: { salesOrderId },
      include: {
        user: true,
        reviewer: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async approveQuantityRequest(salesOrderId: string, requestId: string) {
    const user = userContext.getStore();
    if (user?.role !== 'ADMIN') throw new UnauthorizedException('Only ADMIN can approve requests');

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.quantityChangeRequest.findUnique({
        where: { id: requestId },
        include: { salesOrderItem: true, salesOrder: true }
      });

      if (!request || request.status !== 'PENDING') throw new BadRequestException('Invalid request');

      // 1. Update Request
      await tx.quantityChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedBy: user.id,
          reviewedAt: new Date()
        }
      });

      // 2. Update SalesOrderItem
      const rateNum = Number(request.salesOrderItem.rate);
      const totalAmount = rateNum * request.requestedQty;
      
      const updatedItem = await tx.salesOrderItem.update({
        where: { id: request.salesOrderItemId },
        data: {
          quantity: request.requestedQty,
          totalAmount
        }
      });

      // Recalculate SO Totals
      await this.recalculateSOTotals(salesOrderId, tx);

      // Log Activity
      await tx.salesOrderActivity.create({
        data: {
          salesOrderId,
          action: 'Quantity Reduction Approved',
          changedBy: user.id,
          details: `Approved reduction of ${request.salesOrderItem.productName} from ${request.currentQty} to ${request.requestedQty}`,
        }
      });

      this.eventsGateway.broadcastEntityUpdate('QUANTITY_REQUEST', salesOrderId);
      this.eventsGateway.broadcastEntityUpdate('SALES_ORDER', salesOrderId);
      return request;
    });
  }

  async rejectQuantityRequest(salesOrderId: string, requestId: string) {
    const user = userContext.getStore();
    if (user?.role !== 'ADMIN') throw new UnauthorizedException('Only ADMIN can reject requests');

    const request = await this.prisma.quantityChangeRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedBy: user.id,
        reviewedAt: new Date()
      }
    });

    this.eventsGateway.broadcastEntityUpdate('QUANTITY_REQUEST', salesOrderId);
    return request;
  }

  async validateSOEdit(
    salesOrderId: string,
    changes: any,
    currentUser: any
  ) {
    const isAdmin = currentUser.role === 'ADMIN';

    for (const change of changes.items ?? []) {
      if (change.id) {
        const existing = await this.prisma.salesOrderItem.findUnique({
          where: { id: change.id }
        });
        
        if (existing) {
          const isIncrease = change.quantity > existing.quantity;
          const isDecrease = change.quantity < existing.quantity;
          
          if (!isAdmin) {
            if (isIncrease) {
              throw new ForbiddenException('You do not have permission to increase quantities.');
            }
          }
        }
      } else {
        const isNewItem = true;
        if (!isAdmin && isNewItem) {
          throw new ForbiddenException('You do not have permission to add new products.');
        }
      }
    }

    if (changes.bookingDate && !isAdmin) {
      throw new ForbiddenException('You do not have permission to change the booking date.');
    }

    if (changes.dispatchDate && !isAdmin) {
      const so = await this.prisma.salesOrder.findUnique({
        where: { id: salesOrderId },
        include: { quotation: true }
      });
      if (so && so.quotation && so.quotation.dispatchDate) {
        const isPrepone = new Date(changes.dispatchDate) < new Date(so.quotation.dispatchDate);
        if (isPrepone) {
          await this.createDispatchDateChangeRequest({
            salesOrderId,
            currentDate: so.quotation.dispatchDate,
            requestedDate: changes.dispatchDate,
            requestType: 'PREPONE',
            requestedBy: currentUser.id
          });
          throw new BadRequestException({
            error: 'APPROVAL_REQUIRED',
            message: 'Dispatch date prepone requires Admin approval. Your request has been submitted.'
          });
        }
      }
    }
  }

  async cascadeQtyChangeToSplits(
    salesOrderId: string,
    salesOrderItemId: string,
    oldQty: number,
    newQty: number,
    prisma: Prisma.TransactionClient
  ) {
    const diff = newQty - oldQty;
    if (diff === 0) return null;

    const soItem = await prisma.salesOrderItem.findUnique({
      where: { id: salesOrderItemId },
      select: { quotationItemId: true, productId: true }
    });

    if (!soItem || !soItem.quotationItemId) return null;

    const splitItems = await prisma.dispatchSplitItem.findMany({
      where: { quotationItemId: soItem.quotationItemId },
      include: {
        dispatchSplit: {
          select: { id: true, dispatchDate: true, salesOrderId: true }
        }
      }
    });

    const relevantSplitItems = splitItems.filter(
      si => si.dispatchSplit.salesOrderId === salesOrderId
    );

    relevantSplitItems.sort(
      (a, b) => new Date(b.dispatchSplit.dispatchDate || 0).getTime() - 
                 new Date(a.dispatchSplit.dispatchDate || 0).getTime()
    );

    let remainingDiff = Math.abs(diff);

    for (const splitItem of relevantSplitItems) {
      if (remainingDiff === 0) break;

      if (diff < 0) {
        const canRemove = Math.min(splitItem.quantity, remainingDiff);
        const newSplitQty = splitItem.quantity - canRemove;

        await prisma.dispatchSplitItem.update({
          where: { id: splitItem.id },
          data: { quantity: Math.max(0, newSplitQty) }
        });

        remainingDiff -= canRemove;
      } else {
        await prisma.dispatchSplitItem.update({
          where: { id: splitItem.id },
          data: { quantity: splitItem.quantity + remainingDiff }
        });

        remainingDiff = 0;
      }
    }

    if (diff < 0 && remainingDiff > 0) {
      console.warn(
        `Qty decrease of ${Math.abs(diff)} for item ${salesOrderItemId} ` +
        `exceeded total split allocation by ${remainingDiff}`
      );
    }

    return soItem.productId;
  }

  async createDispatchDateChangeRequest(data: {
    salesOrderId: string;
    currentDate: Date;
    requestedDate: string | Date;
    requestType: string;
    requestedBy: string;
  }) {
    return this.prisma.dispatchDateChangeRequest.create({
      data: {
        salesOrderId: data.salesOrderId,
        currentDate: data.currentDate,
        requestedDate: new Date(data.requestedDate),
        requestType: data.requestType,
        requestedBy: data.requestedBy,
      }
    });
  }

  async getDispatchDateRequests(salesOrderId: string) {
    return this.prisma.dispatchDateChangeRequest.findMany({
      where: { salesOrderId },
      include: { requestedByUser: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async approveDispatchDateRequest(salesOrderId: string, requestId: string) {
    const user = userContext.getStore();
    if (user?.role !== 'ADMIN') throw new UnauthorizedException('Only ADMIN can approve requests');

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.dispatchDateChangeRequest.findUnique({
        where: { id: requestId },
        include: { salesOrder: true }
      });

      if (!request || request.status !== 'PENDING') throw new BadRequestException('Invalid request');

      await tx.dispatchDateChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedBy: user.id,
          reviewedAt: new Date()
        }
      });

      if (request.salesOrder && request.salesOrder.quotationId) {
        await tx.quotation.update({
          where: { id: request.salesOrder.quotationId },
          data: { dispatchDate: request.requestedDate }
        });
      }

      await tx.dispatchSplit.updateMany({
        where: {
          salesOrderId,
          dispatchDate: request.currentDate
        },
        data: { dispatchDate: request.requestedDate }
      });

      await tx.salesOrderActivity.create({
        data: {
          salesOrderId,
          action: 'Dispatch Date Prepone Approved',
          changedBy: user.id,
          details: `Approved dispatch date change from ${request.currentDate.toISOString().split('T')[0]} to ${request.requestedDate.toISOString().split('T')[0]}`,
        }
      });
      
      const so = await tx.salesOrder.findUnique({
        where: { id: salesOrderId },
        include: { items: true }
      });

      for (const item of so?.items || []) {
        if (item.productId) {
          this.eventsGateway.broadcastEntityUpdate('STOCK', item.productId);
        }
      }

      this.eventsGateway.broadcastEntityUpdate('SALES_ORDER', salesOrderId);
      return request;
    });
  }

  async rejectDispatchDateRequest(salesOrderId: string, requestId: string) {
    const user = userContext.getStore();
    if (user?.role !== 'ADMIN') throw new UnauthorizedException('Only ADMIN can reject requests');

    const request = await this.prisma.dispatchDateChangeRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedBy: user.id,
        reviewedAt: new Date()
      }
    });

    this.eventsGateway.broadcastEntityUpdate('SALES_ORDER', salesOrderId);
    return request;
  }

  async directUpdateItems(salesOrderId: string, body: any) {
    const user = userContext.getStore();
    
    await this.validateSOEdit(salesOrderId, body, user);

    return this.prisma.$transaction(async (tx) => {
      const existingItems = await tx.salesOrderItem.findMany({ where: { salesOrderId }});
      if (body.items !== undefined) {
        const items = body.items || [];
        const incomingItemIds = items.filter((i: any) => i.id).map((i: any) => i.id);

        // 1. Delete removed items
        for (const item of existingItems) {
          if (!incomingItemIds.includes(item.id)) {
            await tx.salesOrderItem.delete({ where: { id: item.id } });
          }
        }

        // 2. Auto-supersede pending qty requests
        const pendingRequests = await tx.quantityChangeRequest.findMany({
          where: { salesOrderId, status: 'PENDING' }
        });
        if (pendingRequests.length > 0) {
          await tx.quantityChangeRequest.updateMany({
            where: { salesOrderId, status: 'PENDING' },
            data: { status: 'SUPERSEDED', reviewedBy: user?.id, reviewedAt: new Date() }
          });
          await tx.salesOrderActivity.create({
            data: {
              salesOrderId,
              action: 'Requests Superseded',
              changedBy: user?.id,
              details: `Pending reduction requests superseded by direct edit`,
            }
          });
        }

        const productIdsToBroadcast = new Set<string>();

        // 3. Upsert items
        for (const [index, item] of items.entries()) {
          const rateNum = Number(item.rate);
          const qtyNum = parseInt(item.quantity, 10);
          const totalAmount = rateNum * qtyNum;
          
          if (item.id) {
            const existingItem = existingItems.find(i => i.id === item.id);
            await tx.salesOrderItem.update({
              where: { id: item.id },
              data: { quantity: qtyNum, rate: rateNum, totalAmount, sortOrder: index + 1 }
            });

            if (existingItem && existingItem.quantity !== qtyNum) {
              const productId = await this.cascadeQtyChangeToSplits(
                salesOrderId,
                item.id,
                existingItem.quantity,
                qtyNum,
                tx
              );
              if (productId) productIdsToBroadcast.add(productId);
            }
          } else {
            await tx.salesOrderItem.create({
              data: {
                salesOrderId,
                productId: item.productId,
                productName: item.productName,
                modelNumber: item.modelNumber,
                quantity: qtyNum,
                rate: rateNum,
                mrp: rateNum,
                totalAmount,
                sortOrder: index + 1
              }
            });
            if (item.productId) productIdsToBroadcast.add(item.productId);
          }
        }

        // 4. Recalculate SO Totals
        await this.recalculateSOTotals(salesOrderId, tx);

        for (const productId of productIdsToBroadcast) {
          this.eventsGateway.broadcastEntityUpdate('STOCK', productId);
        }
      }

      // 5. Update Dispatch/Booking Date if provided
      if (body.dispatchDate || body.bookingDate) {
        const so = await tx.salesOrder.findUnique({ where: { id: salesOrderId } });
        if (so && (so as any).quotationId) {
          await tx.quotation.update({
            where: { id: (so as any).quotationId },
            data: {
              ...(body.dispatchDate && { dispatchDate: new Date(body.dispatchDate) }),
              ...(body.bookingDate && { bookingDate: new Date(body.bookingDate) }),
            }
          });
        }
      }

      // 6. Activity Log
      await tx.salesOrderActivity.create({
        data: {
          salesOrderId,
          action: 'Order Edited',
          changedBy: user?.id,
          details: `Directly modified order fields/items`,
        }
      });

      for (const productId of productIdsToBroadcast) {
        this.eventsGateway.broadcastEntityUpdate('STOCK', productId);
      }

      this.eventsGateway.broadcastEntityUpdate('QUANTITY_REQUEST', salesOrderId);
      this.eventsGateway.broadcastEntityUpdate('SALES_ORDER', salesOrderId);
      return { success: true };
    });
  }

  async getStockReserved(salesOrderId: string) {
    const so = await this.prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { splits: true }
    });

    if (!so) return [];

    const splitIds = so.splits.map(s => s.id);

    return this.prisma.stockTransaction.findMany({
      where: {
        referenceId: { in: splitIds },
        referenceType: 'DISPATCH_SPLIT'
      }
    });
  }

  async syncFromQuotation(salesOrderId: string) {
    const so = await this.prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { quotation: { include: { items: true } } }
    });

    if (!so || !so.quotation) {
      throw new NotFoundException('Sales Order or linked Quotation not found');
    }

    const subtotal = so.quotation.subtotal;
    const gstAmount = so.quotation.gstAmount;
    const grandTotal = so.quotation.grandTotal;

    const soNumber = so.quotation.quoteNumber
      .replace('QO', 'SO')
      .replace('Q', 'SO');

    await this.prisma.salesOrder.update({
      where: { id: salesOrderId },
      data: { soNumber, subtotal, gstAmount, grandTotal, needsResync: false }
    });

    await this.prisma.salesOrderItem.deleteMany({
      where: { salesOrderId }
    });

    if (so.quotation.items.length > 0) {
      const salesOrderItemsData = so.quotation.items.map(qi => ({
        salesOrderId: so.id,
        quotationItemId: qi.id,
        productId: qi.productId,
        productName: qi.productName,
        modelNumber: qi.modelNumber,
        quantity: qi.quantity,
        rate: qi.rate,
        mrp: qi.rate,
        totalAmount: qi.totalAmount,
        notes: qi.notes
      }));

      await this.prisma.salesOrderItem.createMany({
        data: salesOrderItemsData
      });
    }

    this.eventsGateway.broadcastEntityUpdate('SALES_ORDER', salesOrderId);
    return { success: true, message: 'Synced from quotation' };
  }

  private async recalculateSOTotals(salesOrderId: string, tx: Prisma.TransactionClient) {
    const so = await tx.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { quotation: true }
    });
    if (!so) return;

    const items = await tx.salesOrderItem.findMany({ where: { salesOrderId } });
    const subtotal = items.reduce((sum, item) => sum + Number(item.totalAmount), 0);
    const gstRate = so.quotation ? Number(so.quotation.gstRate) : 18;
    const gstAmount = subtotal * (gstRate / 100);
    const grandTotal = subtotal + gstAmount;

    await tx.salesOrder.update({
      where: { id: salesOrderId },
      data: { subtotal, gstAmount, grandTotal }
    });
  }
}
