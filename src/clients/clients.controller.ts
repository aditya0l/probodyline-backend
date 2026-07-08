import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { ClientsService } from './clients.service';

import { UpdateDocumentDto, VerifyDocumentDto } from './dto/document.dto';
import { ClientDocumentType } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { CreateJourneyEventDto } from './dto/create-journey-event.dto';
import * as fs from 'fs';

@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {
    // #region agent log
    try {
      const logPath =
        '/Users/adityajaif/Desktop/PRo-Bodyline/.cursor/debug.log';
      fs.appendFileSync(
        logPath,
        JSON.stringify({
          location: 'clients.controller.ts:21',
          message: 'ClientsController constructor called',
          data: { controller: 'ClientsController' },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H1',
        }) + '\n',
      );
    } catch (e) {
      // ignore error
    }
    // #endregion
    console.log('✅ ClientsController instantiated');
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new client' })
  @ApiResponse({ status: 201, description: 'Client successfully created' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 409, description: 'Client code already exists' })
  @ApiBody({ type: CreateClientDto })
  create(@Body() createClientDto: CreateClientDto, @Request() req) {
    return this.clientsService.create(createClientDto, req.user);
  }

  @Get('test')
  @ApiOperation({ summary: 'Test endpoint to verify controller is accessible' })
  @ApiResponse({ status: 200, description: 'Controller is working' })
  test() {
    return {
      message: 'ClientsController is working',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all clients with filtering and pagination' })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Search term for client name, city, code, state, or sales person',
  })
  @ApiQuery({
    name: 'stateCode',
    required: false,
    description: 'Filter by state code',
  })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by city' })
  @ApiQuery({
    name: 'salesPerson',
    required: false,
    description: 'Filter by sales person',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (0-indexed)',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page',
    type: Number,
  })
  @ApiResponse({ status: 200, description: 'Paginated list of clients' })
  findAll(
    @Query('search') search?: string,
    @Query('stateCode') stateCode?: string,
    @Query('city') city?: string,
    @Query('salesPerson') salesPerson?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // #region agent log
    try {
      const logPath =
        '/Users/adityajaif/Desktop/PRo-Bodyline/.cursor/debug.log';
      fs.appendFileSync(
        logPath,
        JSON.stringify({
          location: 'clients.controller.ts:62',
          message: 'ClientsController.findAll method called',
          data: { search, stateCode, city, salesPerson, page, limit },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H4',
        }) + '\n',
      );
    } catch (e) {
      // ignore error
    }
    // #endregion
    console.log('📞 ClientsController.findAll called with:', {
      search,
      stateCode,
      city,
      salesPerson,
      page,
      limit,
    });
    return this.clientsService.findAll({
      search,
      stateCode,
      city,
      salesPerson,
      page: page ? Number(page) : 0,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get client by ID' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiResponse({ status: 200, description: 'Client found' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update client (tokenDate is immutable)' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiResponse({ status: 200, description: 'Client successfully updated' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiBody({ type: UpdateClientDto })
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(id, updateClientDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete client (soft delete)' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiResponse({ status: 200, description: 'Client successfully deleted' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }

  @Get(':id/gyms')
  @ApiOperation({ summary: 'Get all gyms linked to a client' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiResponse({ status: 200, description: 'List of linked gyms' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  getClientGyms(@Param('id') id: string) {
    return this.clientsService.getClientGyms(id);
  }

  @Post(':id/gyms/:gymId')
  @ApiOperation({ summary: 'Link a gym to a client' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiParam({ name: 'gymId', description: 'Gym UUID' })
  @ApiResponse({ status: 201, description: 'Gym successfully linked' })
  @ApiResponse({ status: 404, description: 'Client or gym not found' })
  @ApiResponse({
    status: 409,
    description: 'Gym is already linked to this client',
  })
  linkGym(@Param('id') id: string, @Param('gymId') gymId: string) {
    return this.clientsService.linkGym(id, gymId);
  }

  @Delete(':id/gyms/:gymId')
  @ApiOperation({ summary: 'Unlink a gym from a client' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiParam({ name: 'gymId', description: 'Gym UUID' })
  @ApiResponse({ status: 200, description: 'Gym successfully unlinked' })
  @ApiResponse({ status: 404, description: 'Client, gym, or link not found' })
  unlinkGym(@Param('id') id: string, @Param('gymId') gymId: string) {
    return this.clientsService.unlinkGym(id, gymId);
  }

  @Get(':id/leads')
  @ApiOperation({ summary: 'Get all leads linked to a client' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiResponse({ status: 200, description: 'List of linked leads' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  getClientLeads(@Param('id') id: string) {
    return this.clientsService.getClientLeads(id);
  }

  @Post(':id/leads/:leadId')
  @ApiOperation({ summary: 'Link a lead to a client' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiParam({ name: 'leadId', description: 'Lead UUID' })
  @ApiResponse({ status: 201, description: 'Lead successfully linked' })
  @ApiResponse({ status: 404, description: 'Client or lead not found' })
  @ApiResponse({
    status: 409,
    description: 'Lead is already linked to this client',
  })
  linkLead(@Param('id') id: string, @Param('leadId') leadId: string) {
    return this.clientsService.linkLead(id, leadId);
  }

  @Delete(':id/leads/:leadId')
  @ApiOperation({ summary: 'Unlink a lead from a client' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiParam({ name: 'leadId', description: 'Lead UUID' })
  @ApiResponse({ status: 200, description: 'Lead successfully unlinked' })
  @ApiResponse({ status: 404, description: 'Client, lead, or link not found' })
  unlinkLead(@Param('id') id: string, @Param('leadId') leadId: string) {
    return this.clientsService.unlinkLead(id, leadId);
  }

  @Get(':id/partners')
  @ApiOperation({ summary: 'Get all partners linked to a client' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiResponse({ status: 200, description: 'List of linked partners' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  getClientPartners(@Param('id') id: string) {
    return this.clientsService.getClientPartners(id);
  }

  @Post(':id/partners')
  @ApiOperation({ summary: 'Link a partner (client or lead) to a client' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        partnerType: { type: 'string', enum: ['CLIENT', 'LEAD'] },
        partnerRefId: { type: 'string' },
      },
      required: ['partnerType', 'partnerRefId'],
    },
  })
  @ApiResponse({ status: 201, description: 'Partner successfully linked' })
  @ApiResponse({ status: 404, description: 'Client or partner not found' })
  @ApiResponse({
    status: 409,
    description: 'Partner is already linked to this client',
  })
  linkPartner(
    @Param('id') id: string,
    @Body('partnerType') partnerType: 'CLIENT' | 'LEAD',
    @Body('partnerRefId') partnerRefId: string,
  ) {
    return this.clientsService.linkPartner(id, partnerType, partnerRefId);
  }

  @Delete(':id/partners/:partnerId')
  @ApiOperation({ summary: 'Unlink a partner from a client' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiParam({ name: 'partnerId', description: 'Partner UUID' })
  @ApiResponse({ status: 200, description: 'Partner successfully unlinked' })
  @ApiResponse({
    status: 404,
    description: 'Client, partner, or link not found',
  })
  unlinkPartner(
    @Param('id') id: string,
    @Param('partnerId') partnerId: string,
  ) {
    return this.clientsService.unlinkPartner(id, partnerId);
  }

  @Get(':id/summary')
  @ApiOperation({
    summary: 'Get client summary (gyms, quotes, orders, pending spare parts)',
  })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiResponse({ status: 200, description: 'Client summary' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  getClientSummary(@Param('id') id: string) {
    return this.clientsService.getClientSummary(id);
  }

  @Post(':id/smart-upload-photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Smart upload profile photo (Entry Gate App)' })
  smartUploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Request() req,
  ) {
    return this.clientsService.smartUploadPhoto(id, file, req.user);
  }

  @Post(':id/manual-upload-photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Manual upload profile photo' })
  manualUploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Request() req,
  ) {
    return this.clientsService.manualUploadPhoto(id, file, req.user);
  }

  @Get(':id/journey')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get client journey events' })
  getJourney(@Param('id') id: string) {
    return this.clientsService.getJourney(id);
  }

  @Post(':id/journey')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create manual journey event' })
  createJourneyEvent(
    @Param('id') id: string,
    @Body() dto: CreateJourneyEventDto,
    @Request() req,
  ) {
    return this.clientsService.createJourneyEvent(id, dto, req.user);
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Get all documents for a client' })
  getDocuments(@Param('id') id: string) {
    return this.clientsService.getDocuments(id);
  }

  @Post(':id/documents/:type')
  @ApiOperation({ summary: 'Create or update document data' })
  upsertDocument(
    @Param('id') id: string,
    @Param('type') type: ClientDocumentType,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.clientsService.upsertDocument(id, type, dto);
  }

  @Post(':id/documents/:type/upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload file for a document type' })
  uploadDocumentFile(
    @Param('id') id: string,
    @Param('type') type: ClientDocumentType,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.clientsService.uploadDocumentFile(id, type, file);
  }

  @Post(':id/documents/:type/parse')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload file to S3 and run OCR, returning parsed data without updating DB' })
  parseDocumentFile(
    @Param('id') id: string,
    @Param('type') type: ClientDocumentType,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.clientsService.parseDocumentFile(id, type, file);
  }

  @Delete(':id/documents/:type/files/:index')
  @ApiOperation({ summary: 'Delete file from a document by index' })
  deleteDocumentFile(
    @Param('id') id: string,
    @Param('type') type: ClientDocumentType,
    @Param('index') index: string,
  ) {
    return this.clientsService.deleteDocumentFile(id, type, parseInt(index));
  }

  @Patch(':id/documents/:type/verify')
  @ApiOperation({ summary: 'Verify document' })
  verifyDocument(
    @Param('id') id: string,
    @Param('type') type: ClientDocumentType,
    @Body() dto: VerifyDocumentDto,
  ) {
    return this.clientsService.verifyDocument(id, type, dto);
  }

}
