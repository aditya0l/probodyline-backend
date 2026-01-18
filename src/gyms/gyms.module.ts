import { Module, OnModuleInit } from '@nestjs/common';
import { GymsService } from './gyms.service';
import { GymsController } from './gyms.controller';
import * as fs from 'fs';
import * as path from 'path';

@Module({
  controllers: [GymsController],
  providers: [GymsService],
  exports: [GymsService],
})
export class GymsModule implements OnModuleInit {
  constructor() {
    console.log('🔵 GymsModule constructor called');
  }

  onModuleInit() {
    // #region agent log
    try {
      const logPath =
        '/Users/adityajaif/Desktop/PRo-Bodyline/.cursor/debug.log';
      fs.appendFileSync(
        logPath,
        JSON.stringify({
          location: 'gyms.module.ts:20',
          message: 'GymsModule onModuleInit called',
          data: { module: 'GymsModule' },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H3',
        }) + '\n',
      );
    } catch (e) {}
    // #endregion
    console.log('✅ GymsModule initialized - controllers should be registered');
    console.log('🔵 GymsModule controllers array:', [GymsController.name]);
  }
}
