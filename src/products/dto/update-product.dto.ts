import { PartialType, OmitType, PickType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

// Omit modelNumber to make it immutable after creation
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['modelNumber'] as const),
) {}

export class UpdateProductMediaDto extends PartialType(
  PickType(CreateProductDto, [
    'cartonLabel',
    'machineArtwork',
    'brochure',
    'thumbnail',
    'instagramLink',
    'youtubeLink',
  ] as const),
) {}
