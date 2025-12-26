import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateClientDto } from './create-client.dto';
import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// OmitType excludes tokenDate (immutable field) from CreateClientDto, then PartialType makes all remaining fields optional
export class UpdateClientDto extends PartialType(OmitType(CreateClientDto, ['tokenDate'] as const)) {
  @ApiPropertyOptional({ description: 'State code (e.g., MH, DL, KA)', example: 'MH' })
  @IsString()
  @IsOptional()
  stateCode?: string;

  @ApiPropertyOptional({ description: 'City name', example: 'Mumbai' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'Client name', example: 'John Doe' })
  @IsString()
  @IsOptional()
  clientName?: string;

  @ApiPropertyOptional({ description: 'Sales person full name', example: 'Rajesh Kumar' })
  @IsString()
  @IsOptional()
  salesPerson?: string;

  @ApiPropertyOptional({ description: 'Sales initial (code identifier)', example: 'RK' })
  @IsString()
  @IsOptional()
  salesInitial?: string;
}

