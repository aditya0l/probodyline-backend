import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StockService } from './stock.service';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
import { UpdateStockTransactionDto } from './dto/update-stock-transaction.dto';

@ApiTags('stock')
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post('transactions')
  @ApiOperation({ summary: 'Create a new stock transaction' })
  @ApiResponse({ status: 201, description: 'Stock transaction successfully created' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed or insufficient stock' })
  @ApiBody({ type: CreateStockTransactionDto })
  create(@Body() createStockTransactionDto: CreateStockTransactionDto) {
    return this.stockService.createTransaction(createStockTransactionDto);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get all stock transactions with filtering' })
  @ApiQuery({ name: 'productId', required: false, description: 'Filter by product ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO string)' })
  @ApiQuery({ name: 'transactionType', required: false, description: 'Filter by transaction type (IN, OUT, SALE)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (0-indexed)', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: Number })
  @ApiResponse({ status: 200, description: 'Paginated list of stock transactions' })
  findAll(
    @Query('productId') productId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('transactionType') transactionType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stockService.findAll(productId, {
      startDate,
      endDate,
      transactionType,
      page: page ? Number(page) : 0,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get stock transaction by ID' })
  @ApiParam({ name: 'id', description: 'Stock transaction UUID' })
  @ApiResponse({ status: 200, description: 'Stock transaction found' })
  @ApiResponse({ status: 404, description: 'Stock transaction not found' })
  findOne(@Param('id') id: string) {
    return this.stockService.findOne(id);
  }

  @Get('products/:productId/current')
  @ApiOperation({ summary: 'Get current stock for a product' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Current stock information' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  getCurrentStock(@Param('productId') productId: string) {
    return this.stockService.getCurrentStock(productId);
  }

  @Get('products/:productId/history')
  @ApiOperation({ summary: 'Get stock history for a product' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO string)' })
  @ApiResponse({ status: 200, description: 'Stock history for the product' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  getStockHistory(
    @Param('productId') productId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.stockService.getStockHistory(productId, startDate, endDate);
  }

  @Get('products/low-stock')
  @ApiOperation({ summary: 'Get products with low stock' })
  @ApiQuery({ name: 'threshold', required: false, description: 'Low stock threshold', type: Number })
  @ApiResponse({ status: 200, description: 'List of products with low stock' })
  getLowStockProducts(
    @Query('threshold') threshold?: string,
  ) {
    return this.stockService.getLowStockProducts(
      threshold ? Number(threshold) : 10,
    );
  }

  @Get('products/:productId/projection')
  @Throttle({ default: { limit: 1000, ttl: 60000 } }) // Higher limit for stock projection - frontend makes many concurrent requests
  @ApiOperation({ summary: 'Get comprehensive stock projection for a product' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiQuery({ name: 'selectedDate', required: true, description: 'Selected date in YYYY-MM-DD format' })
  @ApiResponse({ status: 200, description: 'Stock projection data including after-order stock and next IN info' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  getStockProjection(
    @Param('productId') productId: string,
    @Query('selectedDate') selectedDate: string,
  ) {
    return this.stockService.getStockProjection(productId, selectedDate);
  }

  @Patch('transactions/:id')
  @ApiOperation({ summary: 'Update stock transaction' })
  @ApiParam({ name: 'id', description: 'Stock transaction UUID' })
  @ApiResponse({ status: 200, description: 'Stock transaction successfully updated' })
  @ApiResponse({ status: 404, description: 'Stock transaction not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiBody({ type: UpdateStockTransactionDto })
  update(
    @Param('id') id: string,
    @Body() updateStockTransactionDto: UpdateStockTransactionDto,
  ) {
    return this.stockService.update(id, updateStockTransactionDto);
  }

  @Delete('transactions/:id')
  @ApiOperation({ summary: 'Delete stock transaction' })
  @ApiParam({ name: 'id', description: 'Stock transaction UUID' })
  @ApiResponse({ status: 200, description: 'Stock transaction successfully deleted' })
  @ApiResponse({ status: 404, description: 'Stock transaction not found' })
  remove(@Param('id') id: string) {
    return this.stockService.remove(id);
  }
}

