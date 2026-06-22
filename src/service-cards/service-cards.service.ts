import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  CreateServiceCardDto,
  UpdateServiceCardDto,
} from './dto/create-service-card.dto';
import { Prisma } from '@prisma/client';
import { userContext } from '../common/context';

@Injectable()
export class ServiceCardsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateServiceCardDto) {
    const data: Prisma.ServiceCardCreateInput = {
      installationDate: createDto.installationDate
        ? new Date(createDto.installationDate)
        : undefined,
      stateCode: createDto.stateCode,
      city: createDto.city,
      gymName: createDto.gymName,
      branchCode: createDto.branchCode,
      branchTitle: createDto.branchTitle,
      salesInitial: createDto.salesInitial,
      contactAtGym: createDto.contactAtGym,
      contactNo: createDto.contactNo,
      engineers: createDto.engineers as unknown as Prisma.InputJsonValue,
      landmark: createDto.landmark,
      locationQR: createDto.locationQR,
      visitType: createDto.visitType,
      installationAndServiceCharges: createDto.installationAndServiceCharges,
      estimatedExpense: createDto.estimatedExpense,
      techEngineerName: createDto.techEngineerName,
      reimbursementTravel: createDto.reimbursementTravel,
      reimbursementHotel: createDto.reimbursementHotel,
      reimbursementFood: createDto.reimbursementFood,
      reimbursementOilSpray: createDto.reimbursementOilSpray,
      reimbursementSpare: createDto.reimbursementSpare,
      startDate: createDto.startDate
        ? new Date(createDto.startDate)
        : undefined,
      startTime: createDto.startTime,
      techActualExpense: createDto.techActualExpense,
      expenseLog: createDto.expenseLog as unknown as Prisma.InputJsonValue,
      endDate: createDto.endDate ? new Date(createDto.endDate) : undefined,
      endTime: createDto.endTime,
      pendingWork: createDto.pendingWork,
      waitingTimeOnClientRequest: createDto.waitingTimeOnClientRequest,
      engineerSign: createDto.engineerSign,
      sAmount: createDto.sAmount,
      otAmount: createDto.otAmount,
      accountsActualExpense: createDto.accountsActualExpense,
      accountsReimbursement: createDto.accountsReimbursement,
      netCtc: createDto.netCtc,
      status: createDto.status as Prisma.ServiceCardCreateInput['status'],
      productNotes: createDto.productNotes as Prisma.InputJsonValue,
      clientName: createDto.clientName,
    };

    if (createDto.gymId) {
      data.gym = { connect: { id: createDto.gymId } };
    }

    if (createDto.clientId) {
      data.client = { connect: { id: createDto.clientId } };
    }

    if (createDto.salesOrderId) {
      data.salesOrder = { connect: { id: createDto.salesOrderId } };
    }

    return this.prisma.serviceCard.create({
      data,
    });
  }

  async findAll(gymId?: string) {
    const whereClause: Prisma.ServiceCardWhereInput = {};
    if (gymId) {
      whereClause.gymId = gymId;
    }

    return this.prisma.serviceCard.findMany({
      where: whereClause,
      orderBy: { serialNumber: 'desc' },
      select: {
        id: true,
        serialNumber: true,
        filledOnDate: true,
        gymName: true,
        city: true,
        stateCode: true,
        engineers: true,
        techEngineerName: true,
        visitType: true,
        installationDate: true,
        status: true,
      },
    });
  }

  async findOne(id: string) {
    const card = await this.prisma.serviceCard.findUnique({
      where: { id },
      include: {
        gym: true,
        salesOrder: {
          include: {
            quotation: {
              include: {
                items: true,
              },
            },
          },
        },
      },
    });

    if (!card) {
      throw new NotFoundException(`Service Card with ID ${id} not found`);
    }
    return card;
  }

  async update(id: string, updateDto: UpdateServiceCardDto) {
    const data: Prisma.ServiceCardUpdateInput = {
      installationDate: updateDto.installationDate
        ? new Date(updateDto.installationDate)
        : undefined,
      stateCode: updateDto.stateCode,
      city: updateDto.city,
      gymName: updateDto.gymName,
      branchCode: updateDto.branchCode,
      branchTitle: updateDto.branchTitle,
      salesInitial: updateDto.salesInitial,
      contactAtGym: updateDto.contactAtGym,
      contactNo: updateDto.contactNo,
      engineers: updateDto.engineers as unknown as Prisma.InputJsonValue,
      landmark: updateDto.landmark,
      locationQR: updateDto.locationQR,
      visitType: updateDto.visitType,
      installationAndServiceCharges: updateDto.installationAndServiceCharges,
      estimatedExpense: updateDto.estimatedExpense,
      techEngineerName: updateDto.techEngineerName,
      reimbursementTravel: updateDto.reimbursementTravel,
      reimbursementHotel: updateDto.reimbursementHotel,
      reimbursementFood: updateDto.reimbursementFood,
      reimbursementOilSpray: updateDto.reimbursementOilSpray,
      reimbursementSpare: updateDto.reimbursementSpare,
      startDate: updateDto.startDate
        ? new Date(updateDto.startDate)
        : undefined,
      startTime: updateDto.startTime,
      techActualExpense: updateDto.techActualExpense,
      expenseLog: updateDto.expenseLog as unknown as Prisma.InputJsonValue,
      endDate: updateDto.endDate ? new Date(updateDto.endDate) : undefined,
      endTime: updateDto.endTime,
      pendingWork: updateDto.pendingWork,
      waitingTimeOnClientRequest: updateDto.waitingTimeOnClientRequest,
      engineerSign: updateDto.engineerSign,
      sAmount: updateDto.sAmount,
      otAmount: updateDto.otAmount,
      accountsActualExpense: updateDto.accountsActualExpense,
      accountsReimbursement: updateDto.accountsReimbursement,
      netCtc: updateDto.netCtc,
      status: updateDto.status as Prisma.ServiceCardUpdateInput['status'],
      productNotes: updateDto.productNotes as Prisma.InputJsonValue,
      clientName: updateDto.clientName,
    };

    if (updateDto.gymId !== undefined) {
      if (updateDto.gymId) {
        data.gym = { connect: { id: updateDto.gymId } };
      } else {
        data.gym = { disconnect: true };
      }
    }

    if (updateDto.clientId !== undefined) {
      if (updateDto.clientId) {
        data.client = { connect: { id: updateDto.clientId } };
      } else {
        data.client = { disconnect: true };
      }
    }

    if (updateDto.salesOrderId !== undefined) {
      if (updateDto.salesOrderId) {
        data.salesOrder = { connect: { id: updateDto.salesOrderId } };
      } else {
        data.salesOrder = { disconnect: true };
      }
    }

    return this.prisma.serviceCard.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.serviceCard.delete({
      where: { id },
    });
  }
}
