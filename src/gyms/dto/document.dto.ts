import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsObject()
  fieldData?: Record<string, any>;
}

export class VerifyDocumentDto {
  @IsString()
  verifiedBy: string;
}
