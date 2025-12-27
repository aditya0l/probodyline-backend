import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { CreateLeadDto, LeadStatus } from './dto/create-lead.dto';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new lead' })
  @ApiResponse({ status: 201, description: 'Lead successfully created' })
  @ApiBody({ type: CreateLeadDto })
  create(@Body() createLeadDto: CreateLeadDto) {
    return this.leadsService.create(createLeadDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all leads with filtering and pagination' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, enum: LeadStatus })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(@Query() filters: any) {
    return this.leadsService.findAll({
      search: filters.search,
      status: filters.status,
      source: filters.source,
      page: filters.page ? Number(filters.page) : 0,
      limit: filters.limit ? Number(filters.limit) : 50,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead by ID' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update lead status' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiBody({ schema: { type: 'object', properties: { status: { enum: Object.values(LeadStatus) }, notes: { type: 'string' } } } })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: LeadStatus,
    @Body('notes') notes?: string,
  ) {
    return this.leadsService.updateStatus(id, status, notes);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete lead (soft delete)' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  remove(@Param('id') id: string) {
    return this.leadsService.remove(id);
  }
}


