import { IsString, IsOptional, IsNumber, IsUUID, IsArray, Min, IsPositive, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQuotationItemDto {
  @ApiPropertyOptional({ description: 'Product UUID (if linked to product)', example: '123e4567-e89b-12d3-a456-426614174002' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ description: 'Product name', example: 'Treadmill Pro 5000' })
  @IsString()
  @Length(1, 255)
  productName: string;

  @ApiPropertyOptional({ description: 'Product image (base64 or URL)' })
  @IsOptional()
  @IsString()
  productImage?: string;

  @ApiPropertyOptional({ description: 'Model number', example: 'TM-PRO-5000' })
  @IsOptional()
  @IsString()
  modelNumber?: string;

  @ApiProperty({ description: 'Unit rate/price', example: 50000, type: Number })
  @IsNumber()
  @Min(0)
  rate: number;

  @ApiProperty({ description: 'Quantity', example: 2, type: Number })
  @IsNumber()
  @Min(0)
  quantity: number;

  // Denormalized product fields
  @ApiPropertyOptional({ description: 'Product priority', example: 1, type: Number })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  priority?: number;

  @ApiPropertyOptional({ description: 'Product type', example: 'Cardio' })
  @IsOptional()
  @IsString()
  productType?: string;

  @ApiPropertyOptional({ description: 'Series name', example: 'Professional Series' })
  @IsOptional()
  @IsString()
  seriesName?: string;

  @ApiPropertyOptional({ description: 'Packaging description array', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  packagingDescription?: string[];

  @ApiPropertyOptional({ description: 'Keywords array', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyword?: string[];

  @ApiPropertyOptional({ description: 'Current stock (can be negative)', example: 10, type: Number })
  @IsOptional()
  @IsNumber()
  todaysStock?: number;

  @ApiPropertyOptional({ description: 'Stock plus 360 days (can be negative)', example: 50, type: Number })
  @IsOptional()
  @IsNumber()
  stockPlus360Days?: number;

  @ApiPropertyOptional({ description: 'Cousin machine', example: 'Treadmill Pro 3000' })
  @IsOptional()
  @IsString()
  cousinMachine?: string;

  @ApiPropertyOptional({ description: 'Order together product', example: 'Dumbbell Set' })
  @IsOptional()
  @IsString()
  orderTogether?: string;

  @ApiPropertyOptional({ description: 'Swap machine product', example: 'Treadmill Pro 6000' })
  @IsOptional()
  @IsString()
  swapMachine?: string;

  @ApiPropertyOptional({ description: 'Category name', example: 'Cardio Equipment' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Brand name', example: 'ProBodyline' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'Warranty information' })
  @IsOptional()
  @IsString()
  warranty?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

