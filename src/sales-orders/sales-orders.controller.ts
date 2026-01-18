import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
  Get,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SalesOrdersService } from './sales-orders.service';

@ApiTags('sales-orders')
@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private readonly salesOrdersService: SalesOrdersService) {}

  @Post('split')
  @ApiOperation({ summary: 'Create a new Sales Order split from Quotation' })
  createSplit(
    @Body()
    body: {
      quotationId: string;
      itemIds: string[];
      dispatchDate?: string;
    },
  ) {
    return this.salesOrdersService.createSplit(
      body.quotationId,
      body.itemIds,
      body.dispatchDate,
    );
  }

  @Patch(':id/update-split')
  @ApiOperation({
    summary: 'Update items or date for a Sales Order (if not booked)',
  })
  updateSplit(
    @Param('id') id: string,
    @Body() body: { itemIds: string[]; dispatchDate?: string },
  ) {
    return this.salesOrdersService.updateSplit(
      id,
      body.itemIds,
      body.dispatchDate,
    );
  }

  @Post(':id/book')
  @ApiOperation({ summary: 'Finalize and Book a Sales Order' })
  bookSalesOrder(@Param('id') id: string) {
    return this.salesOrdersService.bookSalesOrder(id);
  }

  @Get('quotation/:quotationId')
  @ApiOperation({ summary: 'Get all Sales Orders for a Quotation' })
  getByQuotation(@Param('quotationId') quotationId: string) {
    return this.salesOrdersService.findByQuotation(quotationId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all Sales Orders' })
  findAll() {
    return this.salesOrdersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single Sales Order' })
  findOne(@Param('id') id: string) {
    return this.salesOrdersService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a Draft Sales Order' })
  deleteSalesOrder(@Param('id') id: string) {
    return this.salesOrdersService.deleteSalesOrder(id);
  }
}
