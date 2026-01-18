import { IsString, IsOptional, IsUUID, IsEmail, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ description: 'Customer name', example: 'John Doe' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({ description: 'Gym name', example: 'FitZone Gym' })
  @IsOptional()
  @IsString()
  gymName?: string;

  @ApiPropertyOptional({
    description: 'Customer address',
    example: '123 Main St',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'City', example: 'Mumbai' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Area/Locality',
    example: 'Andheri West',
  })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({
    description: 'GST number',
    example: '27ABCDE1234F1Z5',
  })
  @IsOptional()
  @IsString()
  gst?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+91 9876543210',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Contact person name',
    example: 'Jane Smith',
  })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
