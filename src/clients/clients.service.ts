import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { generateClientCode } from '../common/utils/client-code.util';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) { }

  async findAll(filters?: {
    search?: string;
    stateCode?: string;
    city?: string;
    salesPerson?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number }> {
    const page = filters?.page ?? 0;
    const limit = filters?.limit ?? 50;
    const skip = page * limit;

    // Build where clause
    const where: any = {};

    if (filters?.search) {
      where.OR = [
        { clientCode: { contains: filters.search, mode: 'insensitive' } },
        { clientName: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
        { salesPerson: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.stateCode) {
      where.stateCode = filters.stateCode;
    }

    if (filters?.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters?.salesPerson) {
      where.salesPerson = { contains: filters.salesPerson, mode: 'insensitive' };
    }

    // Execute query
    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { data: clients, total };
  }

  async findOne(id: string): Promise<any> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        gyms: {
          include: {
            gym: true,
          },
        },
        leads: {
          include: {
            lead: true,
          },
        },
        partners: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    return client;
  }

  async create(data: CreateClientDto, user: any): Promise<any> {
    const salesTeam = user?.name
      ? user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 3)
      : 'SYS';

    // Generate client code
    const clientCode = generateClientCode({
      tokenDate: data.tokenDate,
      stateCode: data.stateCode,
      city: data.city,
      clientName: data.clientName,
      salesInitial: salesTeam,
    });

    // Check if client code already exists
    const existing = await this.prisma.client.findUnique({
      where: { clientCode },
    });

    if (existing) {
      throw new ConflictException(`Client with code ${clientCode} already exists`);
    }

    // Create client
    const client = await this.prisma.client.create({
      data: {
        clientCode,
        tokenDate: data.tokenDate ? new Date(data.tokenDate) : undefined,
        stateCode: data.stateCode,
        city: data.city,
        clientName: data.clientName,
        // salesPerson removed
        salesInitial: salesTeam,
      } as any,
    });

    return client;
  }

  async update(id: string, data: UpdateClientDto): Promise<any> {
    // Verify client exists
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    // Update client (tokenDate is immutable, not included)
    const updated = await this.prisma.client.update({
      where: { id },
      data: {
        stateCode: data.stateCode,
        city: data.city,
        clientName: data.clientName,
        // salesPerson and salesInitial are not manually updatable
      },
    });

    return updated;
  }

  async remove(id: string): Promise<any> {
    // Verify client exists
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    // Delete client (cascade will handle relationships)
    await this.prisma.client.delete({
      where: { id },
    });

    return { message: 'Client deleted successfully' };
  }

  async getClientGyms(clientId: string): Promise<any[]> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        gyms: {
          include: {
            gym: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    return client.gyms;
  }

  async linkGym(clientId: string, gymId: string): Promise<any> {
    // Verify client exists
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    // Verify gym exists
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${gymId} not found`);
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
      throw new ConflictException('Client and Gym are already linked');
    }

    // Create link
    const link = await this.prisma.clientGym.create({
      data: {
        clientId,
        gymId,
      },
      include: {
        gym: true,
      },
    });

    return link;
  }

  async unlinkGym(clientId: string, gymId: string): Promise<void> {
    // Verify link exists
    const link = await this.prisma.clientGym.findUnique({
      where: {
        clientId_gymId: {
          clientId,
          gymId,
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Client-Gym link not found');
    }

    // Delete link
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
      include: {
        leads: {
          include: {
            lead: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    return client.leads;
  }

  async linkLead(clientId: string, leadId: string): Promise<any> {
    // Verify client exists
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    // Verify lead exists
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
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
      throw new ConflictException('Client and Lead are already linked');
    }

    // Create link
    const link = await this.prisma.clientLead.create({
      data: {
        clientId,
        leadId,
      },
      include: {
        lead: true,
      },
    });

    return link;
  }

  async unlinkLead(clientId: string, leadId: string): Promise<void> {
    // Verify link exists
    const link = await this.prisma.clientLead.findUnique({
      where: {
        clientId_leadId: {
          clientId,
          leadId,
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Client-Lead link not found');
    }

    // Delete link
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
      include: {
        partners: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    return client.partners;
  }

  async linkPartner(
    clientId: string,
    partnerType: 'CLIENT' | 'LEAD',
    partnerRefId: string,
  ): Promise<any> {
    // Verify client exists
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    // Verify partner exists based on type
    if (partnerType === 'CLIENT') {
      const partnerClient = await this.prisma.client.findUnique({
        where: { id: partnerRefId },
      });
      if (!partnerClient) {
        throw new NotFoundException(`Partner client with ID ${partnerRefId} not found`);
      }
    } else if (partnerType === 'LEAD') {
      const partnerLead = await this.prisma.lead.findUnique({
        where: { id: partnerRefId },
      });
      if (!partnerLead) {
        throw new NotFoundException(`Partner lead with ID ${partnerRefId} not found`);
      }
    }

    // Create partner link
    const partner = await this.prisma.clientPartner.create({
      data: {
        clientId,
        partnerType,
        partnerRefId,
      },
    });

    return partner;
  }

  async unlinkPartner(clientId: string, partnerId: string): Promise<void> {
    // Verify partner link exists
    const partner = await this.prisma.clientPartner.findUnique({
      where: { id: partnerId },
    });

    if (!partner || partner.clientId !== clientId) {
      throw new NotFoundException('Partner link not found');
    }

    // Delete partner link
    await this.prisma.clientPartner.delete({
      where: { id: partnerId },
    });
  }

  async getClientSummary(clientId: string): Promise<any> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        gyms: true,
        leads: true,
        partners: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    // TODO: Add quotations and orders count when those relationships are added
    return {
      hasGym: client.gyms.length > 0,
      quoteCount: 0, // TODO: Implement
      orderCount: 0, // TODO: Implement
      hasPendingSpareParts: false, // TODO: Implement
    };
  }
}
