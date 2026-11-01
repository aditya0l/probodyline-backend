import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordSharesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  productIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(32)
  source?: string;
}
