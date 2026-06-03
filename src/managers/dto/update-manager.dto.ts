import { PartialType } from '@nestjs/mapped-types';
import { CreateManagerDto } from './create-manager.dto';

import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateManagerDto extends PartialType(CreateManagerDto) {
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phone: string;
}
