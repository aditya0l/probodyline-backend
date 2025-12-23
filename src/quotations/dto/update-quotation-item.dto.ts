import { PartialType } from '@nestjs/mapped-types';
import { CreateQuotationItemDto } from './create-quotation-item.dto';
import { IsOptional, IsNumber } from 'class-validator';

export class UpdateQuotationItemDto extends PartialType(CreateQuotationItemDto) {
  @IsOptional()
  @IsNumber()
  rate?: number;

  @IsOptional()
  @IsNumber()
  quantity?: number;
}

