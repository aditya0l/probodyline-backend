import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { ClientPhonesService } from '../client-phones/client-phones.service';
import { OtpService } from '../otp/otp.service';
import { FilesService } from '../files/files.service';
import { normalizePhone } from '../common/utils/phone.util';
import { generateClientCode } from '../common/utils/client-code.util';
import { randomUUID } from 'crypto';

// Minimum response time in ms — prevents timing-based inference
const MIN_RESPONSE_MS = 1500;

@Injectable()
export class GuardService {
  constructor(
    private prisma: PrismaService,
    private clientPhonesService: ClientPhonesService,
    private otpService: OtpService,
    private filesService: FilesService,
    private jwtService: JwtService,
  ) {}

  /**
   * POST /guard/otp/send
   * Always returns identical shape regardless of phone existence.
   */
  async sendOtp(rawPhone: string, guardId: string) {
    const phone = normalizePhone(rawPhone);
    if (!phone || phone.length !== 10) {
      throw new BadRequestException('Invalid phone number');
    }

    // Reuse existing OTP infrastructure — entityType GUARD
    // gives 6-digit OTP with 90s expiry + 30s cooldown
    await this.otpService.sendOtp({ phone, entityType: 'GUARD' });

    return { status: 'otp_sent' };
  }

  /**
   * POST /guard/otp/verify
   * Verifies OTP, creates a single-use session token.
   * Does NOT resolve clientId here — deferred to logVisit time.
   */
  async verifyOtp(rawPhone: string, otp: string, guardId: string) {
    const phone = normalizePhone(rawPhone);

    // Verify OTP via existing service (no entityId — we don't mark verified here)
    await this.otpService.verifyOtp({ phone, otp, entityType: 'GUARD' });

    // Create single-use session token
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.prisma.guardOtpSession.create({
      data: {
        jti,
        guardId,
        phone,
        expiresAt,
      },
    });

    const sessionToken = this.jwtService.sign(
      { jti, phone, guardId, purpose: 'guard_visit' },
      { expiresIn: '5m' },
    );

    return { status: 'verified', sessionToken };
  }

  /**
   * POST /guard/visits
   * Resolves clientId FRESH at call time via findActiveByPhone.
   * Creates new client if needed. Logs visit. Single-use token consumed atomically.
   */
  async logVisit(
    sessionToken: string,
    photo: Express.Multer.File,
    latitude: number,
    longitude: number,
    guardId: string,
  ) {
    const startTime = Date.now();

    try {
      // 1. Decode and validate session token
      let payload: { jti: string; phone: string; guardId: string; purpose: string };
      try {
        payload = this.jwtService.verify(sessionToken);
      } catch {
        throw new ForbiddenException('Invalid or expired session token');
      }

      if (payload.purpose !== 'guard_visit') {
        throw new ForbiddenException('Invalid session token');
      }

      if (payload.guardId !== guardId) {
        throw new ForbiddenException('Session token does not belong to this guard');
      }

      // 2. Atomic consumed + expiry check in a single query
      const session = await this.prisma.guardOtpSession.findFirst({
        where: {
          jti: payload.jti,
          consumed: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!session) {
        throw new ForbiddenException('Session token is invalid, expired, or already used');
      }

      // 3. Mark consumed BEFORE doing any work (prevents race on reuse)
      const updated = await this.prisma.guardOtpSession.updateMany({
        where: {
          jti: payload.jti,
          consumed: false, // double-check atomicity
        },
        data: {
          consumed: true,
          consumedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        throw new ForbiddenException('Session token already consumed');
      }

      // 4. Upload photo to S3 (reuse existing FilesService)
      const uploadResult = await this.filesService.saveFile(
        {
          ...photo,
          originalname: `guard-visit-${Date.now()}.jpg`,
        } as Express.Multer.File,
        'guard-visits',
      );
      const photoUrl = uploadResult.url;

      // 5. Resolve clientId FRESH via findActiveByPhone (NOT cached from OTP time)
      const { exists, clientId: existingClientId } =
        await this.clientPhonesService.findActiveByPhone(session.phone);

      // 6. Create visit inside transaction
      await this.prisma.$transaction(async (tx) => {
        let clientId: string;

        if (exists && existingClientId) {
          clientId = existingClientId;
        } else {
          // Create new client with minimal data
          const clientCode = generateClientCode({
            tokenDate: new Date().toISOString(),
            salesInitial: `GUARD-${randomUUID().slice(0, 8).toUpperCase()}`,
          });

          const newClient = await tx.client.create({
            data: { clientCode },
          });

          // Reuse addPhoneInTx for P2002 catch + dormant supersededByPhoneId tracking
          await this.clientPhonesService.addPhoneInTx(tx, newClient.id, session.phone, true);

          clientId = newClient.id;
        }

        // Compute visitNumber inside transaction to prevent race conditions
        const visitCount = await tx.clientVisit.count({ where: { clientId } });

        await tx.clientVisit.create({
          data: {
            clientId,
            guardId,
            photoUrl,
            latitude,
            longitude,
            visitNumber: visitCount + 1,
            otpVerifiedAt: session.createdAt, // When OTP was verified
          },
        });
      });

      // 7. Timing normalization — pad to MIN_RESPONSE_MS
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
      }

      return { status: 'success', visitLogged: true };
    } catch (error) {
      // Timing normalization on error path too
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
      }
      throw error;
    }
  }

  /**
   * GET /guard/admin/visits
   * Returns paginated guard visits with client and guard information.
   */
  async getVisits(page: number, limit: number, filters: { clientId?: string; guardId?: string }) {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.guardId) where.guardId = filters.guardId;

    const [total, visits] = await Promise.all([
      this.prisma.clientVisit.count({ where }),
      this.prisma.clientVisit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: {
              id: true,
              clientCode: true,
              clientName: true,
            },
          },
          guard: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      data: visits,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
