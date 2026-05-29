import { Controller, Get, Post, Body, Patch, Param, Query } from '@nestjs/common';
import { ChallansService } from './challans.service';
import { CreateChallanDto } from './dto/create-challan.dto';
import { UpdateChallanDto } from './dto/update-challan.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('challans')
@Controller('challans')
export class ChallansController {
  constructor(private readonly challansService: ChallansService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Challan' })
  create(@Body() createChallanDto: CreateChallanDto) {
    return this.challansService.create(createChallanDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all Challans' })
  findAll(@Query() query: { search?: string }) {
    return this.challansService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single Challan by ID' })
  findOne(@Param('id') id: string) {
    return this.challansService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a Challan' })
  update(@Param('id') id: string, @Body() updateChallanDto: UpdateChallanDto) {
    return this.challansService.update(id, updateChallanDto);
  }
}
