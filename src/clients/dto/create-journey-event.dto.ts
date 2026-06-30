import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { JourneyEventType } from '@prisma/client';

export class CreateJourneyEventDto {
  @IsEnum(JourneyEventType)
  eventType: JourneyEventType;

  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsString()
  linkedName?: string;

  @IsOptional()
  @IsString()
  relationship?: string;
}
