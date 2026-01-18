import { PartialType } from '@nestjs/mapped-types';
import { CreateStockTransactionDto } from './create-stock-transaction.dto';

export class UpdateStockTransactionDto extends PartialType(
  CreateStockTransactionDto,
) {}
