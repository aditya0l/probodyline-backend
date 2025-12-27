import { IsString, IsDateString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ description: 'Business token/contract date (YYYY-MM-DD)', example: '2024-01-15' })
  @IsDateString()
  @IsNotEmpty()
  tokenDate: string;

  @ApiProperty({ description: 'State code (e.g., MH, DL, KA)', example: 'MH' })
  @IsString()
  @IsNotEmpty()
  stateCode: string;

  @ApiProperty({ description: 'City name', example: 'Mumbai' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'Client name', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  clientName: string;

  @ApiProperty({ description: 'Sales person full name', example: 'Rajesh Kumar' })
  @IsString()
  @IsNotEmpty()
  salesPerson: string;

  @ApiProperty({ description: 'Sales initial (code identifier)', example: 'RK' })
  @IsString()
  @IsNotEmpty()
  salesInitial: string;
}


