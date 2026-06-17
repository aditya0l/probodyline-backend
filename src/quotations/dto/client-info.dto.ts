import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ClientInfoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientAddressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientPanCard?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientAadharCard?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientGST?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gymName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gymArea?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPhoneVerified?: boolean;
}
