import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma } from '@prisma/client';
import { normalizePhone } from '../common/utils/phone.util';

@Injectable()
export class ClientPhonesService {
  constructor(private prisma: PrismaService) {}

  async addPhone(clientId: string, rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    
    // Quick pre-check (reduces transaction bloat)
    const activePhone = await this.prisma.clientPhone.findFirst({
      where: { phone, isDormant: false },
    });

    if (activePhone) {
      throw new ConflictException('This number is already registered to another profile');
    }

    const existingCount = await this.prisma.clientPhone.count({ where: { clientId } });
    const isPrimary = existingCount === 0;

    const dormantPhone = await this.prisma.clientPhone.findFirst({
      where: { phone, isDormant: true },
      orderBy: { createdAt: 'desc' }
    });

    try {
      // Transaction wrapper for create + superseded flip
      return await this.prisma.$transaction(async (tx) => {
        const newPhone = await tx.clientPhone.create({
          data: { phone, clientId, isPrimary },
        });

        if (dormantPhone) {
          await tx.clientPhone.update({
            where: { id: dormantPhone.id },
            data: { supersededByPhoneId: newPhone.id },
          });
        }

        return newPhone;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
         throw new ConflictException('This number is already registered to another profile');
      }
      throw error;
    }
  }

  async markDormant(id: string, adminId: string) {
    const phoneRecord = await this.prisma.clientPhone.findUnique({ where: { id } });
    if (!phoneRecord) throw new NotFoundException('ClientPhone not found');
    if (phoneRecord.isDormant) return phoneRecord; // Idempotent

    // Wrap flip, auto-promote, and audit logging in a single transaction
    return this.prisma.$transaction(async (tx) => {
      
      const updated = await tx.clientPhone.update({
        where: { id },
        data: {
          isDormant: true,
          dormantAt: new Date(),
          dormantBy: adminId,
          isPrimary: false 
        },
      });

      if (phoneRecord.isPrimary) {
        const nextActive = await tx.clientPhone.findFirst({
          where: { clientId: phoneRecord.clientId, isDormant: false },
          orderBy: { createdAt: 'asc' },
        });
        
        if (nextActive) {
          await tx.clientPhone.update({
            where: { id: nextActive.id },
            data: { isPrimary: true },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          entityType: 'ClientPhone',
          entityId: id,
          action: 'MARK_DORMANT',
          userId: adminId,
          changes: { old: phoneRecord as any, new: updated as any }
        }
      });

      return updated;
    });
  }

  async reactivate(id: string, adminId: string) {
    const phoneRecord = await this.prisma.clientPhone.findUnique({ where: { id } });
    if (!phoneRecord) throw new NotFoundException('ClientPhone not found');
    if (!phoneRecord.isDormant) return phoneRecord; 

    const activeConflict = await this.prisma.clientPhone.findFirst({
      where: { phone: phoneRecord.phone, isDormant: false },
    });

    if (activeConflict) {
      throw new ConflictException('This number is actively used by another profile and cannot be reactivated.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.clientPhone.update({
        where: { id },
        data: {
          isDormant: false,
          dormantAt: null,
          dormantBy: null,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'ClientPhone',
          entityId: id,
          action: 'REACTIVATE',
          userId: adminId,
          changes: { old: phoneRecord as any, new: updated as any }
        }
      });

      return updated;
    });
  }
}
