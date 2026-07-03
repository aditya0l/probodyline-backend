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
  @ApiQuery({ name: 'search', required: false, type: String })
  findUnbooked(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.salesOrdersService.findUnbooked(search, pageNum, limitNum);
  }

  @Post(':id/unbook')
  @ApiOperation({ summary: 'Unbook entire Sales Order' })
  unbookSalesOrder(@Param('id') id: string) {
    return this.salesOrdersService.unbookSalesOrder(id);
  }

  @Post(':id/sync-from-quotation')
  @ApiOperation({ summary: 'Sync Sales Order from current Quotation state' })
  syncFromQuotation(@Param('id') id: string) {
    return this.salesOrdersService.syncFromQuotation(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all Sales Orders' })
  @ApiQuery({ name: 'gymName', required: false, type: String })
  @ApiQuery({ name: 'clientName', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('gymName') gymName?: string,
    @Query('clientName') clientName?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.salesOrdersService.findAll({
      gymName,
      clientName,
      search,
      page: pageNum,
      limit: limitNum,
    });
  }

  @Get(':id/detail')
  @ApiOperation({ summary: 'Get full details of a Sales Order' })
  getSalesOrderDetail(@Param('id') id: string) {
    return this.salesOrdersService.getSalesOrderDetail(id);
  }

  @Get(':id/stock-status')
  @ApiOperation({ summary: 'Get stock allocation status for a Sales Order' })
  getSalesOrderStockStatus(@Param('id') id: string) {
    return this.salesOrdersService.getSalesOrderStockStatus(id);
  }
  @Get('quantity-requests/pending')
  @ApiOperation({ summary: 'Get all pending quantity requests globally' })
  getPendingQuantityRequests() {
    return this.salesOrdersService.getPendingQuantityRequests();
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

  @Patch(':id/generated-date')
  @ApiOperation({ summary: 'Update Sales Order Generated Date (createdAt)' })
  updateGeneratedDate(
    @Param('id') id: string,
    @Body() body: { createdAt: string },
  ) {
    return this.salesOrdersService.updateGeneratedDate(id, body.createdAt);
  }

  // --- Quantity Management ---

  @Post(':id/quantity-requests')
  @ApiOperation({ summary: 'Submit a quantity reduction request' })
  createQuantityRequest(@Param('id') id: string, @Body() body: any) {
    return this.salesOrdersService.createQuantityRequest(id, body);
  }


  @Get(':id/quantity-requests')
  @ApiOperation({ summary: 'Get quantity requests for a specific Sales Order' })
  getQuantityRequestsForSO(@Param('id') id: string) {
    return this.salesOrdersService.getQuantityRequestsForSO(id);
  }

  @Patch(':id/quantity-requests/:requestId/approve')
  @ApiOperation({ summary: 'Approve a quantity request (Admin only)' })
  approveQuantityRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    return this.salesOrdersService.approveQuantityRequest(id, requestId);
  }

  @Patch(':id/quantity-requests/:requestId/reject')
  @ApiOperation({ summary: 'Reject a quantity request (Admin only)' })
  rejectQuantityRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    return this.salesOrdersService.rejectQuantityRequest(id, requestId);
  }

  @Patch(':id/items')
  @ApiOperation({ summary: 'Directly edit Sales Order items (Admin only)' })
  directUpdateItems(@Param('id') id: string, @Body() body: any) {
    return this.salesOrdersService.directUpdateItems(id, body);
  }

  // --- Dispatch Date Change Management ---

  @Post(':id/dispatch-date-requests')
  @ApiOperation({ summary: 'Submit a dispatch date change request' })
  createDispatchDateRequest(@Param('id') id: string, @Body() body: any) {
    return this.salesOrdersService.createDispatchDateChangeRequest({
      salesOrderId: id,
      currentDate: body.currentDate,
      requestedDate: body.requestedDate,
      requestType: body.requestType,
      requestedBy: body.requestedBy,
    });
  }

  @Get(':id/dispatch-date-requests')
  @ApiOperation({ summary: 'Get dispatch date requests for a specific Sales Order' })
  getDispatchDateRequests(@Param('id') id: string) {
    return this.salesOrdersService.getDispatchDateRequests(id);
  }

  @Patch(':id/dispatch-date-requests/:requestId/approve')
  @ApiOperation({ summary: 'Approve a dispatch date request (Admin only)' })
  approveDispatchDateRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    return this.salesOrdersService.approveDispatchDateRequest(id, requestId);
  }

  @Patch(':id/dispatch-date-requests/:requestId/reject')
  @ApiOperation({ summary: 'Reject a dispatch date request (Admin only)' })
  rejectDispatchDateRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    return this.salesOrdersService.rejectDispatchDateRequest(id, requestId);
  }
}
