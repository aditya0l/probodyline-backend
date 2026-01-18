import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { CommonModule } from '../common/common.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [CommonModule, StockModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
