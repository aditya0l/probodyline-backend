import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { userContext } from './context';

// Never return password hashes from any query, including nested `include`s.
// Code that needs the hash (login) opts back in with `omit: { password: false }`.
const globalOmit = { user: { password: true } } as const;

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions & { omit: typeof globalOmit }>
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      omit: globalOmit,
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'error', 'warn']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
