import {
  Controller,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Get,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SalesOrdersService } from './sales-orders.service';

@ApiTags('sales-orders')
@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private readonly salesOrdersService: SalesOrdersService) {}

  @Post('master')
  @ApiOperation({ summary: 'Ensure Master Sales Order exists for Quotation' })
  ensureMasterSO(@Body() body: { quotationId: string }) {
    return this.salesOrdersService.ensureMasterSO(body.quotationId);
  }

  @Post(':id/dispatch-split')
  @ApiOperation({ summary: 'Create a new Dispatch Split' })
  createDispatchSplit(@Param('id') id: string) {
    return this.salesOrdersService.createDispatchSplit(id);
  }

  @Patch('dispatch-split/:splitId')
  @ApiOperation({ summary: 'Update Dispatch Split (Quantity/Date)' })
  updateDispatchSplit(
    @Param('splitId') splitId: string,
    @Body()
    body: { dispatchDate?: string; items?: { id: string; quantity: number }[] },
  ) {
    return this.salesOrdersService.updateDispatchSplit(splitId, body);
  }

  @Post('dispatch-split/:splitId/book')
  @ApiOperation({ summary: 'Book a Dispatch Split' })
  bookDispatchSplit(@Param('splitId') splitId: string) {
    return this.salesOrdersService.bookDispatchSplit(splitId);
  }

  @Put(':id/splits/matrix')
  @ApiOperation({ summary: 'Update Matrix Splits' })
  updateMatrixSplits(@Param('id') id: string, @Body() splitsData: any[]) {
    return this.salesOrdersService.updateMatrixSplits(id, splitsData);
  }

  @Delete('dispatch-split/:splitId')
  @ApiOperation({ summary: 'Delete a Dispatch Split' })
  deleteDispatchSplit(@Param('splitId') splitId: string) {
    return this.salesOrdersService.deleteDispatchSplit(splitId);
  }

  @Get('unbooked')
  @ApiOperation({ summary: 'Get unbooked Sales Orders' })
  findUnbooked() {
    return this.salesOrdersService.findUnbooked();
  }

  @Post(':id/unbook')
  @ApiOperation({ summary: 'Unbook entire Sales Order' })
  unbookSalesOrder(@Param('id') id: string) {
    return this.salesOrdersService.unbookSalesOrder(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all Sales Orders' })
  @ApiQuery({ name: 'gymName', required: false, type: String })
  @ApiQuery({ name: 'clientName', required: false, type: String })
  findAll(
    @Query('gymName') gymName?: string,
    @Query('clientName') clientName?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.salesOrdersService.findAll({
      gymName,
      clientName,
      page: pageNum,
      limit: limitNum,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single Master Sales Order with Splits' })
  findOne(@Param('id') id: string) {
    return this.salesOrdersService.findOne(id);
  }

  @Patch(':id/master-date')
  @ApiOperation({ summary: 'Update Master Sales Order Dispatch Date' })
  updateMasterDate(
    @Param('id') id: string,
    @Body() body: { dispatchDate: string },
  ) {
    return this.salesOrdersService.updateMasterDispatchDate(
      id,
      body.dispatchDate,
    );
  }
}
