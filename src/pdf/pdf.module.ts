import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { QuotationsModule } from '../quotations/quotations.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [QuotationsModule, CommonModule],
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}

