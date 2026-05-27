import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class ExpenseLogItemDto {
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() time?: string;
  @IsOptional() @IsString() expenses?: string;
  @IsOptional() @IsNumber() amount?: number;
}

export class CreateServiceCardDto {
  @IsOptional() @IsDateString() installationDate?: string;
  @IsOptional() @IsString() stateCode?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() gymId?: string;
  @IsOptional() @IsString() gymName?: string;
  @IsOptional() @IsNumber() branchCode?: number;
  @IsOptional() @IsString() branchTitle?: string;
  @IsOptional() @IsString() salesInitial?: string;
  @IsOptional() @IsString() contactAtGym?: string;
  @IsOptional() @IsString() contactNo?: string;
  @IsOptional() @IsArray() engineers?: string[];
  @IsOptional() @IsString() landmark?: string;
  @IsOptional() @IsString() locationQR?: string;

  @IsOptional() @IsString() visitType?: string; // INSTALLATION, SERVICE, REPAIR, RE_INSTALL

  @IsOptional() @IsNumber() installationAndServiceCharges?: number;
  @IsOptional() @IsNumber() estimatedExpense?: number;

  @IsOptional() @IsString() techEngineerName?: string;
  @IsOptional() @IsNumber() reimbursementTravel?: number;
  @IsOptional() @IsNumber() reimbursementHotel?: number;
  @IsOptional() @IsNumber() reimbursementFood?: number;
  @IsOptional() @IsNumber() reimbursementOilSpray?: number;
  @IsOptional() @IsNumber() reimbursementSpare?: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsNumber() techActualExpense?: number;
  
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseLogItemDto)
  expenseLog?: ExpenseLogItemDto[];

  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() endTime?: string;
  @IsOptional() @IsBoolean() pendingWork?: boolean;
  @IsOptional() @IsString() waitingTimeOnClientRequest?: string;
  @IsOptional() @IsString() engineerSign?: string;

  @IsOptional() @IsNumber() sAmount?: number;
  @IsOptional() @IsNumber() otAmount?: number;
  @IsOptional() @IsNumber() accountsActualExpense?: number;
  @IsOptional() @IsNumber() accountsReimbursement?: number;
  @IsOptional() @IsNumber() netCtc?: number;

  @IsOptional() @IsString() salesOrderId?: string;
}

export class UpdateServiceCardDto extends CreateServiceCardDto {}
