import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UpdateDocumentDto, VerifyDocumentDto } from './dto/document.dto';
import { ClientDocumentType } from '@prisma/client';

import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { generateClientCode } from '../common/utils/client-code.util';

import { EventsGateway } from '../events/events.gateway';
import { FilesService } from '../files/files.service';
import { CreateJourneyEventDto } from './dto/create-journey-event.dto';
import { TextractService } from '../textract/textract.service';
import { DocumentParserService } from '../textract/document-parser.service';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private filesService: FilesService,
    private textractService: TextractService,
    private documentParserService: DocumentParserService,
  ) {}

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
        { salesInitial: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.stateCode) {
      where.stateCode = filters.stateCode;
    }

    if (filters?.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters?.salesPerson) {
      where.salesInitial = {
        contains: filters.salesPerson,
        mode: 'insensitive',
      };
    }

    // Execute query
    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          clientCode: true,
          clientName: true,
          city: true,
          stateCode: true,
          tokenDate: true,
          salesInitial: true,
          phone: true,
          email: true,
          address: true,
          addressLine2: true,
          area: true,
          gst: true,
          panCard: true,
          aadharCard: true,
          panCardUrl: true,
          aadharCardUrl: true,
          isPhoneVerified: true,
          _count: {
            select: { gyms: true },
          },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    const mappedClients = clients.map((c) => {
      const { _count, ...rest } = c;
      return {
        ...rest,
        summary: {
          hasGym: (_count?.gyms ?? 0) > 0,
          quoteCount: 0, // TODO: Implement
          orderCount: 0, // TODO: Implement
          hasPendingSpareParts: false, // TODO: Implement
        },
      };
    });

    return { data: mappedClients, total };
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
        journeyEvents: {
          orderBy: { createdAt: 'desc' },
        },
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
      throw new ConflictException(
        `Client with code ${clientCode} already exists`,
      );
    }

    // Create client
    const client = await this.prisma.client.create({
      data: {
        clientCode,
        tokenDate: data.tokenDate ? new Date(data.tokenDate) : undefined,
        stateCode: data.stateCode,
        city: data.city,
        clientName: data.clientName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        addressLine2: data.addressLine2,
        area: data.area,
        gst: data.gst,
        panCard: data.panCard,
        aadharCard: data.aadharCard,
        panCardUrl: data.panCardUrl,
        aadharCardUrl: data.aadharCardUrl,
        isPhoneVerified: data.isPhoneVerified,
        // salesPerson removed
        salesInitial: salesTeam,
      } as any,
    });

    await this.prisma.clientJourneyEvent.create({
      data: {
        clientId: client.id,
        eventType: 'CREATED',
        createdBy: user?.name || 'SYS',
      },
    });

    this.eventsGateway.broadcastEntityUpdate('CLIENT', client.id);
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
        email: data.email,
        phone: data.phone,
        address: data.address,
        addressLine2: data.addressLine2,
        area: data.area,
        gst: data.gst,
        panCard: data.panCard,
        aadharCard: data.aadharCard,
        panCardUrl: data.panCardUrl,
        aadharCardUrl: data.aadharCardUrl,
        isPhoneVerified: data.isPhoneVerified,
        // salesPerson and salesInitial are not manually updatable
      },
    });

    this.eventsGateway.broadcastEntityUpdate('CLIENT', id);
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

    this.eventsGateway.broadcastEntityUpdate('CLIENT', id);
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

    await this.prisma.clientJourneyEvent.create({
      data: {
        clientId: clientId,
        eventType: 'LINKED_TO_GYM_PARTNER',
        linkedName: gym.gymName,
        createdBy: 'SYS', // Or user if we add user param later
      }
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
      include: {
        gym: true,
      }
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

    await this.prisma.clientJourneyEvent.create({
      data: {
        clientId: clientId,
        eventType: 'DELINKED_FROM_GYM',
        linkedName: link.gym.gymName,
        createdBy: 'SYS',
      }
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
        throw new NotFoundException(
          `Partner client with ID ${partnerRefId} not found`,
        );
      }
    } else if (partnerType === 'LEAD') {
      const partnerLead = await this.prisma.lead.findUnique({
        where: { id: partnerRefId },
      });
      if (!partnerLead) {
        throw new NotFoundException(
          `Partner lead with ID ${partnerRefId} not found`,
        );
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

  async smartUploadPhoto(clientId: string, file: any, user: any): Promise<any> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client not found');

    const result = await this.filesService.saveFile(file, `clients/${clientId}/visits`);
    
    // Update profile photo
    await this.prisma.client.update({
      where: { id: clientId },
      data: { profilePhoto: result.url },
    });

    // Create SHOWROOM_VISIT event
    const event = await this.prisma.clientJourneyEvent.create({
      data: {
        clientId,
        eventType: 'SHOWROOM_VISIT',
        photoUrl: result.url,
        createdBy: user?.name || 'SYS',
      }
    });

    this.eventsGateway.broadcastEntityUpdate('CLIENT', clientId);
    return { client: await this.findOne(clientId), journeyEvent: event };
  }

  async manualUploadPhoto(clientId: string, file: any, user: any): Promise<any> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client not found');

    const result = await this.filesService.saveFile(file, `clients/${clientId}/visits`);
    
    // Update profile photo
    const updatedClient = await this.prisma.client.update({
      where: { id: clientId },
      data: { profilePhoto: result.url },
    });

    this.eventsGateway.broadcastEntityUpdate('CLIENT', clientId);
    return this.findOne(clientId);
  }

  async getJourney(clientId: string): Promise<any[]> {
    return this.prisma.clientJourneyEvent.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createJourneyEvent(clientId: string, dto: CreateJourneyEventDto, user: any): Promise<any> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client not found');

    const event = await this.prisma.clientJourneyEvent.create({
      data: {
        clientId,
        eventType: dto.eventType,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : null,
        details: dto.details,
        linkedName: dto.linkedName,
        relationship: dto.relationship,
        createdBy: user?.name || 'SYS',
      }
    });

    this.eventsGateway.broadcastEntityUpdate('CLIENT', clientId);
    return event;
  }

  async getDocuments(clientId: string) {
    return this.prisma.clientDocument.findMany({
      where: { clientId },
    });
  }

  async upsertDocument(clientId: string, type: ClientDocumentType, dto: UpdateDocumentDto) {
    const existing = await this.prisma.clientDocument.findFirst({
      where: { clientId, documentType: type },
    });
    
    if (existing) {
      let imageUrls = existing.imageUrls;
      if (dto.imageUrls) {
         imageUrls = [...new Set([...imageUrls, ...dto.imageUrls])];
      }
      return this.prisma.clientDocument.update({
        where: { id: existing.id },
        data: {
          documentNumber: dto.documentNumber !== undefined ? dto.documentNumber : existing.documentNumber,
          fieldData: dto.fieldData !== undefined ? (dto.fieldData as any) : existing.fieldData,
          pdfUrl: dto.pdfUrl !== undefined ? dto.pdfUrl : existing.pdfUrl,
          imageUrls,
          verificationStatus: (dto.pdfUrl || (dto.imageUrls && dto.imageUrls.length > 0)) && existing.verificationStatus === 'NOT_UPLOADED' ? 'UNVERIFIED' : existing.verificationStatus,
        },
      });
    } else {
      return this.prisma.clientDocument.create({
        data: {
          clientId,
          documentType: type,
          documentNumber: dto.documentNumber,
          fieldData: dto.fieldData || {},
          pdfUrl: dto.pdfUrl,
          imageUrls: dto.imageUrls || [],
          verificationStatus: (dto.pdfUrl || (dto.imageUrls && dto.imageUrls.length > 0)) ? 'UNVERIFIED' : 'NOT_UPLOADED',
        },
      });
    }
  }

  async uploadDocumentFile(clientId: string, type: ClientDocumentType, file: Express.Multer.File) {
    let existing = await this.prisma.clientDocument.findFirst({
      where: { clientId, documentType: type },
    });
    
    if (!existing) {
      existing = await this.prisma.clientDocument.create({
        data: {
          clientId,
          documentType: type,
        },
      });
    }
    
    const subfolder = `clients/${clientId}/documents/${type}`;
    const result = await this.filesService.saveFile(file, subfolder);
    
    let extractedFields = {};
    try {
      const bucketName = process.env.AWS_S3_BUCKET || 'probodyline-uploads';
      let blocks: any[] = [];
      if (file.mimetype === 'application/pdf') {
         blocks = await this.textractService.analyzeDocument(bucketName, result.key, undefined, file.mimetype);
      } else {
         blocks = await this.textractService.analyzeDocument(bucketName, result.mainKey, file.buffer, file.mimetype);
      }
      const rawText = this.textractService.extractRawText(blocks);
      const kvPairs = this.textractService.extractKeyValuePairs(blocks);
      extractedFields = await this.documentParserService.parseDocument(type, rawText, kvPairs);
    } catch (ocrError: any) {
      console.warn('OCR failed for document:', ocrError.message);
    }

    let updatedDoc;
    if (file.mimetype === 'application/pdf') {
      updatedDoc = await this.prisma.clientDocument.update({
        where: { id: existing.id },
        data: {
          pdfUrl: result.url,
          verificationStatus: existing.verificationStatus === 'NOT_UPLOADED' ? 'UNVERIFIED' : existing.verificationStatus,
        },
      });
    } else {
      const imageUrls = [...existing.imageUrls, result.url];
      updatedDoc = await this.prisma.clientDocument.update({
        where: { id: existing.id },
        data: {
          imageUrls,
          verificationStatus: existing.verificationStatus === 'NOT_UPLOADED' ? 'UNVERIFIED' : existing.verificationStatus,
        },
      });
    }

    return {
      ...updatedDoc,
      fileUrl: result.url,
      extractedFields
    };
  }

  async parseDocumentFile(clientId: string, type: ClientDocumentType, file: Express.Multer.File) {
    const subfolder = `clients/${clientId}/documents/${type}/temp`;
    const result = await this.filesService.saveFile(file, subfolder);
    
    let extractedFields = {};
    try {
      const bucketName = process.env.AWS_S3_BUCKET || 'probodyline-uploads';
      let blocks: any[] = [];
      if (file.mimetype === 'application/pdf') {
         blocks = await this.textractService.analyzeDocument(bucketName, result.key, undefined, file.mimetype);
      } else {
         blocks = await this.textractService.analyzeDocument(bucketName, result.mainKey, file.buffer, file.mimetype);
      }
      const rawText = this.textractService.extractRawText(blocks);
      const kvPairs = this.textractService.extractKeyValuePairs(blocks);
      
      console.log('====== OCR RAW TEXT ======');
      console.log(rawText);
      console.log('====== OCR KV PAIRS ======');
      console.log(JSON.stringify(kvPairs, null, 2));
      
      extractedFields = await this.documentParserService.parseDocument(type, rawText, kvPairs);
    } catch (ocrError: any) {
      console.warn('OCR failed for document:', ocrError.message);
    }

    return {
      fileUrl: result.url,
      extractedFields
    };
  }

  async deleteDocumentFile(clientId: string, type: ClientDocumentType, index: number) {
    const existing = await this.prisma.clientDocument.findFirst({
      where: { clientId, documentType: type },
    });
    
    if (!existing) {
      throw new NotFoundException('Document not found');
    }
    
    // if index is -1, it's pdf, otherwise it's index in imageUrls
    if (index === -1) {
      if (existing.pdfUrl) {
        await this.filesService.deleteFile(existing.pdfUrl);
      }
      return this.prisma.clientDocument.update({
        where: { id: existing.id },
        data: { pdfUrl: null },
      });
    } else {
      if (existing.imageUrls && existing.imageUrls[index]) {
        await this.filesService.deleteFile(existing.imageUrls[index]);
        const newImageUrls = [...existing.imageUrls];
        newImageUrls.splice(index, 1);
        return this.prisma.clientDocument.update({
          where: { id: existing.id },
          data: { imageUrls: newImageUrls },
        });
      }
    }
    return existing;
  }

  async verifyDocument(clientId: string, type: ClientDocumentType, dto: VerifyDocumentDto) {
    const existing = await this.prisma.clientDocument.findFirst({
      where: { clientId, documentType: type },
    });
    
    if (!existing) {
      throw new NotFoundException('Document not found');
    }
    
    return this.prisma.clientDocument.update({
      where: { id: existing.id },
      data: {
        verificationStatus: 'VERIFIED',
        verifiedBy: dto.verifiedBy,
        verifiedAt: new Date(),
      },
    });
  }

}
