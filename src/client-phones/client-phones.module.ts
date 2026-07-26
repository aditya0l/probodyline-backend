import { Module } from '@nestjs/common';
import { ClientPhonesService } from './client-phones.service';
import { ClientPhonesController } from './client-phones.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [ClientPhonesController],
  providers: [ClientPhonesService],
  exports: [ClientPhonesService],
})
export class ClientPhonesModule {}
