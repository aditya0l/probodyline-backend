import { Module, OnModuleInit } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule implements OnModuleInit {
  onModuleInit() {
    console.log('✅ ClientsModule initialized - controllers should be registered');
  }
}


