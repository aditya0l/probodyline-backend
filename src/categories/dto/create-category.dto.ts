import { IsString, IsOptional, IsUUID, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name', example: 'Cardio Equipment' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({
    description: 'Parent category UUID for nested categories',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Cardiovascular exercise equipment',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
