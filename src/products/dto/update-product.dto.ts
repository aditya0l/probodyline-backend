import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

// Omit modelNumber to make it immutable after creation
export class UpdateProductDto extends PartialType(
    OmitType(CreateProductDto, ['modelNumber'] as const)
) { }

