import { Module } from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { SalesOrdersModule } from '../sales-orders/sales-orders.module';
import { QuotationsController } from './quotations.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule, SalesOrdersModule],
  controllers: [QuotationsController],
  providers: [QuotationsService],
  exports: [QuotationsService],
})
export class QuotationsModule { }
