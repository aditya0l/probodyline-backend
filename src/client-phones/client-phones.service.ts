import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma } from '@prisma/client';
import { normalizePhone } from '../common/utils/phone.util';

@Injectable()
export class ClientPhonesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Single source of truth for phone existence checks.
   * Returns whether an active (non-dormant) ClientPhone exists for this number,
   * and the associated clientId if so. No other client data is returned.
   */
  async findActiveByPhone(rawPhone: string): Promise<{ exists: boolean; clientId: string | null }> {
    const phone = normalizePhone(rawPhone);
    const record = await this.prisma.clientPhone.findFirst({
      where: { phone, isDormant: false },
      select: { clientId: true },
    });
    return record
      ? { exists: true, clientId: record.clientId }
      : { exists: false, clientId: null };
  }

  /**
   * Core phone-creation logic that runs inside an existing transaction.
   * Handles: isPrimary auto-set, dormant supersededByPhoneId tracking,
   * and P2002 unique constraint race-condition catch.
   */
  async addPhoneInTx(
    tx: any, // Prisma transaction client
    clientId: string,
    rawPhone: string,
    isPhoneVerified: boolean = false, // default false — only Guard passes true
  ) {
    const phone = normalizePhone(rawPhone);

    // Pre-check for active conflict
    const activePhone = await tx.clientPhone.findFirst({
      where: { phone, isDormant: false },
    });
    if (activePhone) {
      throw new ConflictException('This number is already registered to another profile');
    }

    const existingCount = await tx.clientPhone.count({ where: { clientId } });
    const isPrimary = existingCount === 0;

    const dormantPhone = await tx.clientPhone.findFirst({
      where: { phone, isDormant: true },
      orderBy: { createdAt: 'desc' },
    });

    try {
      const newPhone = await tx.clientPhone.create({
        data: { phone, clientId, isPrimary, isPhoneVerified },
      });

      if (dormantPhone) {
        await tx.clientPhone.update({
          where: { id: dormantPhone.id },
          data: { supersededByPhoneId: newPhone.id },
        });
      }

      return newPhone;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This number is already registered to another profile');
      }
      throw error;
    }
  }

  async addPhone(clientId: string, rawPhone: string) {
    // Quick pre-check outside transaction (reduces transaction bloat)
    const phone = normalizePhone(rawPhone);
    const activePhone = await this.prisma.clientPhone.findFirst({
      where: { phone, isDormant: false },
    });
    if (activePhone) {
      throw new ConflictException('This number is already registered to another profile');
    }

    return this.prisma.$transaction(async (tx) => {
      return this.addPhoneInTx(tx, clientId, rawPhone);
    });
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
