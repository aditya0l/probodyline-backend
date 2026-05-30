import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { UpdateTrainerDto } from './dto/update-trainer.dto';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class TrainersService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  private async generateTrainerCode(): Promise<string> {
    const lastTrainer = await this.prisma.trainer.findFirst({
      orderBy: { trainerCode: 'desc' },
    });

    if (!lastTrainer) {
      return 'TRN 00001';
    }

    const lastNumber = parseInt(lastTrainer.trainerCode.split(' ')[1], 10);
    const newNumber = lastNumber + 1;
    return `TRN ${newNumber.toString().padStart(5, '0')}`;
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

  async create(createTrainerDto: CreateTrainerDto) {
    const trainerCode = await this.generateTrainerCode();
    
    let locationQR: string | null = null;
    if (createTrainerDto.locationLink) {
      locationQR = await this.generateLocationQR(createTrainerDto.locationLink);
    }

    const trainer = await this.prisma.trainer.create({
      data: {
        trainerCode,
        fullName: createTrainerDto.fullName || '',
        phone: createTrainerDto.phone,
        alternatePhone: createTrainerDto.alternatePhone,
        email: createTrainerDto.email,
        stateCode: createTrainerDto.stateCode,
        city: createTrainerDto.city,
        address: createTrainerDto.address,
        specialisation: createTrainerDto.specialisation,
        instagramLink: createTrainerDto.instagramLink,
        profilePhoto: createTrainerDto.profilePhoto,
        locationLink: createTrainerDto.locationLink,
        locationQR,
        notes: createTrainerDto.notes,
      },
    });

    this.eventsGateway.broadcastEntityUpdate('TRAINER', trainer.id);
    return trainer;
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
        { trainerCode: { contains: filters.search, mode: 'insensitive' } },
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
        { stateCode: { contains: filters.search, mode: 'insensitive' } },
        { specialisation: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.trainer.findMany({
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
      this.prisma.trainer.count({ where }),
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
    const trainer = await this.prisma.trainer.findUnique({
      where: { id },
      include: {
        gyms: {
          include: {
            gym: true,
          },
        },
      },
    });

    if (!trainer) {
      throw new NotFoundException(`Trainer with ID ${id} not found`);
    }

    return trainer;
  }

  async update(id: string, updateTrainerDto: UpdateTrainerDto) {
    await this.findOne(id); // Ensure exists

    let locationQR: string | undefined = undefined;
    if (updateTrainerDto.locationLink) {
      locationQR = await this.generateLocationQR(updateTrainerDto.locationLink);
    }

    const trainer = await this.prisma.trainer.update({
      where: { id },
      data: {
        ...updateTrainerDto,
        ...(locationQR ? { locationQR } : {}),
      },
    });

    this.eventsGateway.broadcastEntityUpdate('TRAINER', trainer.id);
    return trainer;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.trainer.delete({ where: { id } });
    this.eventsGateway.broadcastEntityUpdate('TRAINER', id);
  }
}
