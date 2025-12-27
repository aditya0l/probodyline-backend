import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';

// TODO: Define BookingStatus enum when Booking model is added to Prisma schema
type BookingStatus = string;

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all bookings with optional filters' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'dispatchDateFrom', required: false })
  @ApiQuery({ name: 'dispatchDateTo', required: false })
  @ApiQuery({ name: 'productModel', required: false })
  @ApiResponse({ status: 200, description: 'List of bookings' })
  findAll(@Query() filters: any) {
    return this.bookingsService.findAll({
      search: filters.search,
      status: filters.status,
      dispatchDateFrom: filters.dispatchDateFrom,
      dispatchDateTo: filters.dispatchDateTo,
      productModel: filters.productModel,
    });
  }

  @Get('allocation/:productId')
  @ApiOperation({ summary: 'Get booking allocation details for a specific product' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiQuery({ name: 'selectedDate', required: true, description: 'Date in YYYY-MM-DD format' })
  @ApiResponse({ status: 200, description: 'Booking allocation details' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  getBookingAllocation(
    @Param('productId') productId: string,
    @Query('selectedDate') selectedDate: string,
  ) {
    return this.bookingsService.getBookingAllocation(productId, selectedDate);
  }

  @Post()
  @ApiOperation({ summary: 'Create booking from PI item' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        quotationId: { type: 'string' },
        quotationItemId: { type: 'string' },
        productId: { type: 'string' },
        quoteNumber: { type: 'string' },
        dispatchDate: { type: 'string' },
        quantity: { type: 'number' },
        customerName: { type: 'string' },
        gymName: { type: 'string' },
        stateCode: { type: 'string' },
        city: { type: 'string' },
      },
      required: ['quotationId', 'quotationItemId', 'productId', 'quoteNumber', 'dispatchDate', 'quantity'],
    },
  })
  @ApiResponse({ status: 201, description: 'Booking successfully created' })
  createBookingFromPI(@Body() data: any) {
    return this.bookingsService.createBookingFromPI(
      data.quotationId,
      data.quotationItemId,
      data.productId,
      data.quoteNumber,
      data.dispatchDate,
      data.quantity,
      data.customerName,
      data.gymName,
      data.stateCode,
      data.city,
    );
  }

  @Get('filters')
  @ApiOperation({ summary: 'Get filter options for bookings' })
  @ApiResponse({ status: 200, description: 'Filter options' })
  getFilterOptions() {
    return this.bookingsService.getFilterOptions();
  }
}


