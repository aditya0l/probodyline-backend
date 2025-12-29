import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) { }

  /**
   * Create a new booking manually
   */
  async create(data: any): Promise<any> {
    // Validate product exists
    const product = await this.prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${data.productId} not found`);
    }

    // Determine allocation status based on stock
    const dispatchDate = new Date(data.dispatchDate);
    const stockOnDate = await this.getStockOnDate(data.productId, dispatchDate);
    const requiredQty = data.requiredQuantity || 1;

    let status: BookingStatus = BookingStatus.CONFIRM;
    let waitingQuantity = 0;

    if (stockOnDate < requiredQty) {
      status = BookingStatus.WAITING_LIST;
      waitingQuantity = requiredQty - Math.max(0, stockOnDate);
    }

    // Create booking
    const booking = await this.prisma.booking.create({
      data: {
        quotationId: data.quotationId,
        quotationItemId: data.quotationItemId,
        quoteNumber: data.quoteNumber,
        productId: data.productId,
        productName: product.name,
        productThumbnail: product.thumbnail,
        modelNumber: product.modelNumber,
        dispatchDate,
        bookedOn: new Date(),
        customerName: data.customerName,
        gymName: data.gymName,
        requiredQuantity: requiredQty,
        status,
        waitingQuantity,
        stateCode: data.stateCode,
        city: data.city,
      },
    });

    return booking;
  }

  /**
   * Get all bookings with optional filters
   */
  async findAll(filters?: {
    search?: string;
    status?: string;
    dispatchDateFrom?: string;
    dispatchDateTo?: string;
    productModel?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number }> {
    const page = filters?.page ?? 0;
    const limit = filters?.limit ?? 1000;
    const skip = page * limit;

    // Build where clause
    const where: any = {};

    if (filters?.search) {
      where.OR = [
        { quoteNumber: { contains: filters.search, mode: 'insensitive' } },
        { modelNumber: { contains: filters.search, mode: 'insensitive' } },
        { customerName: { contains: filters.search, mode: 'insensitive' } },
        { gymName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.status && filters.status !== 'ALL') {
      // Convert "WAITING LIST" to "WAITING_LIST" for enum
      const statusEnum = filters.status === 'WAITING LIST' ? 'WAITING_LIST' : filters.status;
      where.status = statusEnum;
    }

    if (filters?.dispatchDateFrom) {
      where.dispatchDate = {
        ...where.dispatchDate,
        gte: new Date(filters.dispatchDateFrom),
      };
    }

    if (filters?.dispatchDateTo) {
      where.dispatchDate = {
        ...where.dispatchDate,
        lte: new Date(filters.dispatchDateTo),
      };
    }

    if (filters?.productModel) {
      where.modelNumber = { contains: filters.productModel, mode: 'insensitive' };
    }

    // Execute query
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { dispatchDate: 'asc' },
          { bookedOn: 'asc' },
        ],
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data: bookings, total };
  }

  /**
   * Get a single booking by ID
   */
  async findOne(id: string): Promise<any> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    return booking;
  }

  /**
   * Update a booking
   */
  async update(id: string, data: any): Promise<any> {
    // Verify booking exists
    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    // Update booking
    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        dispatchDate: data.dispatchDate ? new Date(data.dispatchDate) : undefined,
        requiredQuantity: data.requiredQuantity,
        status: data.status,
        waitingQuantity: data.waitingQuantity,
        customerName: data.customerName,
        gymName: data.gymName,
        stateCode: data.stateCode,
        city: data.city,
      },
    });

    return updated;
  }

  /**
   * Delete a booking
   */
  async remove(id: string): Promise<any> {
    // Verify booking exists
    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    // Delete booking
    await this.prisma.booking.delete({
      where: { id },
    });

    return { message: 'Booking deleted successfully' };
  }

  /**
   * Get allocation status for a product (all dates)
   */
  async getAllocationStatus(productId: string): Promise<any> {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    // Get all bookings for this product
    const bookings = await this.prisma.booking.findMany({
      where: { productId },
      orderBy: [
        { dispatchDate: 'asc' },
        { bookedOn: 'asc' },
      ],
    });

    // Group by dispatch date
    const allocationByDate = bookings.reduce((acc, booking) => {
      const dateKey = booking.dispatchDate.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          totalConfirmed: 0,
          totalWaiting: 0,
          bookings: [],
        };
      }

      if (booking.status === BookingStatus.CONFIRM) {
        acc[dateKey].totalConfirmed += booking.requiredQuantity;
      } else {
        acc[dateKey].totalWaiting += booking.waitingQuantity;
      }

      acc[dateKey].bookings.push(booking);
      return acc;
    }, {} as Record<string, any>);

    return {
      productId,
      productName: product.name,
      modelNumber: product.modelNumber,
      allocationByDate: Object.values(allocationByDate),
    };
  }

  /**
   * Get booking allocation details for a specific product and date
   */
  async getBookingAllocation(productId: string, selectedDate: string): Promise<any> {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    // Get stock on selected date
    const stockOnDate = await this.getStockOnDate(productId, new Date(selectedDate));

    // Get all bookings for this product on this date
    const bookings = await this.prisma.booking.findMany({
      where: {
        productId,
        dispatchDate: new Date(selectedDate),
      },
      orderBy: [
        { bookedOn: 'asc' }, // Priority order
      ],
    });

    // Calculate totals
    const totalConfirmedQuantity = bookings
      .filter(b => b.status === BookingStatus.CONFIRM)
      .reduce((sum, b) => sum + b.requiredQuantity, 0);

    const totalWaitingQuantity = bookings
      .filter(b => b.status === BookingStatus.WAITING_LIST)
      .reduce((sum, b) => sum + b.waitingQuantity, 0);

    // Transform bookings to allocation rows
    const allocations = bookings.map(booking => ({
      dispatchDate: booking.dispatchDate.toISOString().split('T')[0],
      quotationId: booking.quotationId,
      quoteNumber: booking.quoteNumber,
      bookedOn: booking.bookedOn.toISOString(),
      customerName: booking.customerName,
      gymName: booking.gymName,
      stateCode: booking.stateCode,
      city: booking.city,
      requiredQuantity: booking.requiredQuantity,
      availableStockAtBooking: stockOnDate, // Simplified - should calculate at booking time
      status: booking.status === BookingStatus.CONFIRM ? 'CONFIRM' : 'WAITING LIST',
      waitingQuantity: booking.waitingQuantity,
    }));

    return {
      productId,
      productName: product.name,
      productThumbnail: product.thumbnail,
      modelNumber: product.modelNumber,
      selectedDate,
      stockOnSelectedDate: stockOnDate,
      totalConfirmedQuantity,
      totalWaitingQuantity,
      allocations,
    };
  }

  /**
   * Create booking from PI item (when PI is confirmed)
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
    return this.create({
      quotationId,
      quotationItemId,
      productId,
      quoteNumber,
      dispatchDate,
      requiredQuantity: quantity,
      customerName,
      gymName,
      stateCode,
      city,
    });
  }

  /**
   * Get filter options for bookings UI
   */
  async getFilterOptions(): Promise<any> {
    // Get unique statuses (from enum)
    const statuses = ['CONFIRM', 'WAITING LIST'];

    // Get unique product models
    const products = await this.prisma.booking.findMany({
      where: {
        modelNumber: { not: null },
      },
      select: {
        modelNumber: true,
      },
      distinct: ['modelNumber'],
    });

    const models = products
      .map(p => p.modelNumber)
      .filter(Boolean) as string[];

    return {
      statuses,
      models,
    };
  }

  /**
   * Helper: Get available stock for a product on a specific date
   */
  private async getStockOnDate(productId: string, date: Date): Promise<number> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return 0;
    }

    // Get base stock from stockByDate
    const dateKey = date.toISOString().split('T')[0];
    let baseStock = product.todaysStock || 0;

    // If stockByDate exists and has this date, use it
    if (product.stockByDate && typeof product.stockByDate === 'object') {
      const stockByDate = product.stockByDate as Record<string, number>;
      if (stockByDate[dateKey] !== undefined) {
        baseStock = stockByDate[dateKey];
      }
    }

    // Subtract confirmed bookings for this date
    const confirmedBookings = await this.prisma.booking.findMany({
      where: {
        productId,
        dispatchDate: date,
        status: BookingStatus.CONFIRM,
      },
    });

    const allocatedStock = confirmedBookings.reduce(
      (sum, b) => sum + b.requiredQuantity,
      0
    );

    return Math.max(0, baseStock - allocatedStock);
  }
}
