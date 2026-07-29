import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { GuardService } from './guard.service';

@ApiTags('guard')
@Controller('guard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.GUARD)
@ApiBearerAuth()
export class GuardController {
  constructor(private readonly guardService: GuardService) {}

  @Post('otp/send')
  @ApiOperation({ summary: 'Send OTP to client phone number (Guard flow)' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async sendOtp(
    @Body() body: { phone: string },
    @CurrentUser() user: any,
  ) {
    if (!body.phone) {
      throw new BadRequestException('Phone number is required');
    }
    return this.guardService.sendOtp(body.phone, user.id);
  }

  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify OTP and get single-use session token (Guard flow)' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async verifyOtp(
    @Body() body: { phone: string; otp: string },
    @CurrentUser() user: any,
  ) {
    if (!body.phone || !body.otp) {
      throw new BadRequestException('Phone and OTP are required');
    }
    return this.guardService.verifyOtp(body.phone, body.otp, user.id);
  }

  @Post('visits')
  @ApiOperation({ summary: 'Log a guard visit with photo (Guard flow)' })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async logVisit(
    @UploadedFile() photo: Express.Multer.File,
    @Body() body: { sessionToken: string; latitude: string; longitude: string },
    @CurrentUser() user: any,
  ) {
    if (!body.sessionToken) {
      throw new BadRequestException('sessionToken is required');
    }
    if (!photo) {
      throw new BadRequestException('Photo is required');
    }
    if (!body.latitude || !body.longitude) {
      throw new BadRequestException('Latitude and longitude are required');
    }

    return this.guardService.logVisit(
      body.sessionToken,
      photo,
      parseFloat(body.latitude),
      parseFloat(body.longitude),
      user.id,
    );
  }

  @Get('admin/visits')
  @ApiOperation({ summary: 'List guard visits (Admin only)' })
  @Roles(UserRole.ADMIN) // Definitively overrides controller-level GUARD role
  async getVisits(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('clientId') clientId?: string,
    @Query('guardId') guardId?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(parseInt(limit, 10) || 10, 100); // Capped at 100
    
    return this.guardService.getVisits(pageNum, limitNum, { clientId, guardId });
  }
}
