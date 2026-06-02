import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  create(@Body() data: any) {
    return this.purchaseOrdersService.create(data);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.purchaseOrdersService.findAll(search, pageNum, limitNum);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.purchaseOrdersService.update(id, data);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.purchaseOrdersService.delete(id);
  }

  @Put(':id/splits/matrix')
  updateMatrixSplits(@Param('id') id: string, @Body() splitsData: any[]) {
    return this.purchaseOrdersService.updateMatrixSplits(id, splitsData);
  }
}
