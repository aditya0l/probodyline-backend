import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadStatus, Prisma } from '@prisma/client';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  private async generateLeadNumber(): Promise<string> {
    const count = await this.prisma.lead.count();
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return `L-${dateStr}-${String(count + 1).padStart(3, '0')}`;
  }

  async findAll(filters?: {
    search?: string;
    status?: LeadStatus;
    source?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number }> {
    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
      ...(filters?.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { company: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
          { phone: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.source && { source: filters.source }),
    };

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        skip: (filters?.page || 0) * (filters?.limit || 50),
        take: filters?.limit || 50,
        orderBy: { createdAt: 'desc' },
        include: {
          statusHistory: {
            orderBy: { changedAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string): Promise<any> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        statusHistory: {
          orderBy: { changedAt: 'desc' },
        },
        clientLeads: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  async create(data: CreateLeadDto): Promise<any> {
    const leadNumber = await this.generateLeadNumber();

    const lead = await this.prisma.lead.create({
      data: {
        leadNumber,
        name: data.name,
        company: data.company || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        stateCode: data.stateCode || null,
        source: data.source || null,
        status: data.status || LeadStatus.NEW,
        notes: data.notes || null,
      },
    });

    // Create initial status history entry
    await this.prisma.leadStatusHistory.create({
      data: {
        leadId: lead.id,
        status: lead.status,
      },
    });

    return lead;
  }

  async updateStatus(id: string, status: LeadStatus, notes?: string): Promise<any> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Update lead status
    const updatedLead = await this.prisma.lead.update({
      where: { id },
      data: { status },
    });

    // Add status history entry
    await this.prisma.leadStatusHistory.create({
      data: {
        leadId: id,
        status,
        notes: notes || null,
      },
    });

    return updatedLead;
  }

  async remove(id: string): Promise<any> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Soft delete
    return this.prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

