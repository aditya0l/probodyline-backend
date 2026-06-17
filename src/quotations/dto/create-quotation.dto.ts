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
import { ClientInfoDto } from './client-info.dto';

export class CreateQuotationDto {
  @ApiPropertyOptional({
    description: 'Customer UUID (if existing customer)',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Array of client details',
    type: [ClientInfoDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientInfoDto)
  clients?: ClientInfoDto[];

  @ApiPropertyOptional({
    description: 'Delivery date (ISO string)',
    example: '2024-12-31T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @ApiPropertyOptional({ description: 'Lead name', example: 'John Doe Lead' })
  @IsOptional()
  @IsString()
  leadName?: string;

  @ApiPropertyOptional({
    description: 'Booking date (ISO string with time)',
    example: '2024-12-24T15:08:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  bookingDate?: string;

  @ApiPropertyOptional({
    description: 'Dispatch date (ISO string)',
    example: '2024-12-31T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dispatchDate?: string;

  @ApiPropertyOptional({
    description: 'Installation date (ISO string)',
    example: '2025-01-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  installationDate?: string;

  @ApiPropertyOptional({
    description: 'Inauguration date (ISO string)',
    example: '2025-01-20T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  inaugurationDate?: string;

  @ApiProperty({
    description: 'Quotation items array',
    type: [CreateQuotationItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items: CreateQuotationItemDto[];

  @ApiPropertyOptional({
    description: 'GST rate percentage',
    example: 18,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  gstRate?: number;

  @ApiPropertyOptional({ description: 'Quotation notes', example: 'Special discount applied.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'PDF template type',
    enum: ['default', 'wholesale', 'retail', 'loading', 'price-list'],
    example: 'default',
  })
  @IsOptional()
  @IsString()
  template?: string; // default, wholesale, retail, loading, price-list

  @ApiPropertyOptional({
    description: 'Column visibility settings',
    type: 'object',
    additionalProperties: { type: 'boolean' },
  })
  @IsOptional()
  visibleColumns?: Record<string, boolean>;
}
