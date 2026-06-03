import { PartialType } from '@nestjs/mapped-types';
import { CreateTrainerDto } from './create-trainer.dto';

import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateTrainerDto extends PartialType(CreateTrainerDto) {
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phone: string;
}
