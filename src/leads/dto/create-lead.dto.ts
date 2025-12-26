import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';

export class CreateLeadDto {
  @ApiProperty({ description: 'Lead name', example: 'John Doe' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Company name', example: 'ABC Corporation' })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'john@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+91 9876543210' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Address', example: '123 Main Street' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'City', example: 'Mumbai' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'State code', example: 'MH' })
  @IsString()
  @IsOptional()
  stateCode?: string;

  @ApiPropertyOptional({ description: 'Lead source', example: 'Website' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ description: 'Lead status', enum: LeadStatus, default: LeadStatus.NEW })
  @IsEnum(LeadStatus)
  @IsOptional()
  status?: LeadStatus;

  @ApiPropertyOptional({ description: 'Notes', example: 'Interested in premium equipment' })
  @IsString()
  @IsOptional()
  notes?: string;
}

