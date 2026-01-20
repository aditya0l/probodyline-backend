import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { CreateQuotationItemDto } from './dto/create-quotation-item.dto';
import { UpdateQuotationItemDto } from './dto/update-quotation-item.dto';
import { Quotation, Prisma, StockTransactionType } from '@prisma/client';

@Injectable()
export class QuotationsService {
  constructor(private prisma: PrismaService) { }

  async generateQuoteNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    // Retry logic for race conditions (max 5 attempts)
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        // Use transaction for atomic operation
        return await this.prisma.$transaction(async (tx) => {
          // Find the last quote number for today (with index on quoteNumber, this is fast)
          const lastQuote = await tx.quotation.findFirst({
            where: {
              quoteNumber: {
                startsWith: `Q-${datePrefix}-`,
              },
            },
            orderBy: {
              quoteNumber: 'desc',
            },
            select: {
              quoteNumber: true,
            },
          });

          let sequence = 1;
          if (lastQuote) {
            const lastSequence = parseInt(
              lastQuote.quoteNumber.split('-')[2] || '0',
            );
            sequence = lastSequence + 1;
          }

          const sequenceStr = String(sequence).padStart(3, '0');
          const quoteNumber = `Q-${datePrefix}-${sequenceStr}`;

          // Verify uniqueness (atomic check)
          const existing = await tx.quotation.findUnique({
            where: { quoteNumber },
            select: { id: true },
          });

          if (existing) {
            // If exists, increment and retry
            sequence++;
            const newSequenceStr = String(sequence).padStart(3, '0');
            return `Q-${datePrefix}-${newSequenceStr}`;
          }

          return quoteNumber;
        });
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(
            `Failed to generate unique quote number after ${maxAttempts} attempts`,
          );
        }
        // Wait a small random time before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 100 * attempts),
        );
      }
    }

    throw new Error('Failed to generate quote number');
  }

  async findAll(): Promise<Quotation[]> {
    return this.prisma.quotation.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { id: true, name: true, gymName: true },
        },
        items: {
          orderBy: { srNo: 'asc' },
        },
      },
    });
  }

  async findOne(id: string): Promise<Quotation | null> {
    return this.prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          orderBy: { srNo: 'asc' },
          include: {
            product: {
              select: { id: true, name: true, modelNumber: true },
            },
          },
        },
        salesOrders: {

          orderBy: { soNumber: 'asc' },
        },
      },
    });
  }

  async getRelatedQuotations(quoteNumber: string) {
    // Extract base number (e.g., "22064" from "22064_02" or "Q-20250101-001")
    // Assuming the format is something we can match loosely.
    // The user example "22064" seems to be a custom format or part of the standard.
    // Standard format in schema: Q-YYYYMMDD-XXX
    // If the user manually edits or if we have a "Base ID", we'd use that.
    // For now, let's assume we match loosely on the first segment or the whole string minus suffix.

    // Simplest approach: If quoteNumber has underscores, take the part before the last underscore?
    // User Example: 22064 -> 22064_01 -> 22064_02
    // Base seems to be "22064".

    const base = quoteNumber.includes('_') ? quoteNumber.split('_')[0] : quoteNumber;

    return this.prisma.quotation.findMany({
      where: {
        quoteNumber: {
          startsWith: base
        }
      },
      select: {
        id: true,
        quoteNumber: true,
        createdAt: true,
        status: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
  }

  async create(data: CreateQuotationDto): Promise<Quotation> {
    return this.prisma.$transaction(async (tx) => {
      // Validate items array is not empty
      if (!data.items || data.items.length === 0) {
        throw new BadRequestException('Quotation must have at least one item');
      }

      // Validate items
      // Relaxed validation: Allow 0 rate and quantity
      // Logic handled by DTO @Min(0)

      // Validate items logic removed (previously checked <= 0)

      // Validate GST rate
      if (
        data.gstRate !== undefined &&
        (data.gstRate < 0 || data.gstRate > 100)
      ) {
        throw new BadRequestException('GST rate must be between 0 and 100');
      }

      // Validate customer exists if provided
      if (data.customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: data.customerId },
        });
        if (!customer) {
          throw new NotFoundException('Customer not found');
        }
      }

      // Validate products exist if productId provided
      for (const item of data.items) {
        if (item.productId) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) {
            throw new NotFoundException(
              `Product with ID ${item.productId} not found`,
            );
          }
        }
      }

      // Generate quote number
      const quoteNumber = await this.generateQuoteNumber();

      // Get organization singleton for company info
      const org = await tx.organization.findFirst({
        orderBy: { createdAt: 'asc' },
      });

      if (!org) {
        throw new NotFoundException(
          'Organization not found. Please create an organization first.',
        );
      }

      // Calculate totals
      const subtotal = data.items.reduce(
        (sum, item) => sum + item.rate * item.quantity,
        0,
      );
      const gstRate = data.gstRate || org.defaultGstRate.toNumber();
      const gstAmount = (subtotal * gstRate) / 100;
      const grandTotal = subtotal + gstAmount;

      // Create quotation with nested items
      const quotation = await tx.quotation.create({
        data: {
          quoteNumber,
          customerId: data.customerId,
          status: 'DRAFT',
          // Company info (denormalized)
          companyName: org.name,
          companyAddress: org.address,
          companyLogo: org.logo || null,
          companyGST: org.gst,
          companyPhone: org.phone,
          companyEmail: org.email,
          companyWebsite: org.website,
          companyContactPerson: org.contactPerson,
          // Client info
          clientName: data.clientName,
          clientAddress: data.clientAddress,
          clientCity: data.clientCity,
          gymName: data.gymName,
          gymArea: data.gymArea,
          clientGST: data.clientGST,
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
          leadName: data.leadName || null,
          bookingDate: data.bookingDate ? new Date(data.bookingDate) : null,
          dispatchDate: data.dispatchDate ? new Date(data.dispatchDate) : null,
          installationDate: data.installationDate
            ? new Date(data.installationDate)
            : null,
          inaugurationDate: data.inaugurationDate
            ? new Date(data.inaugurationDate)
            : null,
          // Financial
          subtotal,
          gstRate,
          gstAmount,
          grandTotal,
          // Additional
          bankDetails: org.bankDetails,
          termsAndConditions: org.termsAndConditions,
          warrantyInfo: org.warrantyInfo,
          // Metadata
          template: data.template || 'default',
          visibleColumns: data.visibleColumns || {},
          items: {
            create: data.items.map((item, index) => ({
              srNo: index + 1,
              productId: item.productId || null,
              productName: item.productName,
              productImage: item.productImage || null,
              modelNumber: item.modelNumber || null,
              rate: item.rate,
              quantity: item.quantity,
              totalAmount: item.rate * item.quantity,
              // Denormalized product fields
              priority: item.priority,
              productType: item.productType,
              seriesName: item.seriesName,
              packagingDescription: item.packagingDescription || [],
              keyword: item.keyword || [],
              todaysStock: item.todaysStock,
              stockPlus360Days: item.stockPlus360Days,
              cousinMachine: item.cousinMachine,
              orderTogether: item.orderTogether,
              swapMachine: item.swapMachine,
              category: item.category,
              brand: item.brand,
              warranty: item.warranty,
              notes: item.notes,
            })),
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });

      return quotation;
    });
  }

  async update(id: string, data: UpdateQuotationDto): Promise<Quotation> {
    // If items are being updated, recalculate totals
    if (data.items && data.items.length > 0) {
      return this.prisma.$transaction(async (tx) => {
        const quotation = await tx.quotation.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!quotation) {
          throw new NotFoundException('Quotation not found');
        }

        // Delete existing items
        await tx.quotationItem.deleteMany({
          where: { quotationId: id },
        });

        // Extract items and other fields
        const {
          items,
          deliveryDate,
          bookingDate,
          dispatchDate,
          installationDate,
          inaugurationDate,
          ...updateData
        } = data;
        const itemsToCreate = items!; // Non-null assertion since we checked above

        // Calculate new totals
        const subtotal = itemsToCreate.reduce(
          (sum, item) => sum + item.rate * item.quantity,
          0,
        );
        const gstRate = data.gstRate || quotation.gstRate.toNumber();
        const gstAmount = (subtotal * gstRate) / 100;
        const grandTotal = subtotal + gstAmount;
        return tx.quotation.update({
          where: { id },
          data: {
            ...updateData,
            subtotal,
            gstAmount,
            grandTotal,
            deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
            bookingDate: bookingDate ? new Date(bookingDate) : undefined,
            dispatchDate: dispatchDate ? new Date(dispatchDate) : undefined,
            installationDate: installationDate
              ? new Date(installationDate)
              : undefined,
            inaugurationDate: inaugurationDate
              ? new Date(inaugurationDate)
              : undefined,
            leadName:
              updateData.leadName !== undefined
                ? updateData.leadName
                : undefined,
            items: {
              create: itemsToCreate.map((item, index) => ({
                srNo: index + 1,
                productId: item.productId || null,
                productName: item.productName,
                productImage: item.productImage || null,
                modelNumber: item.modelNumber || null,
                rate: item.rate,
                quantity: item.quantity,
                totalAmount: item.rate * item.quantity,
                priority: item.priority,
                productType: item.productType,
                seriesName: item.seriesName,
                packagingDescription: item.packagingDescription || [],
                keyword: item.keyword || [],
                todaysStock: item.todaysStock,
                stockPlus360Days: item.stockPlus360Days,
                cousinMachine: item.cousinMachine,
                orderTogether: item.orderTogether,
                swapMachine: item.swapMachine,
                category: item.category,
                brand: item.brand,
                warranty: item.warranty,
                notes: item.notes,
              })),
            },
          },
          include: {
            items: true,
            customer: true,
          },
        });
      });
    }

    // Simple update without items
    const {
      items,
      deliveryDate,
      bookingDate,
      dispatchDate,
      installationDate,
      inaugurationDate,
      ...updateData
    } = data;

    const result = await this.prisma.quotation.update({
      where: { id },
      data: {
        ...updateData,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
        bookingDate: bookingDate ? new Date(bookingDate) : undefined,
        dispatchDate: dispatchDate ? new Date(dispatchDate) : undefined,
        installationDate: installationDate
          ? new Date(installationDate)
          : undefined,
        inaugurationDate: inaugurationDate
          ? new Date(inaugurationDate)
          : undefined,
        leadName:
          updateData.leadName !== undefined ? updateData.leadName : undefined,
      },
    });

    // Propagate Dispatch Date to Stock Transactions and Bookings if changed
    if (dispatchDate) {
      const newDispatcherDate = new Date(dispatchDate);

      // Update Stock Transactions (Confirmed PIs)
      await this.prisma.stockTransaction.updateMany({
        where: {
          referenceId: id,
          transactionType: 'OUT', // Ensure we only touch OUT transactions linked to this quote
          // We can check referenceType too, but referenceId is unique enough usually.
          // Safest to check types used: 'QUOTATION' and 'PI_BOOKING'
          referenceType: { in: ['QUOTATION', 'PI_BOOKING'] },
        },
        data: {
          date: newDispatcherDate,
        },
      });

      // Update Bookings
      await this.prisma.booking.updateMany({
        where: {
          quotationId: id,
        },
        data: {
          dispatchDate: newDispatcherDate,
        },
      });
    }

    return result;
  }

  async remove(id: string): Promise<Quotation> {
    // Soft delete
    return this.prisma.quotation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findDeleted(): Promise<Quotation[]> {
    return this.prisma.quotation.findMany({
      where: {
        deletedAt: { not: null },
      },
      orderBy: { deletedAt: 'desc' },
      include: {
        customer: {
          select: { id: true, name: true },
        },
        items: true,
      },
    });
  }

  async restore(id: string): Promise<Quotation> {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (!quotation.deletedAt) {
      throw new BadRequestException('Quotation is not deleted');
    }

    return this.prisma.quotation.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  // Item management
  async addItem(
    quotationId: string,
    item: CreateQuotationItemDto,
  ): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      // Get current item count
      const itemCount = await tx.quotationItem.count({
        where: { quotationId },
      });

      // Create new item
      const newItem = await tx.quotationItem.create({
        data: {
          quotationId,
          srNo: itemCount + 1,
          productId: item.productId || null,
          productName: item.productName,
          productImage: item.productImage || null,
          modelNumber: item.modelNumber || null,
          rate: item.rate,
          quantity: item.quantity,
          totalAmount: item.rate * item.quantity,
          priority: item.priority,
          productType: item.productType,
          seriesName: item.seriesName,
          packagingDescription: item.packagingDescription || [],
          keyword: item.keyword || [],
          todaysStock: item.todaysStock,
          stockPlus360Days: item.stockPlus360Days,
          cousinMachine: item.cousinMachine,
          orderTogether: item.orderTogether,
          swapMachine: item.swapMachine,
          category: item.category,
          brand: item.brand,
          warranty: item.warranty,
          notes: item.notes,
        },
      });

      // Recalculate quotation totals
      await this.recalculateTotals(tx, quotationId);

      return newItem;
    });
  }

  async updateItem(
    quotationId: string,
    itemId: string,
    data: UpdateQuotationItemDto,
  ): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.quotationItem.update({
        where: { id: itemId },
        data: {
          ...data,
          totalAmount:
            data.rate && data.quantity ? data.rate * data.quantity : undefined,
        },
      });

      // Recalculate quotation totals
      await this.recalculateTotals(tx, quotationId);

      return updatedItem;
    });
  }

  async removeItem(quotationId: string, itemId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Delete item
      await tx.quotationItem.delete({
        where: { id: itemId },
      });

      // Recalculate srNo for remaining items
      const remainingItems = await tx.quotationItem.findMany({
        where: { quotationId },
        orderBy: { createdAt: 'asc' },
      });

      for (let i = 0; i < remainingItems.length; i++) {
        await tx.quotationItem.update({
          where: { id: remainingItems[i].id },
          data: { srNo: i + 1 },
        });
      }

      // Recalculate totals
      await this.recalculateTotals(tx, quotationId);
    });
  }

  private async recalculateTotals(
    tx: Prisma.TransactionClient,
    quotationId: string,
  ): Promise<void> {
    const items = await tx.quotationItem.findMany({
      where: { quotationId },
    });

    const subtotal = items.reduce(
      (sum, item) => sum + item.totalAmount.toNumber(),
      0,
    );
    const quotation = await tx.quotation.findUnique({
      where: { id: quotationId },
    });

    if (!quotation) return;

    const gstRate = quotation.gstRate.toNumber();
    const gstAmount = (subtotal * gstRate) / 100;
    const grandTotal = subtotal + gstAmount;

    await tx.quotation.update({
      where: { id: quotationId },
      data: {
        subtotal,
        gstAmount,
        grandTotal,
      },
    });
  }

  async updateStatus(id: string, status: string): Promise<Quotation> {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    // Update quotation status (no stock transactions here - only in confirmPI)
    return this.prisma.quotation.update({
      where: { id },
      data: { status: status as any },
    });
  }

  /**
   * Convert quotation to PI (Proforma Invoice)
   * Sets status to DRAFT (PI status) and marks original as CONVERTED
   */
  async convertToPI(id: string): Promise<Quotation> {
    return this.prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findUnique({
        where: { id },
      });

      if (!quotation) {
        throw new NotFoundException('Quotation not found');
      }

      if (quotation.status === 'CONVERTED') {
        throw new BadRequestException('Quotation is already converted to PI');
      }

      // Update quotation status to DRAFT (PI status)
      return tx.quotation.update({
        where: { id },
        data: {
          status: 'DRAFT', // PI starts as DRAFT
        },
      });
    });
  }

  /**
   * Confirm PI and create bookings/stock events
   * Sets PI status to CONFIRMED and creates booking records and stock OUT transactions
   */
  async confirmPI(id: string): Promise<Quotation> {
    return this.prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!quotation) {
        throw new NotFoundException('Quotation/PI not found');
      }

      if (quotation.status === 'CONFIRMED') {
        throw new BadRequestException('PI is already confirmed');
      }

      if (quotation.status !== 'DRAFT') {
        throw new BadRequestException('Only DRAFT PI can be confirmed');
      }

      // Get all items with products and positive quantity (skip 0 quantity items)
      const itemsWithProducts = quotation.items.filter(
        (item) => item.productId && item.quantity > 0,
      );

      if (itemsWithProducts.length === 0) {
        throw new BadRequestException('PI has no items to confirm');
      }

      // Create stock OUT transactions and bookings for each item
      const dispatchDatePromises = itemsWithProducts.map(async (item) => {
        const dispatchDate = quotation.dispatchDate || new Date();

        // Create stock OUT transaction (event-based)
        await tx.stockTransaction.create({
          data: {
            productId: item.productId!,
            transactionType: 'OUT',
            quantity: -item.quantity, // Negative for OUT
            referenceType: 'PI_BOOKING',
            referenceId: quotation.id,
            date: dispatchDate,
            notes: `Stock OUT for PI ${quotation.quoteNumber} - Item ${item.productName}`,
          },
        });

        // Get product details for booking
        const product = await tx.product.findUnique({
          where: { id: item.productId! },
        });

        if (!product) {
          throw new NotFoundException(`Product ${item.productId} not found`);
        }

        // Calculate stock on dispatch date
        const dateKey = dispatchDate.toISOString().split('T')[0];
        let baseStock = product.todaysStock || 0;

        // If stockByDate exists and has this date, use it
        if (product.stockByDate && typeof product.stockByDate === 'object') {
          const stockByDate = product.stockByDate as Record<string, number>;
          if (stockByDate[dateKey] !== undefined) {
            baseStock = stockByDate[dateKey];
          }
        }

        // Get existing confirmed bookings for this product/date
        const existingBookings = await tx.booking.findMany({
          where: {
            productId: item.productId!,
            dispatchDate,
            status: 'CONFIRM',
          },
        });

        const allocatedStock = existingBookings.reduce(
          (sum, b) => sum + b.requiredQuantity,
          0,
        );

        const availableStock = Math.max(0, baseStock - allocatedStock);

        // Determine booking status
        let bookingStatus: 'CONFIRM' | 'WAITING_LIST' = 'CONFIRM';
        let waitingQuantity = 0;

        if (availableStock < item.quantity) {
          bookingStatus = 'WAITING_LIST';
          waitingQuantity = item.quantity - Math.max(0, availableStock);
        }

        // Create booking record
        await tx.booking.create({
          data: {
            quotationId: quotation.id,
            quotationItemId: item.id,
            quoteNumber: quotation.quoteNumber,
            productId: item.productId!,
            productName: item.productName,
            productThumbnail: item.productImage,
            modelNumber: item.modelNumber,
            dispatchDate,
            bookedOn: new Date(),
            customerName: quotation.clientName,
            gymName: quotation.gymName,
            requiredQuantity: item.quantity,
            status: bookingStatus,
            waitingQuantity,
            stateCode: null, // Can be added if available in quotation
            city: quotation.clientCity,
          },
        });
      });

      await Promise.all(dispatchDatePromises);

      // Update PI status to CONFIRMED
      const confirmedQuotation = await tx.quotation.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
        },
        include: {
          items: true,
          customer: true,
        },
      });

      // SYNC: Update 'todaysStock' on the Product model for all affected products
      // We do this after creating transactions to ensure strict consistency
      for (const item of itemsWithProducts) {
        const stockResult = await tx.stockTransaction.aggregate({
          where: { productId: item.productId! },
          _sum: { quantity: true },
        });
        const currentStock = stockResult._sum.quantity || 0;
        await tx.product.update({
          where: { id: item.productId! },
          data: { todaysStock: currentStock },
        });
      }

      return confirmedQuotation;
    });
  }
}
