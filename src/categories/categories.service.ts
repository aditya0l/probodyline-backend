import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category, Prisma } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  async findOne(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  async create(data: CreateCategoryDto): Promise<Category> {
    return this.prisma.category.create({
      data,
    });
  }

  async update(id: string, data: UpdateCategoryDto): Promise<Category> {
    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Category> {
    // Soft delete
    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findDeleted(): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: {
        deletedAt: { not: null },
      },
      orderBy: { deletedAt: 'desc' },
      include: {
        parent: true,
      },
    });
  }

  async restore(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (!category.deletedAt) {
      throw new BadRequestException('Category is not deleted');
    }

    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
