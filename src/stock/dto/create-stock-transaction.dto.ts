import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsEnum,
  IsDateString,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockTransactionType } from '@prisma/client';

export class CreateStockTransactionDto {
  @ApiProperty({ description: 'Product UUID', example: '123e4567-e89b-12d3-a456-426614174002' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Transaction type', enum: StockTransactionType, example: 'IN' })
  @IsEnum(StockTransactionType)
  transactionType: StockTransactionType;

  @ApiProperty({ description: 'Quantity (positive for IN, negative for OUT)', example: 10, type: Number })
  @IsNumber()
  @IsInt()
  quantity: number; // Positive for IN, negative for OUT

  @ApiPropertyOptional({ description: 'Reference type (e.g., quotation, purchase_order)', example: 'quotation' })
  @IsOptional()
  @IsString()
  referenceType?: string; // e.g., 'quotation', 'purchase_order'

  @ApiPropertyOptional({ description: 'Reference UUID (e.g., quotation ID)', example: '123e4567-e89b-12d3-a456-426614174003' })
  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @ApiProperty({ description: 'Transaction date (ISO string)', example: '2024-01-15T00:00:00.000Z' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

