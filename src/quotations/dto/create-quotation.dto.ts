import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateQuotationItemDto } from './create-quotation-item.dto';

export class CreateQuotationDto {
  @ApiPropertyOptional({ description: 'Customer UUID (if existing customer)', example: '123e4567-e89b-12d3-a456-426614174001' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Client name', example: 'John Doe' })
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional({ description: 'Client address', example: '123 Main St' })
  @IsOptional()
  @IsString()
  clientAddress?: string;

  @ApiPropertyOptional({ description: 'Client city', example: 'Mumbai' })
  @IsOptional()
  @IsString()
  clientCity?: string;

  @ApiPropertyOptional({ description: 'Gym name', example: 'FitZone Gym' })
  @IsOptional()
  @IsString()
  gymName?: string;

  @ApiPropertyOptional({ description: 'Gym area/location', example: 'Andheri West' })
  @IsOptional()
  @IsString()
  gymArea?: string;

  @ApiPropertyOptional({ description: 'Client GST number', example: '27ABCDE1234F1Z5' })
  @IsOptional()
  @IsString()
  clientGST?: string;

  @ApiPropertyOptional({ description: 'Delivery date (ISO string)', example: '2024-12-31T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @ApiProperty({ description: 'Quotation items array', type: [CreateQuotationItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items: CreateQuotationItemDto[];

  @ApiPropertyOptional({ description: 'GST rate percentage', example: 18, type: Number })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  gstRate?: number;

  @ApiPropertyOptional({ description: 'PDF template type', enum: ['default', 'wholesale', 'retail', 'loading', 'price-list'], example: 'default' })
  @IsOptional()
  @IsString()
  template?: string; // default, wholesale, retail, loading, price-list

  @ApiPropertyOptional({ description: 'Column visibility settings', type: 'object', additionalProperties: { type: 'boolean' } })
  @IsOptional()
  visibleColumns?: Record<string, boolean>;
}

