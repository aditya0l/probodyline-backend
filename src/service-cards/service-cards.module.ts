import { Module } from '@nestjs/common';
import { ServiceCardsService } from './service-cards.service';
import { ServiceCardsController } from './service-cards.controller';

@Module({
  controllers: [ServiceCardsController],
  providers: [ServiceCardsService],
})
export class ServiceCardsModule {}
