import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { generateClientCode } from '../common/utils/client-code.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: {
    search?: string;
    stateCode?: string;
    city?: string;
    salesPerson?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number }> {
    const where: Prisma.ClientWhereInput = {
      deletedAt: null,
      ...(filters?.search && {
        OR: [
          { clientName: { contains: filters.search, mode: 'insensitive' } },
          { city: { contains: filters.search, mode: 'insensitive' } },
          { clientCode: { contains: filters.search, mode: 'insensitive' } },
          { stateCode: { contains: filters.search, mode: 'insensitive' } },
          { salesPerson: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
      ...(filters?.stateCode && { stateCode: filters.stateCode }),
      ...(filters?.city && { city: { contains: filters.city, mode: 'insensitive' } }),
      ...(filters?.salesPerson && { salesPerson: { contains: filters.salesPerson, mode: 'insensitive' } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip: (filters?.page || 0) * (filters?.limit || 50),
        take: filters?.limit || 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string): Promise<any> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        clientGyms: {
          include: {
            gym: true,
          },
        },
        clientLeads: {
          include: {
            lead: true,
          },
        },
        clientPartners: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async create(data: CreateClientDto): Promise<any> {
    // Generate client code
    const clientCode = generateClientCode({
      tokenDate: data.tokenDate,
      stateCode: data.stateCode,
      city: data.city,
      clientName: data.clientName,
      salesInitial: data.salesInitial,
    });

    // Check if client code already exists (should be unique)
    const existingClient = await this.prisma.client.findUnique({
      where: { clientCode },
    });

    if (existingClient) {
      throw new ConflictException('Client with this code already exists');
    }

    const clientData = {
      clientCode,
      tokenDate: new Date(data.tokenDate),
      stateCode: data.stateCode,
      city: data.city,
      clientName: data.clientName,
      salesPerson: data.salesPerson,
      salesInitial: data.salesInitial,
    };

    return this.prisma.client.create({
      data: clientData,
    });
  }

  async update(id: string, data: UpdateClientDto): Promise<any> {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // tokenDate is immutable - explicitly exclude it (clientCode is derived from it, so also immutable)
    const { tokenDate, ...updateData } = data as any;
    
    return this.prisma.client.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string): Promise<any> {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Soft delete
    return this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getClientGyms(clientId: string): Promise<any[]> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return this.prisma.clientGym.findMany({
      where: { clientId },
      include: {
        gym: true,
      },
    });
  }

  async linkGym(clientId: string, gymId: string): Promise<any> {
    const [client, gym] = await Promise.all([
      this.prisma.client.findUnique({ where: { id: clientId } }),
      this.prisma.gym.findUnique({ where: { id: gymId } }),
    ]);

    if (!client) {
      throw new NotFoundException('Client not found');
    }
    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    // Check if already linked
    const existing = await this.prisma.clientGym.findUnique({
      where: {
        clientId_gymId: {
          clientId,
          gymId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Gym is already linked to this client');
    }

    return this.prisma.clientGym.create({
      data: {
        clientId,
        gymId,
      },
      include: {
        gym: true,
      },
    });
  }

  async unlinkGym(clientId: string, gymId: string): Promise<void> {
    const link = await this.prisma.clientGym.findUnique({
      where: {
        clientId_gymId: {
          clientId,
          gymId,
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Gym is not linked to this client');
    }

    await this.prisma.clientGym.delete({
      where: {
        clientId_gymId: {
          clientId,
          gymId,
        },
      },
    });
  }

  async getClientLeads(clientId: string): Promise<any[]> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return this.prisma.clientLead.findMany({
      where: { clientId },
      include: {
        lead: true,
      },
    });
  }

  async linkLead(clientId: string, leadId: string): Promise<any> {
    const [client, lead] = await Promise.all([
      this.prisma.client.findUnique({ where: { id: clientId } }),
      this.prisma.lead.findUnique({ where: { id: leadId } }),
    ]);

    if (!client) {
      throw new NotFoundException('Client not found');
    }
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Check if already linked
    const existing = await this.prisma.clientLead.findUnique({
      where: {
        clientId_leadId: {
          clientId,
          leadId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Lead is already linked to this client');
    }

    return this.prisma.clientLead.create({
      data: {
        clientId,
        leadId,
      },
      include: {
        lead: true,
      },
    });
  }

  async unlinkLead(clientId: string, leadId: string): Promise<void> {
    const link = await this.prisma.clientLead.findUnique({
      where: {
        clientId_leadId: {
          clientId,
          leadId,
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Lead is not linked to this client');
    }

    await this.prisma.clientLead.delete({
      where: {
        clientId_leadId: {
          clientId,
          leadId,
        },
      },
    });
  }

  async getClientPartners(clientId: string): Promise<any[]> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return this.prisma.clientPartner.findMany({
      where: { clientId },
    });
  }

  async linkPartner(
    clientId: string,
    partnerType: 'CLIENT' | 'LEAD',
    partnerRefId: string,
  ): Promise<any> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Validate partner exists
    if (partnerType === 'CLIENT') {
      const partnerClient = await this.prisma.client.findUnique({
        where: { id: partnerRefId },
      });
      if (!partnerClient) {
        throw new NotFoundException('Partner client not found');
      }
    } else if (partnerType === 'LEAD') {
      const partnerLead = await this.prisma.lead.findUnique({
        where: { id: partnerRefId },
      });
      if (!partnerLead) {
        throw new NotFoundException('Partner lead not found');
      }
    }

    // Check if already linked
    const existing = await this.prisma.clientPartner.findUnique({
      where: {
        clientId_partnerType_partnerRefId: {
          clientId,
          partnerType,
          partnerRefId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Partner is already linked to this client');
    }

    return this.prisma.clientPartner.create({
      data: {
        clientId,
        partnerType,
        partnerRefId,
      },
    });
  }

  async unlinkPartner(clientId: string, partnerId: string): Promise<void> {
    const partner = await this.prisma.clientPartner.findUnique({
      where: { id: partnerId },
    });

    if (!partner || partner.clientId !== clientId) {
      throw new NotFoundException('Partner is not linked to this client');
    }

    await this.prisma.clientPartner.delete({
      where: { id: partnerId },
    });
  }

  async getClientSummary(clientId: string): Promise<any> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const [gyms, quotes, orders] = await Promise.all([
      this.prisma.clientGym.count({
        where: { clientId },
      }),
      this.prisma.quotation.count({
        where: {
          clientId,
          deletedAt: null,
        },
      }),
      this.prisma.quotation.count({
        where: {
          clientId,
          status: 'CONFIRMED',
          deletedAt: null,
        },
      }),
    ]);

    // TODO: Implement pending spare parts check when service module is ready
    const hasPendingSpareParts = false;

    return {
      hasGym: gyms > 0,
      quoteCount: quotes,
      orderCount: orders,
      hasPendingSpareParts,
    };
  }
}

