import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendOtpDto {
  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  entityType?: 'CUSTOMER' | 'MANAGER' | 'TRAINER' | 'LEAD' | 'CLIENT';
}
