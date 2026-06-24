import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { FactoriesService } from './factories.service';

@Controller('factories')
export class FactoriesController {
  constructor(private readonly factoriesService: FactoriesService) {}

  @Get()
  findAll() {
    return this.factoriesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.factoriesService.findOne(id);
  }

  @Post()
  create(@Body() data: any) {
    return this.factoriesService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.factoriesService.update(id, data);
  }

  @Get(':id/splits')
  getSplits(@Param('id') id: string) {
    return this.factoriesService.getSplits(id);
  }

  @Post(':id/splits')
  createSplit(@Param('id') id: string, @Body() data: any) {
    return this.factoriesService.createSplit(id, data);
  }
}
