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
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ManagersService } from './managers.service';
import { CreateManagerDto } from './dto/create-manager.dto';
import { UpdateManagerDto } from './dto/update-manager.dto';

@ApiTags('managers')
@Controller('managers')
export class ManagersController {
  constructor(private readonly managersService: ManagersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new manager' })
  @ApiResponse({ status: 201, description: 'Manager created successfully' })
  create(@Body() createManagerDto: CreateManagerDto) {
    return this.managersService.create(createManagerDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all managers' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.managersService.findAll({ search, page: Number(page) || 0, limit: Number(limit) || 50 });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get manager by ID' })
  @ApiResponse({ status: 200, description: 'Manager found' })
  @ApiResponse({ status: 404, description: 'Manager not found' })
  findOne(@Param('id') id: string) {
    return this.managersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update manager' })
  @ApiResponse({ status: 200, description: 'Manager updated successfully' })
  @ApiResponse({ status: 404, description: 'Manager not found' })
  update(@Param('id') id: string, @Body() updateManagerDto: UpdateManagerDto) {
    return this.managersService.update(id, updateManagerDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete manager' })
  @ApiResponse({ status: 200, description: 'Manager deleted successfully' })
  @ApiResponse({ status: 404, description: 'Manager not found' })
  remove(@Param('id') id: string) {
    return this.managersService.remove(id);
  }
}
