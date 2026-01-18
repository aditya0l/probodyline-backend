import { PartialType } from '@nestjs/mapped-types';
import { CreateQuotationDto } from './create-quotation.dto';
import { IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateQuotationItemDto } from './create-quotation-item.dto';

export class UpdateQuotationDto extends PartialType(CreateQuotationDto) {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items?: CreateQuotationItemDto[];
}
