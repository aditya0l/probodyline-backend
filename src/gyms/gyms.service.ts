import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateGymDto } from './dto/create-gym.dto';
import { UpdateGymDto } from './dto/update-gym.dto';
import { CreateInaugurationCommitmentDto } from './dto/create-inauguration-commitment.dto';
import { generateGymCode } from '../common/utils/gym-code.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class GymsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate QR code from location link
   * In production, you might want to use a proper QR code service or library
   * For now, we'll use a placeholder or API service
   */
  private async generateLocationQR(locationLink: string): Promise<string> {
    try {
      // Use an external QR code API service or generate locally
      // For now, return a data URI placeholder
      // In production, use a library like 'qrcode' or a service
      const qrCodeAPI = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(locationLink)}`;
      return qrCodeAPI;
    } catch (error) {
      // Fallback: return the link itself
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
    const where: Prisma.GymWhereInput = {
      deletedAt: null,
      ...(filters?.search && {
        OR: [
          { gymName: { contains: filters.search, mode: 'insensitive' } },
          { city: { contains: filters.search, mode: 'insensitive' } },
          { gymCode: { contains: filters.search, mode: 'insensitive' } },
          { stateCode: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
      ...(filters?.stateCode && { stateCode: filters.stateCode }),
      ...(filters?.city && { city: { contains: filters.city, mode: 'insensitive' } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.gym.findMany({
        where,
        skip: (filters?.page || 0) * (filters?.limit || 50),
        take: filters?.limit || 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.gym.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string): Promise<any> {
    const gym = await this.prisma.gym.findUnique({
      where: { id },
      include: {
        inaugurationHistory: {
          orderBy: { committedFor: 'asc' },
        },
        gymClients: {
          include: {
            client: true,
          },
        },
        gymTechnicians: true,
        gymMedia: {
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
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

    // Check if gym code already exists (should be unique)
    const existingGym = await this.prisma.gym.findUnique({
      where: { gymCode },
    });

    if (existingGym) {
      throw new ConflictException('Gym with this code already exists');
    }

    // Generate location QR if location link is provided
    let locationQR: string | null = null;
    if (data.locationLink) {
      locationQR = await this.generateLocationQR(data.locationLink);
    }

    const gymData = {
      gymCode,
      installationDate: new Date(data.installationDate),
      stateCode: data.stateCode,
      city: data.city,
      gymName: data.gymName,
      branchCode: data.branchCode,
      branchTitle: data.branchTitle,
      salesInitial: data.salesInitial,
      instagramLink: data.instagramLink || null,
      locationLink: data.locationLink || null,
      locationQR,
    };

    const gym = await this.prisma.gym.create({
      data: gymData,
    });

    // Create initial system inauguration commitment
    await this.addInaugurationCommitment(gym.id, {
      committedFor: data.installationDate,
      note: 'Initial system commitment',
      source: 'SYSTEM',
    });

    return gym;
  }

  async update(id: string, data: UpdateGymDto): Promise<any> {
    const gym = await this.prisma.gym.findUnique({
      where: { id },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    // Track installation date changes for audit
    const oldInstallationDate = gym.installationDate;
    const newInstallationDate = data.installationDate ? new Date(data.installationDate) : gym.installationDate;

    // If installation date changed, regenerate gym code
    // Note: In a production system, you might want to keep the old code and track changes via audit log
    // For now, we'll regenerate the code
    let gymCode = gym.gymCode;
    if (data.installationDate && newInstallationDate.getTime() !== oldInstallationDate.getTime()) {
      // Regenerate gym code with new installation date
      gymCode = generateGymCode({
        installationDate: data.installationDate,
        stateCode: data.stateCode || gym.stateCode,
        city: data.city || gym.city,
        gymName: data.gymName || gym.gymName,
        branchCode: data.branchCode ? Number(data.branchCode) : Number(gym.branchCode),
        branchTitle: data.branchTitle || gym.branchTitle,
        salesInitial: data.salesInitial || gym.salesInitial,
      });

      // Check if new code already exists
      const existingGym = await this.prisma.gym.findUnique({
        where: { gymCode },
      });

      if (existingGym && existingGym.id !== id) {
        throw new ConflictException('Gym code with new installation date already exists');
      }
    }

    // Generate location QR if location link changed
    let locationQR = gym.locationQR;
    if (data.locationLink !== undefined) {
      if (data.locationLink) {
        locationQR = await this.generateLocationQR(data.locationLink);
      } else {
        locationQR = null;
      }
    }

    const updateData: any = {
      ...data,
      ...(gymCode !== gym.gymCode && { gymCode }),
      ...(locationQR !== gym.locationQR && { locationQR }),
      ...(data.installationDate && { installationDate: newInstallationDate }),
    };

    return this.prisma.gym.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string): Promise<any> {
    const gym = await this.prisma.gym.findUnique({
      where: { id },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    // Soft delete
    return this.prisma.gym.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getInaugurationHistory(gymId: string): Promise<any[]> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    return this.prisma.inaugurationCommitment.findMany({
      where: { gymId },
      orderBy: { committedFor: 'asc' },
    });
  }

  async addInaugurationCommitment(
    gymId: string,
    data: CreateInaugurationCommitmentDto & { source?: 'SYSTEM' | 'USER'; createdBy?: string },
  ): Promise<any> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    return this.prisma.inaugurationCommitment.create({
      data: {
        gymId,
        committedFor: new Date(data.committedFor),
        note: data.note || null,
        source: data.source || 'USER',
        createdBy: data.createdBy || null,
      },
    });
  }

  async linkClient(gymId: string, clientId: string): Promise<any> {
    const [gym, client] = await Promise.all([
      this.prisma.gym.findUnique({ where: { id: gymId } }),
      this.prisma.client.findUnique({ where: { id: clientId } }),
    ]);

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Generate reference code (using client code format)
    const referenceCode = `${new Date().toISOString().split('T')[0]}/${client.stateCode}/${client.city}/${client.clientName}/${client.salesInitial}`;

    // Check if already linked
    const existing = await this.prisma.gymClient.findUnique({
      where: {
        gymId_clientId: {
          gymId,
          clientId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Client is already linked to this gym');
    }

    return this.prisma.gymClient.create({
      data: {
        gymId,
        clientId,
        referenceCode,
      },
      include: {
        client: true,
      },
    });
  }

  async unlinkClient(gymId: string, clientId: string): Promise<void> {
    const link = await this.prisma.gymClient.findUnique({
      where: {
        gymId_clientId: {
          gymId,
          clientId,
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Client is not linked to this gym');
    }

    await this.prisma.gymClient.delete({
      where: {
        gymId_clientId: {
          gymId,
          clientId,
        },
      },
    });
  }

  async getGymClients(gymId: string): Promise<any[]> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    return this.prisma.gymClient.findMany({
      where: { gymId },
      include: {
        client: true,
      },
    });
  }

  async linkTechnician(gymId: string, technicianId: string): Promise<any> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
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
      throw new ConflictException('Technician is already linked to this gym');
    }

    return this.prisma.gymTechnician.create({
      data: {
        gymId,
        technicianId,
      },
    });
  }

  async unlinkTechnician(gymId: string, technicianId: string): Promise<void> {
    const link = await this.prisma.gymTechnician.findUnique({
      where: {
        gymId_technicianId: {
          gymId,
          technicianId,
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Technician is not linked to this gym');
    }

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
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    return this.prisma.gymTechnician.findMany({
      where: { gymId },
    });
  }

  async uploadGymMedia(
    gymId: string,
    file: Express.Multer.File,
    mediaType: 'IMAGE' | 'VIDEO',
  ): Promise<any> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    // In production, upload file to storage (S3, etc.) and get URL
    // For now, use a placeholder URL
    const url = file.path || `https://example.com/media/${file.filename}`;

    return this.prisma.gymMedia.create({
      data: {
        gymId,
        mediaType,
        url,
        uploadedBy: null, // TODO: Get from authenticated user
      },
    });
  }

  async deleteGymMedia(gymId: string, mediaId: string): Promise<void> {
    const media = await this.prisma.gymMedia.findUnique({
      where: { id: mediaId },
    });

    if (!media || media.gymId !== gymId) {
      throw new NotFoundException('Media not found');
    }

    await this.prisma.gymMedia.delete({
      where: { id: mediaId },
    });
  }

  async getGymMedia(gymId: string): Promise<any[]> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    return this.prisma.gymMedia.findMany({
      where: { gymId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async getGymSummary(gymId: string): Promise<any> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    const [clients, quotes, orders, technicians] = await Promise.all([
      this.prisma.gymClient.count({
        where: { gymId },
      }),
      this.prisma.quotation.count({
        where: {
          gymId,
          deletedAt: null,
        },
      }),
      this.prisma.quotation.count({
        where: {
          gymId,
          status: 'CONFIRMED',
          deletedAt: null,
        },
      }),
      this.prisma.gymTechnician.count({
        where: { gymId },
      }),
    ]);

    // Get latest inauguration commitment
    const latestCommitment = await this.prisma.inaugurationCommitment.findFirst({
      where: { gymId },
      orderBy: { committedFor: 'desc' },
    });

    return {
      clientCount: clients,
      quoteCount: quotes,
      orderCount: orders,
      technicianCount: technicians,
      latestInaugurationDate: latestCommitment?.committedFor || null,
    };
  }
}

