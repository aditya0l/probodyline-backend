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
    const { phone, entityType } = sendOtpDto;
    
    // Resend cooldown check for CLIENT
    if (entityType === 'CLIENT') {
      const recentOtp = await this.prisma.otpSession.findFirst({
        where: {
          phone,
          isUsed: false,
          createdAt: { gt: new Date(Date.now() - 30 * 1000) }, // created within last 30s
        },
      });
      if (recentOtp) {
        throw new BadRequestException('Please wait before requesting another OTP');
      }
    }

    // Generate OTP length based on entityType
    let otp: string;
    let expiresAt = new Date();
    
    if (entityType === 'CLIENT') {
      otp = Math.floor(100 + Math.random() * 900).toString();
      expiresAt.setSeconds(expiresAt.getSeconds() + 90); // 90 seconds expiry
    } else {
      otp = Math.floor(100000 + Math.random() * 900000).toString();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry
    }

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

    // Find latest valid OTP session for this phone (don't filter by otp yet so we can track attempts)
    const session = await this.prisma.otpSession.findFirst({
      where: {
        phone,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Verify OTP match and handle attempts for CLIENT
    if (session.otp !== otp) {
      if (entityType === 'CLIENT') {
        const newAttempts = session.attempts + 1;
        if (newAttempts >= 5) {
          await this.prisma.otpSession.update({
            where: { id: session.id },
            data: { attempts: newAttempts, isUsed: true },
          });
          throw new BadRequestException('Too many incorrect attempts. Please request a new OTP.');
        } else {
          await this.prisma.otpSession.update({
            where: { id: session.id },
            data: { attempts: newAttempts },
          });
          throw new BadRequestException('Invalid OTP');
        }
      } else {
        throw new BadRequestException('Invalid OTP');
      }
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
