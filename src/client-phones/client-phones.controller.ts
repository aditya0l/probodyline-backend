import { Controller, Post, Body, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { ClientPhonesService } from './client-phones.service';
import { CreateClientPhoneDto } from './dto/create-client-phone.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Client Phones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('client-phones')
export class ClientPhonesController {
  constructor(private readonly clientPhonesService: ClientPhonesService) {}

  @Post()
  @ApiOperation({ summary: 'Add a new phone number to a client' })
  addPhone(@Body() dto: CreateClientPhoneDto) {
    return this.clientPhonesService.addPhone(dto.clientId, dto.phone);
  }

  @Patch('admin/:id/dormant')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark a phone number as dormant (Admin only)' })
  markDormant(@Param('id') id: string, @Request() req: any) {
    const adminId = req.user?.userId; // Assuming user context is populated via JwtAuthGuard
    return this.clientPhonesService.markDormant(id, adminId);
  }

  @Patch('admin/:id/reactivate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reactivate a dormant phone number (Admin only)' })
  reactivate(@Param('id') id: string, @Request() req: any) {
    const adminId = req.user?.userId;
    return this.clientPhonesService.reactivate(id, adminId);
  }
}
