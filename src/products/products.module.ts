import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { QRCodeService } from './qr-code.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, QRCodeService],
  exports: [ProductsService],
})
export class ProductsModule { }

