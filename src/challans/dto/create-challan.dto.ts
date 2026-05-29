import { IsString, IsOptional, IsArray, IsObject, IsDateString, IsNumber } from 'class-validator';

export class ChallanItemDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  modelNos?: string;

  @IsOptional()
  @IsString()
  packages?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;
}

export class CreateChallanDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  salesOrderId?: string;

  @IsOptional()
  @IsString()
  goodsDispatchedBy?: string;

  @IsOptional()
  @IsString()
  checkedBy?: string;

  @IsOptional()
  @IsString()
  grNo?: string;

  @IsOptional()
  @IsString()
  vehicleNo?: string;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  mobNo?: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  freightAmt?: string;

  @IsOptional()
  @IsArray()
  items?: ChallanItemDto[];
}
