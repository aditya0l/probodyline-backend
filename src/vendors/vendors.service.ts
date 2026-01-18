import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { Vendor, Prisma } from '@prisma/client';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Vendor[]> {
    return this.prisma.vendor.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string): Promise<Vendor | null> {
    return this.prisma.vendor.findUnique({
      where: { id },
    });
  }

  async create(data: CreateVendorDto): Promise<Vendor> {
    return this.prisma.vendor.create({
      data,
    });
  }

  async update(id: string, data: UpdateVendorDto): Promise<Vendor> {
    return this.prisma.vendor.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Vendor> {
    // Soft delete
    return this.prisma.vendor.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findDeleted(): Promise<Vendor[]> {
    return this.prisma.vendor.findMany({
      where: {
        deletedAt: { not: null },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async restore(id: string): Promise<Vendor> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (!vendor.deletedAt) {
      throw new BadRequestException('Vendor is not deleted');
    }

    return this.prisma.vendor.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
