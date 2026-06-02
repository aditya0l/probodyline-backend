import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateChallanDto } from './dto/create-challan.dto';
import { UpdateChallanDto } from './dto/update-challan.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ChallansService {
  constructor(private prisma: PrismaService) {}

  async create(createChallanDto: CreateChallanDto) {
    // Generate chnNumber
    const lastChallan = await this.prisma.challan.findFirst({
      orderBy: { chnNumber: 'desc' },
    });
    
    let nextNum = 1;
    if (lastChallan && lastChallan.chnNumber.startsWith('CHN ')) {
      const numStr = lastChallan.chnNumber.replace('CHN ', '');
      nextNum = (parseInt(numStr, 10) || 0) + 1;
    }
    const chnNumber = `CHN ${nextNum.toString().padStart(5, '0')}`;

    const { items, ...data } = createChallanDto;

    return this.prisma.challan.create({
      data: {
        ...data,
        chnNumber,
        date: data.date ? new Date(data.date) : new Date(),
        items: items ? {
          create: items.map(item => ({
            ...item
          }))
        } : undefined
      },
      include: {
        items: true,
        quotation: {
          select: { quoteNumber: true }
        },
        salesOrder: {
          include: {
            quotation: {
              select: { quoteNumber: true }
            }
          }
        }
      }
    });
  }

  async findAll(query?: { search?: string }) {
    const where: Prisma.ChallanWhereInput = {};
    
    if (query?.search) {
      where.OR = [
        { chnNumber: { contains: query.search, mode: 'insensitive' } },
        { recipientName: { contains: query.search, mode: 'insensitive' } },
        { salesOrder: { soNumber: { contains: query.search, mode: 'insensitive' } } },
        { quotation: { quoteNumber: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.challan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        chnNumber: true,
        date: true,
        recipientName: true,
        salesOrder: {
          select: { soNumber: true, quotation: { select: { quoteNumber: true } } }
        },
        quotation: { select: { quoteNumber: true } }
      }
    });
  }

  async findOne(id: string) {
    const challan = await this.prisma.challan.findUnique({
      where: { id },
      include: {
        items: true,
        quotation: {
          select: { quoteNumber: true }
        },
        salesOrder: {
          include: {
            quotation: {
              select: { quoteNumber: true }
            }
          }
        }
      }
    });

    if (!challan) {
      throw new NotFoundException(`Challan with ID ${id} not found`);
    }

    return challan;
  }

  async update(id: string, updateChallanDto: UpdateChallanDto) {
    const { items, ...data } = updateChallanDto;

    return this.prisma.$transaction(async (tx) => {
      // If items provided, recreate them
      if (items) {
        await tx.challanItem.deleteMany({
          where: { challanId: id }
        });
        
        await tx.challanItem.createMany({
          data: items.map(item => ({
            ...item,
            challanId: id
          }))
        });
      }

      return tx.challan.update({
        where: { id },
        data: {
          ...data,
          date: data.date ? new Date(data.date) : undefined,
        },
        include: {
          items: true,
          quotation: { select: { quoteNumber: true } },
          salesOrder: true
        }
      });
    });
  }
}
