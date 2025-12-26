import { IsString, IsDateString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateGymDto {
  @ApiProperty({ description: 'Installation date (YYYY-MM-DD)', example: '2024-01-15' })
  @IsDateString()
  @IsNotEmpty()
  installationDate: string;

  @ApiProperty({ description: 'State code (e.g., MH, DL, KA)', example: 'MH' })
  @IsString()
  @IsNotEmpty()
  stateCode: string;

  @ApiProperty({ description: 'City name', example: 'Mumbai' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'Gym name', example: 'Helion Fitness' })
  @IsString()
  @IsNotEmpty()
  gymName: string;

  @ApiProperty({ description: 'Branch code (1.0 to 99.0)', example: 1.0 })
  @IsNumber()
  @Type(() => Number)
  @Min(1.0)
  @Max(99.0)
  @IsNotEmpty()
  branchCode: number;

  @ApiProperty({ description: 'Branch title', example: 'Iconic' })
  @IsString()
  @IsNotEmpty()
  branchTitle: string;

  @ApiProperty({ description: 'Sales initial (code identifier)', example: 'RK' })
  @IsString()
  @IsNotEmpty()
  salesInitial: string;

  @ApiPropertyOptional({ description: 'Instagram link', example: 'https://instagram.com/helion_fitness' })
  @IsString()
  @IsOptional()
  instagramLink?: string;

  @ApiPropertyOptional({ description: 'Location link (Google Maps)', example: 'https://maps.google.com/?q=Mumbai+Helion' })
  @IsString()
  @IsOptional()
  locationLink?: string;
}

