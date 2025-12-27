import { Module, OnModuleInit } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { CommonModule } from '../common/common.module';
import * as fs from 'fs';

@Module({
  imports: [CommonModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule implements OnModuleInit {
  constructor() {
    console.log('🔵 ClientsModule constructor called');
  }
  
  onModuleInit() {
    // #region agent log
    try{const logPath='/Users/adityajaif/Desktop/PRo-Bodyline/.cursor/debug.log';fs.appendFileSync(logPath,JSON.stringify({location:'clients.module.ts:20',message:'ClientsModule onModuleInit called',data:{module:'ClientsModule'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})+'\n');}catch(e){}
    // #endregion
    console.log('✅ ClientsModule initialized - controllers should be registered');
    console.log('🔵 ClientsModule controllers array:', [ClientsController.name]);
  }
}


