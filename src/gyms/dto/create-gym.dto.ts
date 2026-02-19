import {
  IsString,
  IsDateString,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateGymDto {
  @ApiPropertyOptional({
    description: 'Installation date (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  @IsOptional()
  @IsDateString()
  installationDate?: string;

  @ApiPropertyOptional({ description: 'State code (e.g., MH, DL, KA)', example: 'MH' })
  @IsOptional()
  @IsString()
  stateCode?: string;

  @ApiPropertyOptional({ description: 'City name', example: 'Mumbai' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Gym name', example: 'Helion Fitness' })
  @IsOptional()
  @IsString()
  gymName?: string;

  @ApiPropertyOptional({ description: 'Branch code (1.0 to 99.0)', example: 1.0 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1.0)
  @Max(99.0)
  branchCode?: number;

  @ApiPropertyOptional({ description: 'Branch title', example: 'Iconic' })
  @IsOptional()
  @IsString()
  branchTitle?: string;

  @ApiPropertyOptional({
    description: 'Sales initial (code identifier)',
    example: 'RK',
  })
  @IsOptional()
  @IsString()
  salesInitial?: string;

  @ApiPropertyOptional({ description: 'Call sign for branch', example: 'ALPHA' })
  @IsOptional()
  @IsString()
  callSign?: string;

  @ApiPropertyOptional({
    description: 'Instagram link',
    example: 'https://instagram.com/helion_fitness',
  })
  @IsString()
  @IsOptional()
  instagramLink?: string;

  @ApiPropertyOptional({
    description: 'Location link (Google Maps)',
    example: 'https://maps.google.com/?q=Mumbai+Helion',
  })
  @IsString()
  @IsOptional()
  locationLink?: string;
}
