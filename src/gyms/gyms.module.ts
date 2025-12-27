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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/63c50650-6718-48ed-986d-f3ab98accce6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gyms.module.ts:14',message:'GymsModule onModuleInit called',data:{module:'GymsModule'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    console.log('✅ GymsModule initialized - controllers should be registered');
  }
}


