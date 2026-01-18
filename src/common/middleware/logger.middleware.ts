import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import * as fs from 'fs';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const requestId = randomUUID();

    // #region agent log
    if (
      originalUrl.includes('/api/gyms') ||
      originalUrl.includes('/api/clients')
    ) {
      try {
        const logPath =
          '/Users/adityajaif/Desktop/PRo-Bodyline/.cursor/debug.log';
        fs.appendFileSync(
          logPath,
          JSON.stringify({
            location: 'logger.middleware.ts:12',
            message: 'Request received in middleware',
            data: { method, originalUrl, path: originalUrl.split('?')[0] },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'H5',
          }) + '\n',
        );
      } catch (e) {}
    }
    // #endregion

    // Add request ID to request object for tracking
    (req as any).requestId = requestId;

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const logMessage = `[${requestId}] ${method} ${originalUrl} ${statusCode} - ${duration}ms - ${ip}`;

      if (statusCode >= 400) {
        console.error(logMessage);
      } else {
        console.log(logMessage);
      }
    });

    next();
  }
}
