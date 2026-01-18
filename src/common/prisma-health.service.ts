import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaHealthService {
  constructor(private prisma: PrismaService) {}

  async checkConnection(): Promise<{ connected: boolean; latency?: number }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      return { connected: true, latency };
    } catch (error) {
      return { connected: false };
    }
  }

  async getPoolStats(): Promise<{
    activeConnections?: number;
    idleConnections?: number;
  }> {
    // Prisma doesn't expose pool stats directly, but we can infer from query performance
    // For detailed pool monitoring, use database-specific queries or external tools
    try {
      const result = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()
      `;
      return {
        activeConnections: Number(result[0]?.count || 0),
      };
    } catch (error) {
      // If query fails, return empty stats
      return {};
    }
  }
}
