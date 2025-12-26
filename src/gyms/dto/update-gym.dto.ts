import { PartialType } from '@nestjs/mapped-types';
import { CreateGymDto } from './create-gym.dto';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateGymDto extends PartialType(CreateGymDto) {
  // installationDate can be updated, but history is tracked via AuditLog
  @ApiPropertyOptional({ description: 'Installation date (YYYY-MM-DD)', example: '2024-01-15' })
  @IsOptional()
  installationDate?: string;

  @ApiPropertyOptional({ description: 'State code (e.g., MH, DL, KA)', example: 'MH' })
  @IsString()
  @IsOptional()
  stateCode?: string;

  @ApiPropertyOptional({ description: 'City name', example: 'Mumbai' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'Gym name', example: 'Helion Fitness' })
  @IsString()
  @IsOptional()
  gymName?: string;

  @ApiPropertyOptional({ description: 'Branch code (1.0 to 99.0)', example: 1.0 })
  @IsNumber()
  @Type(() => Number)
  @Min(1.0)
  @Max(99.0)
  @IsOptional()
  branchCode?: number;

  @ApiPropertyOptional({ description: 'Branch title', example: 'Iconic' })
  @IsString()
  @IsOptional()
  branchTitle?: string;

  @ApiPropertyOptional({ description: 'Sales initial (code identifier)', example: 'RK' })
  @IsString()
  @IsOptional()
  salesInitial?: string;

  @ApiPropertyOptional({ description: 'Instagram link', example: 'https://instagram.com/helion_fitness' })
  @IsString()
  @IsOptional()
  instagramLink?: string;

  @ApiPropertyOptional({ description: 'Location link (Google Maps)', example: 'https://maps.google.com/?q=Mumbai+Helion' })
  @IsString()
  @IsOptional()
  locationLink?: string;
}

