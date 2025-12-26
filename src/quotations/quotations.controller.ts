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
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { CreateQuotationItemDto } from './dto/create-quotation-item.dto';
import { UpdateQuotationItemDto } from './dto/update-quotation-item.dto';

@ApiTags('quotations')
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new quotation' })
  @ApiResponse({ status: 201, description: 'Quotation successfully created' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiBody({ type: CreateQuotationDto })
  create(@Body() createQuotationDto: CreateQuotationDto) {
    return this.quotationsService.create(createQuotationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all quotations' })
  @ApiResponse({ status: 200, description: 'List of quotations' })
  findAll() {
    return this.quotationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get quotation by ID' })
  @ApiParam({ name: 'id', description: 'Quotation UUID' })
  @ApiResponse({ status: 200, description: 'Quotation found' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  findOne(@Param('id') id: string) {
    return this.quotationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update quotation' })
  @ApiParam({ name: 'id', description: 'Quotation UUID' })
  @ApiResponse({ status: 200, description: 'Quotation successfully updated' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiBody({ type: UpdateQuotationDto })
  update(
    @Param('id') id: string,
    @Body() updateQuotationDto: UpdateQuotationDto,
  ) {
    return this.quotationsService.update(id, updateQuotationDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete quotation' })
  @ApiParam({ name: 'id', description: 'Quotation UUID' })
  @ApiResponse({ status: 200, description: 'Quotation successfully deleted' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  remove(@Param('id') id: string) {
    return this.quotationsService.remove(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update quotation status' })
  @ApiParam({ name: 'id', description: 'Quotation UUID' })
  @ApiResponse({ status: 200, description: 'Status successfully updated' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  @ApiResponse({ status: 400, description: 'Bad request - insufficient stock or validation failed' })
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string', example: 'approved' } } } })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.quotationsService.updateStatus(id, status);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add item to quotation' })
  @ApiParam({ name: 'id', description: 'Quotation UUID' })
  @ApiResponse({ status: 201, description: 'Item successfully added' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiBody({ type: CreateQuotationItemDto })
  addItem(
    @Param('id') quotationId: string,
    @Body() item: CreateQuotationItemDto,
  ) {
    return this.quotationsService.addItem(quotationId, item);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Update quotation item' })
  @ApiParam({ name: 'id', description: 'Quotation UUID' })
  @ApiParam({ name: 'itemId', description: 'Quotation item UUID' })
  @ApiResponse({ status: 200, description: 'Item successfully updated' })
  @ApiResponse({ status: 404, description: 'Quotation or item not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiBody({ type: UpdateQuotationItemDto })
  updateItem(
    @Param('id') quotationId: string,
    @Param('itemId') itemId: string,
    @Body() data: UpdateQuotationItemDto,
  ) {
    return this.quotationsService.updateItem(quotationId, itemId, data);
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Remove item from quotation' })
  @ApiParam({ name: 'id', description: 'Quotation UUID' })
  @ApiParam({ name: 'itemId', description: 'Quotation item UUID' })
  @ApiResponse({ status: 200, description: 'Item successfully removed' })
  @ApiResponse({ status: 404, description: 'Quotation or item not found' })
  removeItem(
    @Param('id') quotationId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.quotationsService.removeItem(quotationId, itemId);
  }

  @Get('deleted')
  @ApiOperation({ summary: 'Get all deleted quotations' })
  @ApiResponse({ status: 200, description: 'List of deleted quotations' })
  findDeleted() {
    return this.quotationsService.findDeleted();
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a deleted quotation' })
  @ApiParam({ name: 'id', description: 'Quotation UUID to restore' })
  @ApiResponse({ status: 200, description: 'Quotation successfully restored' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  @ApiResponse({ status: 400, description: 'Quotation is not deleted' })
  restore(@Param('id') id: string) {
    return this.quotationsService.restore(id);
  }

  @Post(':id/convert-to-pi')
  @ApiOperation({ summary: 'Convert quotation to PI (Proforma Invoice)' })
  @ApiParam({ name: 'id', description: 'Quotation UUID' })
  @ApiResponse({ status: 200, description: 'Quotation successfully converted to PI' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  @ApiResponse({ status: 400, description: 'Quotation is already converted' })
  convertToPI(@Param('id') id: string) {
    return this.quotationsService.convertToPI(id);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm PI and create bookings/stock events' })
  @ApiParam({ name: 'id', description: 'PI UUID' })
  @ApiResponse({ status: 200, description: 'PI successfully confirmed' })
  @ApiResponse({ status: 404, description: 'PI not found' })
  @ApiResponse({ status: 400, description: 'PI cannot be confirmed' })
  confirmPI(@Param('id') id: string) {
    return this.quotationsService.confirmPI(id);
  }
}

