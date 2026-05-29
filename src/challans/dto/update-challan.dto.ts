import { PartialType } from '@nestjs/swagger';
import { CreateChallanDto } from './create-challan.dto';

export class UpdateChallanDto extends PartialType(CreateChallanDto) {}
