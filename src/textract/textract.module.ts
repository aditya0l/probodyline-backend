import { Module } from '@nestjs/common';
import { TextractService } from './textract.service';
import { DocumentParserService } from './document-parser.service';

@Module({
  providers: [TextractService, DocumentParserService],
  exports: [TextractService, DocumentParserService],
})
export class TextractModule {}
