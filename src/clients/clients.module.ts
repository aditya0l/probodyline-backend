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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/63c50650-6718-48ed-986d-f3ab98accce6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'clients.module.ts:14',message:'ClientsModule onModuleInit called',data:{module:'ClientsModule'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    console.log('✅ ClientsModule initialized - controllers should be registered');
  }
}


