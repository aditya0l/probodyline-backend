import { Injectable, InternalServerErrorException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class OtpService {
  private snsClient: SNSClient;

  constructor(private prisma: PrismaService) {
    this.snsClient = new SNSClient({
      region: process.env.AWS_REGION || 'ap-south-1', // Defaulting to Mumbai region for India
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async sendOtp(sendOtpDto: SendOtpDto) {
    const { phone } = sendOtpDto;
    
    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    // Save to DB
    await this.prisma.otpSession.create({
      data: {
        phone,
        otp,
        expiresAt,
      },
    });

    const message = `Your Pro Bodyline verification code is: ${otp}`;

    try {
      const command = new PublishCommand({
        PhoneNumber: phone.startsWith('+') ? phone : `+91${phone}`,
        Message: message,
      });

      await this.snsClient.send(command);

      return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
      console.error('Error sending SMS via AWS SNS:', error);
      throw new InternalServerErrorException('Failed to send OTP via SMS');
    }
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { phone, otp, entityId, entityType } = verifyOtpDto;

    // Find latest valid OTP
    const session = await this.prisma.otpSession.findFirst({
      where: {
        phone,
        otp,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Mark as used
    await this.prisma.otpSession.update({
      where: { id: session.id },
      data: { isUsed: true },
    });

    // Update entity if specified
    if (entityId && entityType) {
      try {
        if (entityType === 'CUSTOMER') {
          await this.prisma.customer.update({
            where: { id: entityId },
            data: { isPhoneVerified: true },
          });
        } else if (entityType === 'MANAGER') {
          await this.prisma.manager.update({
            where: { id: entityId },
            data: { isPhoneVerified: true },
          });
        } else if (entityType === 'TRAINER') {
          await this.prisma.trainer.update({
            where: { id: entityId },
            data: { isPhoneVerified: true },
          });
        } else if (entityType === 'CLIENT') {
          await this.prisma.client.update({
            where: { id: entityId },
            data: { isPhoneVerified: true },
          });
        }
      } catch (e) {
         console.warn(`Could not update isPhoneVerified for ${entityType} ${entityId}`);
      }
    }

    return { success: true, message: 'Phone verified successfully' };
  }
}
