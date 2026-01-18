import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Customer, Prisma } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({
      where: { id },
      include: {
        quotations: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async create(data: CreateCustomerDto): Promise<Customer> {
    return this.prisma.customer.create({
      data,
    });
  }

  async update(id: string, data: UpdateCustomerDto): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Customer> {
    // Soft delete
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findDeleted(): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      where: {
        deletedAt: { not: null },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async restore(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (!customer.deletedAt) {
      throw new BadRequestException('Customer is not deleted');
    }

    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
