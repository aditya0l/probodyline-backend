import {
  IsString,
  IsDateString,
  IsNotEmpty,
  IsOptional,
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
}
