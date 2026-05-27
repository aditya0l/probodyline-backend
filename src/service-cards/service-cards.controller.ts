import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ServiceCardsService } from './service-cards.service';
import { CreateServiceCardDto, UpdateServiceCardDto } from './dto/create-service-card.dto';

@Controller('service-cards')
export class ServiceCardsController {
  constructor(private readonly serviceCardsService: ServiceCardsService) {}

  @Post()
  create(@Body() createDto: CreateServiceCardDto) {
    return this.serviceCardsService.create(createDto);
  }

  @Get()
  findAll() {
    return this.serviceCardsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceCardsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateServiceCardDto) {
    return this.serviceCardsService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceCardsService.remove(id);
  }
}
