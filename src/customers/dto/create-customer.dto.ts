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
    description: 'Address Line 2',
    example: 'Andheri West',
  })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional({
    description: 'PAN Card',
    example: 'ABCDE1234F',
  })
  @IsOptional()
  @IsString()
  panCard?: string;

  @ApiPropertyOptional({
    description: 'Aadhar Card',
    example: '123456789012',
  })
  @IsOptional()
  @IsString()
  aadharCard?: string;

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

  @ApiProperty({
    description: 'Customer phone number',
    example: '+919876543210',
  })
  @IsString()
  phone: string;

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
