import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { BookingStatus, StockTransactionType } from '@prisma/client';
import { StockService } from '../stock/stock.service';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
  ) {}

  /**
   * Get all bookings with optional filters
   */
  async findAll(filters?: {
    search?: string;
    status?: BookingStatus | 'ALL';
    dispatchDateFrom?: string;
    dispatchDateTo?: string;
    productModel?: string;
  }): Promise<any[]> {
    const where: any = {};

    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }

    if (filters?.dispatchDateFrom || filters?.dispatchDateTo) {
      where.dispatchDate = {};
      if (filters.dispatchDateFrom) {
        where.dispatchDate.gte = new Date(filters.dispatchDateFrom);
      }
      if (filters.dispatchDateTo) {
        where.dispatchDate.lte = new Date(filters.dispatchDateTo);
      }
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            modelNumber: true,
            thumbnail: true,
          },
        },
        quotation: {
          select: {
            id: true,
            quoteNumber: true,
            clientName: true,
            gymName: true,
            stateCode: true,
            city: true,
          },
        },
      },
      orderBy: [
        { dispatchDate: 'asc' },
        { bookedOn: 'asc' },
      ],
    });

    // Apply product model filter if provided
    if (filters?.productModel) {
      return bookings.filter(b => 
        b.product?.modelNumber?.toLowerCase().includes(filters.productModel!.toLowerCase())
      );
    }

    return bookings;
  }

  /**
   * Get booking allocation details for a specific product
   * This computes allocation based on dispatch date and bookedOn timestamp
   */
  async getBookingAllocation(
    productId: string,
    selectedDate: string,
  ): Promise<any> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        thumbnail: true,
        modelNumber: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Get stock on selected date
    const stockOnSelectedDate = await this.stockService.getStockOnDate(
      productId,
      selectedDate,
    );

    // Get all bookings for this product on or before the selected date, ordered by dispatchDate and bookedOn
    const bookings = await this.prisma.booking.findMany({
      where: {
        productId,
        dispatchDate: {
          lte: new Date(selectedDate),
        },
      },
      include: {
        quotation: {
          select: {
            id: true,
            quoteNumber: true,
            clientName: true,
            gymName: true,
            stateCode: true,
            city: true,
          },
        },
      },
      orderBy: [
        { dispatchDate: 'asc' },
        { bookedOn: 'asc' },
      ],
    });

    // Compute allocations
    let availableStock = stockOnSelectedDate;
    const allocations: any[] = [];
    let totalConfirmedQuantity = 0;
    let totalWaitingQuantity = 0;

    for (const booking of bookings) {
      const availableStockAtBooking = availableStock;
      let status: BookingStatus;
      let waitingQuantity = 0;

      if (availableStock >= booking.requiredQuantity) {
        // Fully confirmed
        status = BookingStatus.CONFIRM;
        availableStock -= booking.requiredQuantity;
        totalConfirmedQuantity += booking.requiredQuantity;
      } else if (availableStock > 0) {
        // Partially confirmed
        const confirmedQty = availableStock;
        waitingQuantity = booking.requiredQuantity - confirmedQty;
        status = BookingStatus.WAITING_LIST;
        availableStock = 0;
        totalConfirmedQuantity += confirmedQty;
        totalWaitingQuantity += waitingQuantity;
      } else {
        // Fully waiting
        status = BookingStatus.WAITING_LIST;
        waitingQuantity = booking.requiredQuantity;
        totalWaitingQuantity += waitingQuantity;
      }

      allocations.push({
        dispatchDate: booking.dispatchDate.toISOString().split('T')[0],
        quotationId: booking.quotationId,
        quoteNumber: booking.quoteNumber,
        bookedOn: booking.bookedOn.toISOString(),
        customerName: booking.customerName,
        gymName: booking.gymName,
        stateCode: booking.stateCode,
        city: booking.city,
        requiredQuantity: booking.requiredQuantity,
        availableStockAtBooking,
        status,
        waitingQuantity,
      });
    }

    return {
      productId: product.id,
      productName: product.name,
      productThumbnail: product.thumbnail,
      modelNumber: product.modelNumber,
      selectedDate,
      stockOnSelectedDate,
      totalConfirmedQuantity,
      totalWaitingQuantity,
      allocations,
    };
  }

  /**
   * Create booking from PI item (called when PI is confirmed)
   */
  async createBookingFromPI(
    quotationId: string,
    quotationItemId: string,
    productId: string,
    quoteNumber: string,
    dispatchDate: string,
    quantity: number,
    customerName?: string | null,
    gymName?: string | null,
    stateCode?: string | null,
    city?: string | null,
  ): Promise<any> {
    // Verify quotation and item exist
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        items: {
          where: { id: quotationItemId },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (quotation.items.length === 0) {
      throw new NotFoundException('Quotation item not found');
    }

    const item = quotation.items[0];

    // Create booking
    const booking = await this.prisma.booking.create({
      data: {
        quotationId,
        quotationItemId,
        productId,
        quoteNumber,
        dispatchDate: new Date(dispatchDate),
        bookedOn: new Date(), // Current timestamp for priority
        customerName: customerName || quotation.clientName || null,
        gymName: gymName || quotation.gymName || null,
        stateCode: stateCode || quotation.city ? null : null, // Extract from quotation if needed
        city: city || quotation.clientCity || null,
        requiredQuantity: quantity,
        status: BookingStatus.WAITING_LIST, // Will be computed by allocation logic
        waitingQuantity: quantity, // Initial value, will be computed by allocation logic
      },
      include: {
        product: true,
        quotation: true,
      },
    });

    return booking;
  }

  /**
   * Get booking status for a PI item
   */
  async getBookingStatusByPIItem(quotationItemId: string): Promise<any> {
    const bookings = await this.prisma.booking.findMany({
      where: { quotationItemId },
      include: {
        product: true,
      },
      orderBy: { bookedOn: 'asc' },
    });

    if (bookings.length === 0) {
      return null;
    }

    // Get the latest booking for this item
    const booking = bookings[0];

    // Compute current status by checking allocation
    const allocation = await this.getBookingAllocation(
      booking.productId,
      booking.dispatchDate.toISOString().split('T')[0],
    );

    // Find this booking in allocations
    const bookingAllocation = allocation.allocations.find(
      (a: any) => a.quotationId === booking.quotationId,
    );

    return bookingAllocation || {
      status: booking.status,
      waitingQuantity: booking.waitingQuantity,
    };
  }

  /**
   * Get filter options for bookings
   */
  async getFilterOptions(): Promise<any> {
    const [statuses, models] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['status'],
      }),
      this.prisma.product.findMany({
        where: {
          bookings: {
            some: {},
          },
        },
        select: {
          modelNumber: true,
        },
        distinct: ['modelNumber'],
      }),
    ]);

    return {
      statuses: statuses.map(s => s.status),
      models: models.map(m => m.modelNumber).filter(Boolean),
    };
  }
}

