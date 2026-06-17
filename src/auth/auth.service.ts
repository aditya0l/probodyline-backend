import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { SmsService } from './sms.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private smsService: SmsService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate organization if provided
    if (registerDto.organizationId) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: registerDto.organizationId },
      });

      if (!organization) {
        throw new BadRequestException('Organization not found');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        name: registerDto.name,
        organizationId: registerDto.organizationId,
        role: registerDto.role || 'USER',
      },
    });

    // Generate JWT token
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId || undefined,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const devEmail = process.env.DEV_EMAIL || 'probodyline@email.com';
    const devPassword = process.env.DEV_PASSWORD || 'logo@1234';

    if (loginDto.email !== devEmail || loginDto.password !== devPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const payload = { sub: 'dev-user-id', email: devEmail, role: 'ADMIN' };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: 'dev-user-id',
        email: devEmail,
        name: 'Admin',
        role: 'ADMIN',
      },
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  }

  async sendOtp(phone: string): Promise<{ success: boolean; message: string }> {
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

    // Send via SMS Service
    const sent = await this.smsService.sendOtp(phone, otp);
    
    if (!sent) {
      throw new BadRequestException('Failed to send OTP via SMS provider');
    }

    return { success: true, message: 'OTP sent successfully' };
  }

  async verifyOtp(phone: string, otp: string, userType: 'Customer' | 'Manager' | 'Trainer'): Promise<{ success: boolean; message: string }> {
    // Find valid OTP session
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

    // Mark session as used
    await this.prisma.otpSession.update({
      where: { id: session.id },
      data: { isUsed: true },
    });

    // Mark the corresponding user's phone as verified
    try {
      if (userType === 'Customer') {
        await this.prisma.customer.updateMany({
          where: { phone },
          data: { isPhoneVerified: true },
        });
      } else if (userType === 'Manager') {
        await this.prisma.manager.updateMany({
          where: { phone },
          data: { isPhoneVerified: true },
        });
      } else if (userType === 'Trainer') {
        await this.prisma.trainer.updateMany({
          where: { phone },
          data: { isPhoneVerified: true },
        });
      }
    } catch (error) {
      console.error(`Failed to update isPhoneVerified for ${userType} with phone ${phone}:`, error);
    }

    return { success: true, message: 'Phone number verified successfully' };
  }
}
