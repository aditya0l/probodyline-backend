import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const requestId = randomUUID();

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

