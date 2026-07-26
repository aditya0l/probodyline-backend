import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateClientPhoneDto {
  @ApiProperty({ description: 'The phone number to add' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ description: 'The client ID this number belongs to' })
  @IsString()
  @IsNotEmpty()
  clientId: string;
}
