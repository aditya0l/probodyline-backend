import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard summary analytics' })
  @ApiResponse({ status: 200, description: 'Dashboard summary data' })
  getDashboard() {
    return this.analyticsService.getDashboardSummary();
  }

  @Get('sales-trends')
  @ApiOperation({ summary: 'Get sales trends over time' })
  @ApiQuery({
    name: 'period',
    required: false,
    description: 'Time period',
    enum: ['daily', 'weekly', 'monthly'],
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (ISO string)',
  })
  @ApiResponse({ status: 200, description: 'Sales trends data' })
  getSalesTrends(
    @Query('period') period?: 'daily' | 'weekly' | 'monthly',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getSalesTrends(
      period || 'monthly',
      startDate,
      endDate,
    );
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Get top selling products' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of products to return',
    type: Number,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (ISO string)',
  })
  @ApiResponse({ status: 200, description: 'Top products data' })
  getTopProducts(
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getTopProducts(
      limit ? Number(limit) : 10,
      startDate,
      endDate,
    );
  }

  @Get('top-customers')
  @ApiOperation({ summary: 'Get top customers by sales' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of customers to return',
    type: Number,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (ISO string)',
  })
  @ApiResponse({ status: 200, description: 'Top customers data' })
  getTopCustomers(
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getTopCustomers(
      limit ? Number(limit) : 10,
      startDate,
      endDate,
    );
  }
}
