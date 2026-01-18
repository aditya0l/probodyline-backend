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
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@ApiTags('vendors')
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new vendor' })
  @ApiResponse({ status: 201, description: 'Vendor successfully created' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiBody({ type: CreateVendorDto })
  create(@Body() createVendorDto: CreateVendorDto) {
    return this.vendorsService.create(createVendorDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all vendors' })
  @ApiResponse({ status: 200, description: 'List of vendors' })
  findAll() {
    return this.vendorsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vendor by ID' })
  @ApiParam({ name: 'id', description: 'Vendor UUID' })
  @ApiResponse({ status: 200, description: 'Vendor found' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  findOne(@Param('id') id: string) {
    return this.vendorsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update vendor' })
  @ApiParam({ name: 'id', description: 'Vendor UUID' })
  @ApiResponse({ status: 200, description: 'Vendor successfully updated' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiBody({ type: UpdateVendorDto })
  update(@Param('id') id: string, @Body() updateVendorDto: UpdateVendorDto) {
    return this.vendorsService.update(id, updateVendorDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete vendor' })
  @ApiParam({ name: 'id', description: 'Vendor UUID' })
  @ApiResponse({ status: 200, description: 'Vendor successfully deleted' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  remove(@Param('id') id: string) {
    return this.vendorsService.remove(id);
  }

  @Get('deleted')
  @ApiOperation({ summary: 'Get all deleted vendors' })
  @ApiResponse({ status: 200, description: 'List of deleted vendors' })
  findDeleted() {
    return this.vendorsService.findDeleted();
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a deleted vendor' })
  @ApiParam({ name: 'id', description: 'Vendor UUID to restore' })
  @ApiResponse({ status: 200, description: 'Vendor successfully restored' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  @ApiResponse({ status: 400, description: 'Vendor is not deleted' })
  restore(@Param('id') id: string) {
    return this.vendorsService.restore(id);
  }
}
