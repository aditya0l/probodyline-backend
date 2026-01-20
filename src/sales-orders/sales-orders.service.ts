import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class SalesOrdersService {
    constructor(private prisma: PrismaService) { }

    // 1. Ensure Master Sales Order exists (Commercial Entity)
    async ensureMasterSO(quotationId: string) {
        let so = await this.prisma.salesOrder.findUnique({
            where: { quotationId },
        });

        if (!so) {
            const quotation = await this.prisma.quotation.findUnique({
                where: { id: quotationId },
            });
            if (!quotation) throw new NotFoundException('Quotation not found');

            const soNumber = `SO_${quotation.quoteNumber}`; // Simple mapping

            so = await this.prisma.salesOrder.create({
                data: {
                    quotationId,
                    soNumber,
                    subtotal: quotation.subtotal,
                    gstAmount: quotation.gstAmount,
                    grandTotal: quotation.grandTotal,
                },
            });
        }


        // Return with FULL details
        return this.prisma.salesOrder.findUnique({
            where: { id: so.id },
            include: {
                quotation: { include: { items: true } },
                splits: {
                    include: {
                        items: {
                            include: { quotationItem: true },
                            orderBy: { quotationItem: { srNo: 'asc' } }
                        }
                    },
                    orderBy: { splitNumber: 'asc' }
                }
            }
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
            if (split.status === 'BOOKED')
                throw new BadRequestException('Cannot edit a BOOKED split');

            if (updates.dispatchDate) {
                await tx.dispatchSplit.update({
                    where: { id: splitId },
                    data: { dispatchDate: new Date(updates.dispatchDate) },
                });
            }

            if (updates.items) {
                for (const item of updates.items) {
                    await tx.dispatchSplitItem.update({
                        where: { id: item.id },
                        data: { quantity: item.quantity },
                    });
                }
            }

            return this.getSplitWithDetails(splitId, tx);
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
            const finalItems = split.items.filter(i => i.quantity > 0);

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
                        city: split.salesOrder.quotation.clientCity
                    }
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

            return this.getSplitWithDetails(splitId, tx);
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

    async findAll() {
        return this.prisma.salesOrder.findMany({
            include: {
                quotation: true,
                splits: {
                    include: { items: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        return this.prisma.salesOrder.findUnique({
            where: { id },
            include: {
                quotation: { include: { items: true } },
                splits: {
                    include: {
                        items: {
                            include: { quotationItem: true },
                            orderBy: { quotationItem: { srNo: 'asc' } }
                        }
                    },
                    orderBy: { splitNumber: 'asc' }
                }
            }
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
}
