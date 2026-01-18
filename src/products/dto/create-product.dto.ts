import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsPositive,
  Length,
  ArrayMaxSize,
  IsNotEmpty,
  Matches,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiPropertyOptional({
    description: 'Product name',
    example: 'Treadmill Pro 5000',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiProperty({
    description:
      'Model number (required, unique, uppercase, spaces converted to underscores)',
    example: 'TM_PRO_5000',
  })
  @IsNotEmpty({ message: 'Model number is required' })
  @IsString()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toUpperCase().replace(/\s+/g, '_');
    }
    return value;
  })
  @Matches(/^[A-Z0-9_]+$/, {
    message:
      'Model number must contain only uppercase letters, numbers, and underscores',
  })
  modelNumber: string;

  @ApiPropertyOptional({
    description: 'QR code image (base64 or URL)',
    example: 'https://example.com/qr-code.png',
  })
  @IsOptional()
  @IsString()
  qrCode?: string;

  @ApiPropertyOptional({
    description: 'Main product image (base64 or URL)',
    example: 'https://example.com/image.jpg',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    description: 'Additional product images array (max 5)',
    type: [String],
    example: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  images?: string[];

  @ApiPropertyOptional({
    description: 'Product price',
    example: 50000,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'Product type', example: 'Cardio' })
  @IsOptional()
  @IsString()
  productType?: string;

  @ApiPropertyOptional({
    description: 'Category UUID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Series name',
    example: 'Professional Series',
  })
  @IsOptional()
  @IsString()
  seriesName?: string;

  @ApiPropertyOptional({
    description: 'Packaging description array',
    type: [String],
    example: ['Boxed', 'Assembled'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  packagingDescription?: string[];

  @ApiPropertyOptional({
    description: 'Search keywords array',
    type: [String],
    example: ['treadmill', 'cardio', 'fitness'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyword?: string[];

  @ApiPropertyOptional({
    description: 'Current stock quantity',
    example: 10,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  todaysStock?: number;

  @ApiPropertyOptional({
    description: 'Stock plus 360 days projection',
    example: 50,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockPlus360Days?: number;

  @ApiPropertyOptional({
    description: 'Display priority (higher = shown first)',
    example: 1,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  priority?: number;

  @ApiPropertyOptional({
    description: 'MRP stickers array (base64 or URLs, max 10)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  mrpStickers?: string[];

  @ApiPropertyOptional({
    description: 'Custom declarations array (base64 or URLs, max 10)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  customDeclarations?: string[];

  @ApiPropertyOptional({ description: 'Carton label (base64 or URL)' })
  @IsOptional()
  @IsString()
  cartonLabel?: string;

  @ApiPropertyOptional({ description: 'Machine artwork (base64 or URL)' })
  @IsOptional()
  @IsString()
  machineArtwork?: string;

  @ApiPropertyOptional({
    description: 'Brochure files array (base64 or URLs, max 10)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  brochure?: string[];

  @ApiPropertyOptional({ description: 'Thumbnail image (base64 or URL)' })
  @IsOptional()
  @IsString()
  thumbnail?: string;

  @ApiPropertyOptional({
    description: 'Related cousin machine product name',
    example: 'Treadmill Pro 3000',
  })
  @IsOptional()
  @IsString()
  cousinMachine?: string;

  @ApiPropertyOptional({
    description: 'Products to order together',
    example: 'Dumbbell Set',
  })
  @IsOptional()
  @IsString()
  orderTogether?: string;

  @ApiPropertyOptional({
    description: 'Swap machine product name',
    example: 'Treadmill Pro 6000',
  })
  @IsOptional()
  @IsString()
  swapMachine?: string;

  @ApiPropertyOptional({ description: 'Brand name', example: 'ProBodyline' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    description: 'Warranty information',
    example: '2 years manufacturer warranty',
  })
  @IsOptional()
  @IsString()
  warranty?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Dormant status (hidden from quote application)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isDormant?: boolean;
}
