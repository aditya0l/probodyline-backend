import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FactoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const factories = await this.prisma.factory.findMany({
      orderBy: { lastActiveAt: 'desc' },
      include: {
        purchaseOrders: {
          where: { status: 'DRAFT' },
        },
        splits: true,
      },
    });

    // Compute basic stats for the landing page
    return factories.map(f => {
      const activePoCount = f.purchaseOrders.length;
      return {
        ...f,
        activePoCount,
      };
    });
  }

  async findOne(id: string) {
    const factory = await this.prisma.factory.findUnique({
      where: { id },
      include: {
        splits: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!factory) throw new NotFoundException('Factory not found');
    return factory;
  }

  async create(data: any) {
    return this.prisma.factory.create({
      data: {
        name: data.name,
      },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.factory.update({
      where: { id },
      data,
    });
  }

  // Factory Splits
  async getSplits(factoryId: string) {
    return this.prisma.factorySplit.findMany({
      where: { factoryId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSplit(factoryId: string, data: any) {
    return this.prisma.factorySplit.create({
      data: {
        factoryId,
        dateRangeLabel: data.dateRangeLabel,
        tag: data.tag,
        color: data.color,
      },
    });
  }
}
