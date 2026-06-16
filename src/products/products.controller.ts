import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto, UpdateProductMediaDto } from './dto/update-product.dto';
import { BatchOpeningStockDto } from './dto/opening-stock.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product successfully created' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiBody({ type: CreateProductDto })
  create(@Body() createProductDto: CreateProductDto) {
    if (!createProductDto.name || createProductDto.name.trim() === '') {
      throw new BadRequestException('Product name is required');
    }
    return this.productsService.create(createProductDto);
  }

  @Post('opening-stock')
  @ApiOperation({ summary: 'Save batch opening stock for multiple products' })
  @ApiResponse({ status: 200, description: 'Opening stocks successfully updated' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiBody({ type: BatchOpeningStockDto })
  saveOpeningStock(@Body() batchOpeningStockDto: BatchOpeningStockDto) {
    return this.productsService.saveOpeningStock(batchOpeningStockDto);
  }

  @Delete('opening-stock')
  @ApiOperation({ summary: 'Delete all opening stock transactions' })
  @ApiResponse({ status: 200, description: 'Opening stocks successfully cleared' })
  clearAllOpeningStock() {
    return this.productsService.clearAllOpeningStock();
  }

  @Get('media-stats')
  @ApiOperation({ summary: 'Get all products with pre-computed stats for media library' })
  @ApiResponse({ status: 200, description: 'List of products with stats' })
  findAllWithStats() {
    return this.productsService.findAllWithStats();
  }


  @Get()
  @ApiOperation({ summary: 'Get all products with filtering and pagination' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search term for name, model, series, or keywords',
  })
  @ApiQuery({
    name: 'productType',
    required: false,
    description: 'Filter by product type',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filter by category UUID',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (0-indexed)',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page',
    type: Number,
  })
  @ApiResponse({ status: 200, description: 'Paginated list of products' })
  findAll(
    @Query('search') search?: string,
    @Query('productType') productType?: string,
    @Query('categoryId') categoryId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productsService.findAll({
      search,
      productType,
      categoryId,
      page: page ? Number(page) : 0,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product successfully updated' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiBody({ type: UpdateProductDto })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    if (updateProductDto.name !== undefined && (updateProductDto.name === null || updateProductDto.name.trim() === '')) {
      throw new BadRequestException('Product name is required');
    }
    return this.productsService.update(id, updateProductDto);
  }

  @Patch(':id/media')
  @ApiOperation({ summary: 'Update product media links' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product media successfully updated' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiBody({ type: UpdateProductMediaDto })
  updateMedia(@Param('id') id: string, @Body() updateProductMediaDto: UpdateProductMediaDto) {
    return this.productsService.updateMedia(id, updateProductMediaDto);
  }

  @Get(':id/quotations')
  @ApiOperation({ summary: 'Get quotations for a product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'List of quotations containing the product' })
  findQuotationsByProduct(@Param('id') id: string) {
    return this.productsService.findQuotationsByProduct(id);
  }

  @Get(':id/sales-orders')
  @ApiOperation({ summary: 'Get sales orders for a product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'List of sales orders containing the product' })
  findSalesOrdersByProduct(@Param('id') id: string) {
    return this.productsService.findSalesOrdersByProduct(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete product (soft delete)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product successfully deleted' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate an existing product' })
  @ApiParam({ name: 'id', description: 'Product UUID to duplicate' })
  @ApiResponse({ status: 201, description: 'Product successfully duplicated' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  duplicate(@Param('id') id: string) {
    return this.productsService.duplicate(id);
  }

  @Get('deleted')
  @ApiOperation({ summary: 'Get all deleted products' })
  @ApiResponse({ status: 200, description: 'List of deleted products' })
  findDeleted() {
    return this.productsService.findDeleted();
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a deleted product' })
  @ApiParam({ name: 'id', description: 'Product UUID to restore' })
  @ApiResponse({ status: 200, description: 'Product successfully restored' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 400, description: 'Product is not deleted' })
  restore(@Param('id') id: string) {
    return this.productsService.restore(id);
  }

  @Post('sync-stock/:productId')
  @ApiOperation({
    summary: 'Sync stock for a single product from transactions',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Stock successfully synced' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  syncStock(@Param('productId') productId: string) {
    return this.productsService.syncStockFromTransactions(productId);
  }

  @Post('sync-all-stocks')
  @ApiOperation({ summary: 'Sync stock for all products' })
  @ApiResponse({ status: 200, description: 'All stocks successfully synced' })
  syncAllStocks() {
    return this.productsService.syncAllStocks();
  }

  @Patch(':id/dormant')
  @ApiOperation({ summary: 'Toggle dormant status for a product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiBody({
    schema: { type: 'object', properties: { isDormant: { type: 'boolean' } } },
  })
  @ApiResponse({
    status: 200,
    description: 'Dormant status successfully updated',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  toggleDormant(
    @Param('id') id: string,
    @Body('isDormant') isDormant: boolean,
  ) {
    return this.productsService.toggleDormant(id, isDormant);
  }

  @Post('regenerate-all-qrs')
  @ApiOperation({ summary: 'Regenerate QR codes for all products' })
  @ApiResponse({ status: 200, description: 'QRs regenerated successfully' })
  regenerateAllQRs() {
    return this.productsService.regenerateAllQRs();
  }
}
