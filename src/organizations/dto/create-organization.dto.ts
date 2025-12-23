import { IsString, IsOptional, IsNumber, IsEmail, Length, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ description: 'Organization name', example: 'PRo Bodyline' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiProperty({ description: 'Organization address', example: '123 Main St, City, State 12345' })
  @IsString()
  @Length(1, 500)
  address: string;

  @ApiProperty({ description: 'GST number', example: '27ABCDE1234F1Z5' })
  @IsString()
  @Length(15, 15)
  gst: string;

  @ApiProperty({ description: 'Contact phone number', example: '+91 9876543210' })
  @IsString()
  @Length(10, 20)
  phone: string;

  @ApiProperty({ description: 'Contact email address', example: 'contact@probodyline.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Website URL', example: 'https://www.probodyline.com' })
  @IsString()
  website: string;

  @ApiProperty({ description: 'Primary contact person name', example: 'John Doe' })
  @IsString()
  @Length(1, 255)
  contactPerson: string;

  @ApiPropertyOptional({ description: 'Logo URL or base64 string', example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({ description: 'Bank account details', example: 'Account: 1234567890, IFSC: ABCD0123456' })
  @IsOptional()
  @IsString()
  bankDetails?: string;

  @ApiPropertyOptional({ description: 'Terms and conditions text' })
  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @ApiPropertyOptional({ description: 'Warranty information' })
  @IsOptional()
  @IsString()
  warrantyInfo?: string;

  @ApiPropertyOptional({ description: 'Default GST rate percentage', example: 18, type: Number })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultGstRate?: number;
}

