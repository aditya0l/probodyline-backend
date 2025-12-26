import { IsString, IsDateString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInaugurationCommitmentDto {
  @ApiProperty({ description: 'Planned inauguration date (YYYY-MM-DD)', example: '2024-03-15' })
  @IsDateString()
  @IsNotEmpty()
  committedFor: string;

  @ApiPropertyOptional({ description: 'Note about the commitment', example: 'Client confirmed date' })
  @IsString()
  @IsOptional()
  note?: string;
}

