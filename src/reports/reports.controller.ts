import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @ApiOperation({ summary: 'Get sales report' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO string)' })
  @ApiQuery({ name: 'customerId', required: false, description: 'Filter by customer ID' })
  @ApiQuery({ name: 'productId', required: false, description: 'Filter by product ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Comma-separated quotation statuses' })
  @ApiResponse({ status: 200, description: 'Sales report data' })
  getSalesReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('customerId') customerId?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: string, // Comma-separated statuses
  ) {
    return this.reportsService.getSalesReport({
      startDate,
      endDate,
      customerId,
      productId,
      status: status ? status.split(',') : undefined,
    });
  }

  @Get('stock')
  @ApiOperation({ summary: 'Get stock report' })
  @ApiQuery({ name: 'lowStockThreshold', required: false, description: 'Low stock threshold', type: Number })
  @ApiQuery({ name: 'productId', required: false, description: 'Filter by product ID' })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Filter by category ID' })
  @ApiResponse({ status: 200, description: 'Stock report data' })
  getStockReport(
    @Query('lowStockThreshold') lowStockThreshold?: string,
    @Query('productId') productId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.reportsService.getStockReport({
      lowStockThreshold: lowStockThreshold
        ? Number(lowStockThreshold)
        : undefined,
      productId,
      categoryId,
    });
  }

  @Get('quotations')
  @ApiOperation({ summary: 'Get quotation report' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO string)' })
  @ApiResponse({ status: 200, description: 'Quotation report data' })
  getQuotationReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getQuotationReport({
      startDate,
      endDate,
    });
  }

  @Get('financial')
  @ApiOperation({ summary: 'Get financial report' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO string)' })
  @ApiResponse({ status: 200, description: 'Financial report data' })
  getFinancialReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getFinancialReport({
      startDate,
      endDate,
    });
  }
}

