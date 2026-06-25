import {
  IsString,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiPropertyOptional({
    description: 'Business token/contract date (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  @IsOptional()
  @IsDateString()
  tokenDate?: string;

  @ApiPropertyOptional({
    description: 'State code (e.g., MH, DL, KA)',
    example: 'MH',
  })
  @IsOptional()
  @IsString()
  stateCode?: string;

  @ApiPropertyOptional({ description: 'City name', example: 'Mumbai' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Client name', example: 'John Doe' })
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional({ description: 'Phone number for verification' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Primary Address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Secondary Address' })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional({ description: 'Area/Region' })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({ description: 'GST Number' })
  @IsOptional()
  @IsString()
  gst?: string;

  @ApiPropertyOptional({ description: 'PAN Card Number' })
  @IsOptional()
  @IsString()
  panCard?: string;

  @ApiPropertyOptional({ description: 'Aadhar Card Number' })
  @IsOptional()
  @IsString()
  aadharCard?: string;

  @ApiPropertyOptional({ description: 'PAN Card Image URL' })
  @IsOptional()
  @IsString()
  panCardUrl?: string;

  @ApiPropertyOptional({ description: 'Aadhar Card Image URL' })
  @IsOptional()
  @IsString()
  aadharCardUrl?: string;

  @ApiPropertyOptional({ description: 'Is phone verified' })
  @IsOptional()
  @IsBoolean()
  isPhoneVerified?: boolean;
}
