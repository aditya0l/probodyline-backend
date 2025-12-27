import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const requestId = randomUUID();

    // #region agent log
    if (originalUrl.includes('/api/gyms') || originalUrl.includes('/api/clients')) {
      fetch('http://127.0.0.1:7242/ingest/63c50650-6718-48ed-986d-f3ab98accce6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'logger.middleware.ts:9',message:'Request received in middleware',data:{method,originalUrl,path:originalUrl.split('?')[0]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
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

