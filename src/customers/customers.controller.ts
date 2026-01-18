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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: 201, description: 'Customer successfully created' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiBody({ type: CreateCustomerDto })
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all customers' })
  @ApiResponse({ status: 200, description: 'List of customers' })
  findAll() {
    return this.customersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer found' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Get(':id/quotations')
  @ApiOperation({ summary: 'Get customer quotations' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer quotations' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  findCustomerQuotations(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update customer' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer successfully updated' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiBody({ type: UpdateCustomerDto })
  update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete customer' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer successfully deleted' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  @Get('deleted')
  @ApiOperation({ summary: 'Get all deleted customers' })
  @ApiResponse({ status: 200, description: 'List of deleted customers' })
  findDeleted() {
    return this.customersService.findDeleted();
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a deleted customer' })
  @ApiParam({ name: 'id', description: 'Customer UUID to restore' })
  @ApiResponse({ status: 200, description: 'Customer successfully restored' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 400, description: 'Customer is not deleted' })
  restore(@Param('id') id: string) {
    return this.customersService.restore(id);
  }
}
