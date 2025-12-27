import { Module, OnModuleInit } from '@nestjs/common';
import { GymsService } from './gyms.service';
import { GymsController } from './gyms.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [GymsController],
  providers: [GymsService],
  exports: [GymsService],
})
export class GymsModule implements OnModuleInit {
  onModuleInit() {
    console.log('✅ GymsModule initialized - controllers should be registered');
  }
}


