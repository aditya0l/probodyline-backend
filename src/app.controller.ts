import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaHealthService } from './common/prisma-health.service';
import * as os from 'os';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prismaHealth: PrismaHealthService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async getHealth() {
    const health: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'pro-bodyline-backend',
      database: 'unknown',
      uptime: process.uptime(),
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
        unit: 'MB',
      },
      system: {
        platform: os.platform(),
        cpuCount: os.cpus().length,
        loadAverage: os.loadavg(),
      },
      modules: {
        gyms: 'loaded',
        clients: 'loaded',
      },
      endpoints: {
        '/api/gyms': 'available',
        '/api/clients': 'available',
        '/api/health': 'available',
      },
    };

    // Check database connection with latency
    const dbCheck = await this.prismaHealth.checkConnection();
    health.database = dbCheck.connected ? 'connected' : 'disconnected';
    if (dbCheck.latency) {
      health.database += ` (${dbCheck.latency}ms)`;
    }
    if (!dbCheck.connected) {
      health.status = 'unhealthy';
    }

    // Get connection pool stats
    const poolStats = await this.prismaHealth.getPoolStats();
    if (poolStats.activeConnections !== undefined) {
      health.connections = poolStats;
    }

    return health;
  }
}
