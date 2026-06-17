import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  otp: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  entityType?: 'CUSTOMER' | 'MANAGER' | 'TRAINER' | 'LEAD' | 'CLIENT';
}
