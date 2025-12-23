import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Configure connection pool in DATABASE_URL
    // Format: postgresql://user:password@host:port/database?connection_limit=10&pool_timeout=20
    // Connection pool is configured via DATABASE_URL query parameters:
    // - connection_limit: Maximum number of connections (default: depends on database)
    // - pool_timeout: Timeout for getting a connection (default: 10s)
    // Recommended: connection_limit=10 for small apps, 20+ for high traffic
    
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Connection pool configuration for better performance
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    // Note: Prisma middleware ($use) is deprecated in Prisma 5+
    // Stock updates are handled directly in service methods for better performance
    // This ensures stock is updated synchronously when transactions are created
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

