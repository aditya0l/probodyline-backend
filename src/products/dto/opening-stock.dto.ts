import { IsArray, IsDateString, IsInt, IsNotEmpty, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OpeningStockDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(0)
  quantity: number;

  @IsDateString()
  date: string;
}

export class BatchOpeningStockDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningStockDto)
  data: OpeningStockDto[];
}
