import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsObject()
  fieldData?: Record<string, any>;

  @IsOptional()
  @IsString()
  pdfUrl?: string;

  @IsOptional()
  imageUrls?: string[];
}

export class VerifyDocumentDto {
  @IsString()
  verifiedBy: string;
}
