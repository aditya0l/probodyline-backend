import { IsString, IsOptional, IsArray, IsUrl, IsNotEmpty } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateManagerDto {
  @ApiPropertyOptional({ description: 'Full Name', example: 'John Doe' })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ description: 'Primary Phone', example: '+919876543210' })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phone: string;

  @ApiPropertyOptional({ description: 'Alternate Phone' })
  @IsString()
  @IsOptional()
  alternatePhone?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'State Code', example: 'MH' })
  @IsString()
  @IsOptional()
  stateCode?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'Address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Instagram Link' })
  @IsString()
  @IsOptional()
  instagramLink?: string;

  @ApiPropertyOptional({ description: 'Profile Photo URL' })
  @IsString()
  @IsOptional()
  profilePhoto?: string;

  @ApiPropertyOptional({ description: 'Location Link (Google Maps)' })
  @IsString()
  @IsOptional()
  locationLink?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
