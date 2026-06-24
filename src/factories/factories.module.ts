import { Module } from '@nestjs/common';
import { FactoriesService } from './factories.service';
import { FactoriesController } from './factories.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FactoriesController],
  providers: [FactoriesService],
})
export class FactoriesModule {}
