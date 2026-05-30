import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateManagerDto } from './dto/create-manager.dto';
import { UpdateManagerDto } from './dto/update-manager.dto';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class ManagersService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  private async generateManagerCode(): Promise<string> {
    const lastManager = await this.prisma.manager.findFirst({
      orderBy: { managerCode: 'desc' },
    });

    if (!lastManager) {
      return 'MGR 00001';
    }

    const lastNumber = parseInt(lastManager.managerCode.split(' ')[1], 10);
    const newNumber = lastNumber + 1;
    return `MGR ${newNumber.toString().padStart(5, '0')}`;
  }

  private async generateLocationQR(locationLink: string): Promise<string> {
    try {
      return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
        locationLink,
      )}`;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return locationLink;
    }
  }

  async create(createManagerDto: CreateManagerDto) {
    const managerCode = await this.generateManagerCode();
    
    let locationQR: string | null = null;
    if (createManagerDto.locationLink) {
      locationQR = await this.generateLocationQR(createManagerDto.locationLink);
    }

    const manager = await this.prisma.manager.create({
      data: {
        managerCode,
        fullName: createManagerDto.fullName || '',
        phone: createManagerDto.phone,
        alternatePhone: createManagerDto.alternatePhone,
        email: createManagerDto.email,
        stateCode: createManagerDto.stateCode,
        city: createManagerDto.city,
        address: createManagerDto.address,
        instagramLink: createManagerDto.instagramLink,
        profilePhoto: createManagerDto.profilePhoto,
        locationLink: createManagerDto.locationLink,
        locationQR,
        notes: createManagerDto.notes,
      },
    });

    this.eventsGateway.broadcastEntityUpdate('MANAGER', manager.id);
    return manager;
  }

  async findAll(filters?: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page ?? 0;
    const limit = filters?.limit ?? 50;
    const skip = page * limit;

    const where: any = {};
    if (filters?.search) {
      where.OR = [
        { managerCode: { contains: filters.search, mode: 'insensitive' } },
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
        { stateCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.manager.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          gyms: {
            include: {
              gym: true,
            },
          },
        },
      }),
      this.prisma.manager.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id },
      include: {
        gyms: {
          include: {
            gym: true,
          },
        },
      },
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${id} not found`);
    }

    return manager;
  }

  async update(id: string, updateManagerDto: UpdateManagerDto) {
    await this.findOne(id); // Ensure exists

    let locationQR: string | undefined = undefined;
    if (updateManagerDto.locationLink) {
      locationQR = await this.generateLocationQR(updateManagerDto.locationLink);
    }

    const manager = await this.prisma.manager.update({
      where: { id },
      data: {
        ...updateManagerDto,
        ...(locationQR ? { locationQR } : {}),
      },
    });

    this.eventsGateway.broadcastEntityUpdate('MANAGER', manager.id);
    return manager;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.manager.delete({ where: { id } });
    this.eventsGateway.broadcastEntityUpdate('MANAGER', id);
  }
}
