import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateGymDto } from './dto/create-gym.dto';
import { UpdateGymDto } from './dto/update-gym.dto';
import { CreateInaugurationCommitmentDto } from './dto/create-inauguration-commitment.dto';
import { generateGymCode } from '../common/utils/gym-code.util';

@Injectable()
export class GymsService {
  constructor(private prisma: PrismaService) { }

  private async generateLocationQR(locationLink: string): Promise<string> {
    try {
      const qrCodeAPI = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(locationLink)}`;
      return qrCodeAPI;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return locationLink;
    }
  }

  async findAll(filters?: {
    search?: string;
    stateCode?: string;
    city?: string;
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
        { gymCode: { contains: filters.search, mode: 'insensitive' } },
        { gymName: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
        { branchTitle: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.stateCode) {
      where.stateCode = filters.stateCode;
    }

    if (filters?.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    // Execute query
    const [gyms, total] = await Promise.all([
      this.prisma.gym.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.gym.count({ where }),
    ]);

    return { data: gyms, total };
  }

  async findOne(id: string): Promise<any> {
    const gym = await this.prisma.gym.findUnique({
      where: { id },
      include: {
        clients: {
          include: {
            client: true,
          },
        },
        technicians: true,
        media: true,
        inaugurations: {
          orderBy: { committedOn: 'desc' },
        },
      },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${id} not found`);
    }

    return gym;
  }

  async create(data: CreateGymDto): Promise<any> {
    // Generate gym code
    const gymCode = generateGymCode({
      installationDate: data.installationDate,
      stateCode: data.stateCode,
      city: data.city,
      gymName: data.gymName,
      branchCode: data.branchCode,
      branchTitle: data.branchTitle,
      salesInitial: data.salesInitial,
    });

    // Check if gym code already exists
    const existing = await this.prisma.gym.findUnique({
      where: { gymCode },
    });

    if (existing) {
      throw new ConflictException(`Gym with code ${gymCode} already exists`);
    }

    // Generate location QR if location link provided
    let locationQR: string | undefined;
    if (data.locationLink) {
      locationQR = await this.generateLocationQR(data.locationLink);
    }

    // Create gym
    const gym = await this.prisma.gym.create({
      data: {
        gymCode,
        installationDate: data.installationDate ? new Date(data.installationDate) : undefined,
        stateCode: data.stateCode ? data.stateCode.toUpperCase() : data.stateCode,
        city: data.city ? data.city.toUpperCase() : data.city,
        gymName: data.gymName ? data.gymName.toUpperCase() : data.gymName,
        branchCode: data.branchCode,
        branchTitle: data.branchTitle ? data.branchTitle.toUpperCase() : data.branchTitle,
        salesInitial: data.salesInitial ? data.salesInitial.toUpperCase() : data.salesInitial,
        callSign: data.callSign ? data.callSign.toUpperCase() : data.callSign,
        instagramLink: data.instagramLink,
        locationLink: data.locationLink,
        locationQR,
      } as any,
    });

    return gym;
  }

  async update(id: string, data: UpdateGymDto): Promise<any> {
    // Verify gym exists
    const gym = await this.prisma.gym.findUnique({
      where: { id },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${id} not found`);
    }

    // Generate new location QR if location link changed
    let locationQR: string | undefined;
    if (data.locationLink && data.locationLink !== gym.locationLink) {
      locationQR = await this.generateLocationQR(data.locationLink);
    }

    // Regenerate gym code using merged data (existing + updated fields)
    const mergedInstallationDate = data.installationDate !== undefined
      ? data.installationDate
      : (gym.installationDate ? gym.installationDate.toISOString().split('T')[0] : undefined);
    const mergedStateCode = (data.stateCode !== undefined ? data.stateCode : gym.stateCode) ?? undefined;
    const mergedCity = (data.city !== undefined ? data.city : gym.city) ?? undefined;
    const mergedGymName = (data.gymName !== undefined ? data.gymName : gym.gymName) ?? undefined;
    const mergedBranchCode = (data.branchCode !== undefined ? data.branchCode : gym.branchCode) ?? undefined;
    const mergedBranchTitle = (data.branchTitle !== undefined ? data.branchTitle : gym.branchTitle) ?? undefined;
    const mergedSalesInitial = (data.salesInitial !== undefined ? data.salesInitial : gym.salesInitial) ?? undefined;

    const newGymCode = generateGymCode({
      installationDate: mergedInstallationDate,
      stateCode: mergedStateCode,
      city: mergedCity,
      gymName: mergedGymName,
      branchCode: mergedBranchCode,
      branchTitle: mergedBranchTitle,
      salesInitial: mergedSalesInitial,
    });

    // Update gym
    const updated = await this.prisma.gym.update({
      where: { id },
      data: {
        gymCode: newGymCode,
        installationDate: data.installationDate
          ? new Date(data.installationDate)
          : undefined,
        stateCode: data.stateCode ? data.stateCode.toUpperCase() : data.stateCode,
        city: data.city ? data.city.toUpperCase() : data.city,
        gymName: data.gymName ? data.gymName.toUpperCase() : data.gymName,
        branchCode: data.branchCode,
        branchTitle: data.branchTitle ? data.branchTitle.toUpperCase() : data.branchTitle,
        salesInitial: data.salesInitial ? data.salesInitial.toUpperCase() : data.salesInitial,
        callSign: data.callSign ? data.callSign.toUpperCase() : data.callSign,
        instagramLink: data.instagramLink,
        locationLink: data.locationLink,
        locationQR: locationQR !== undefined ? locationQR : undefined,
      } as any,
    });

    return updated;
  }

  async remove(id: string): Promise<any> {
    // Verify gym exists
    const gym = await this.prisma.gym.findUnique({
      where: { id },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${id} not found`);
    }

    // Delete gym (cascade will handle relationships)
    await this.prisma.gym.delete({
      where: { id },
    });

    return { message: 'Gym deleted successfully' };
  }

  async getInaugurationHistory(gymId: string): Promise<any[]> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      include: {
        inaugurations: {
          orderBy: { committedOn: 'desc' },
        },
      },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${gymId} not found`);
    }

    return gym.inaugurations;
  }

  async addInaugurationCommitment(
    gymId: string,
    data: CreateInaugurationCommitmentDto & {
      source?: 'SYSTEM' | 'USER';
      createdBy?: string;
    },
  ): Promise<any> {
    // Verify gym exists
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${gymId} not found`);
    }

    // Create inauguration commitment
    const commitment = await this.prisma.inaugurationCommitment.create({
      data: {
        gymId,
        committedFor: new Date(data.committedFor),
        source: data.source || 'USER',
        note: data.note,
        createdBy: data.createdBy,
      },
    });

    return commitment;
  }

  async linkClient(gymId: string, clientId: string): Promise<any> {
    // Verify gym exists
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${gymId} not found`);
    }

    // Verify client exists
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
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
      throw new ConflictException('Gym and Client are already linked');
    }

    // Create link
    const link = await this.prisma.clientGym.create({
      data: {
        clientId,
        gymId,
      },
      include: {
        client: true,
      },
    });

    return link;
  }

  async unlinkClient(gymId: string, clientId: string): Promise<void> {
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
      throw new NotFoundException('Gym-Client link not found');
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

  async getGymClients(gymId: string): Promise<any[]> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      include: {
        clients: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${gymId} not found`);
    }

    return gym.clients;
  }

  async linkTechnician(gymId: string, technicianId: string): Promise<any> {
    // Verify gym exists
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${gymId} not found`);
    }

    // Check if already linked
    const existing = await this.prisma.gymTechnician.findUnique({
      where: {
        gymId_technicianId: {
          gymId,
          technicianId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Gym and Technician are already linked');
    }

    // Create link
    const link = await this.prisma.gymTechnician.create({
      data: {
        gymId,
        technicianId,
      },
    });

    return link;
  }

  async unlinkTechnician(gymId: string, technicianId: string): Promise<void> {
    // Verify link exists
    const link = await this.prisma.gymTechnician.findUnique({
      where: {
        gymId_technicianId: {
          gymId,
          technicianId,
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Gym-Technician link not found');
    }

    // Delete link
    await this.prisma.gymTechnician.delete({
      where: {
        gymId_technicianId: {
          gymId,
          technicianId,
        },
      },
    });
  }

  async getGymTechnicians(gymId: string): Promise<any[]> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      include: {
        technicians: true,
      },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${gymId} not found`);
    }

    return gym.technicians;
  }

  async uploadGymMedia(
    gymId: string,
    file: Express.Multer.File,
    mediaType: 'IMAGE' | 'VIDEO',
  ): Promise<any> {
    // Verify gym exists
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${gymId} not found`);
    }

    // TODO: Implement actual file upload logic
    // For now, just store the filename
    const url = `/uploads/gyms/${gymId}/${file.filename}`;

    // Create media record
    const media = await this.prisma.gymMedia.create({
      data: {
        gymId,
        mediaType,
        url,
        uploadedBy: undefined, // TODO: Get from auth context
      },
    });

    return media;
  }

  async deleteGymMedia(gymId: string, mediaId: string): Promise<void> {
    // Verify media exists and belongs to gym
    const media = await this.prisma.gymMedia.findUnique({
      where: { id: mediaId },
    });

    if (!media || media.gymId !== gymId) {
      throw new NotFoundException('Gym media not found');
    }

    // Delete media record
    await this.prisma.gymMedia.delete({
      where: { id: mediaId },
    });

    // TODO: Delete actual file from storage
  }

  async getGymMedia(gymId: string): Promise<any[]> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      include: {
        media: {
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${gymId} not found`);
    }

    return gym.media;
  }

  async getGymSummary(gymId: string): Promise<any> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      include: {
        clients: true,
        technicians: true,
        media: true,
        inaugurations: true,
      },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${gymId} not found`);
    }

    // TODO: Add quotations and orders count when those relationships are added
    return {
      hasClient: gym.clients.length > 0,
      technicianCount: gym.technicians.length,
      mediaCount: gym.media.length,
      inaugurationCount: gym.inaugurations.length,
      quoteCount: 0, // TODO: Implement
      orderCount: 0, // TODO: Implement
    };
  }
}
