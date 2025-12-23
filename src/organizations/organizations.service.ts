import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Organization, Prisma } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Organization[]> {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({
      where: { id },
    });
  }

  async create(data: CreateOrganizationDto): Promise<Organization> {
    return this.prisma.organization.create({
      data: {
        ...data,
        defaultGstRate: data.defaultGstRate || 18,
      },
    });
  }

  async update(id: string, data: UpdateOrganizationDto): Promise<Organization> {
    return this.prisma.organization.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Organization> {
    return this.prisma.organization.delete({
      where: { id },
    });
  }

  // Singleton methods - get/update the single organization
  async getSingleton(): Promise<Organization> {
    const org = await this.prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!org) {
      throw new NotFoundException('Organization not found. Please create an organization first.');
    }
    return org;
  }

  async updateSingleton(data: UpdateOrganizationDto): Promise<Organization> {
    const org = await this.getSingleton();
    return this.update(org.id, data);
  }
}

