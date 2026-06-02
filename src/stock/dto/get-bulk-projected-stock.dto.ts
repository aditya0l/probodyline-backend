import { IsArray, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetBulkProjectedStockDto {
  @ApiProperty({ type: [String], description: 'List of product UUIDs' })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  productIds: string[];

  @ApiProperty({ description: 'Date in YYYY-MM-DD or ISO format' })
  @IsString()
  @IsNotEmpty()
  date: string;
}
