import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { GymsService } from './gyms.service';
import { CreateGymDto } from './dto/create-gym.dto';
import { UpdateGymDto } from './dto/update-gym.dto';
import { CreateInaugurationCommitmentDto } from './dto/create-inauguration-commitment.dto';

import { UpdateDocumentDto, VerifyDocumentDto } from './dto/document.dto';
import { GymDocumentType } from '@prisma/client';

import * as fs from 'fs';

@ApiTags('gyms')
@Controller('gyms')
export class GymsController {
  constructor(private readonly gymsService: GymsService) {
    // #region agent log
    try {
      const logPath =
        '/Users/adityajaif/Desktop/PRo-Bodyline/.cursor/debug.log';
      fs.appendFileSync(
        logPath,
        JSON.stringify({
          location: 'gyms.controller.ts:25',
          message: 'GymsController constructor called',
          data: { controller: 'GymsController' },
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
    console.log('✅ GymsController instantiated');
  }

  @Post()
  @ApiOperation({ summary: 'Create a new gym' })
  @ApiResponse({ status: 201, description: 'Gym successfully created' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 409, description: 'Gym code already exists' })
  @ApiBody({ type: CreateGymDto })
  create(@Body() createGymDto: CreateGymDto) {
    return this.gymsService.create(createGymDto);
  }

  @Get('test')
  @ApiOperation({ summary: 'Test endpoint to verify controller is accessible' })
  @ApiResponse({ status: 200, description: 'Controller is working' })
  test() {
    return {
      message: 'GymsController is working',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all gyms with filtering and pagination' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search term for gym name, city, code, or state',
  })
  @ApiQuery({
    name: 'stateCode',
    required: false,
    description: 'Filter by state code',
  })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by city' })
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
  @ApiResponse({ status: 200, description: 'Paginated list of gyms' })
  findAll(
    @Query('search') search?: string,
    @Query('stateCode') stateCode?: string,
    @Query('city') city?: string,
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
          location: 'gyms.controller.ts:59',
          message: 'GymsController.findAll method called',
          data: { search, stateCode, city, page, limit },
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
    console.log('📞 GymsController.findAll called with:', {
      search,
      stateCode,
      city,
      page,
      limit,
    });
    return this.gymsService.findAll({
      search,
      stateCode,
      city,
      page: page ? Number(page) : 0,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get gym by ID' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiResponse({ status: 200, description: 'Gym found' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  findOne(@Param('id') id: string) {
    return this.gymsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update gym (installation date changes tracked in history)',
  })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiResponse({ status: 200, description: 'Gym successfully updated' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiBody({ type: UpdateGymDto })
  update(@Param('id') id: string, @Body() updateGymDto: UpdateGymDto) {
    return this.gymsService.update(id, updateGymDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete gym (soft delete)' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiResponse({ status: 200, description: 'Gym successfully deleted' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  remove(@Param('id') id: string) {
    return this.gymsService.remove(id);
  }

  @Get(':id/inauguration-history')
  @ApiOperation({ summary: 'Get inauguration commitment history for a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiResponse({ status: 200, description: 'List of inauguration commitments' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  getInaugurationHistory(@Param('id') id: string) {
    return this.gymsService.getInaugurationHistory(id);
  }

  @Post(':id/inauguration-commitments')
  @ApiOperation({ summary: 'Add inauguration commitment to a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiResponse({ status: 201, description: 'Commitment successfully added' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  @ApiBody({ type: CreateInaugurationCommitmentDto })
  addInaugurationCommitment(
    @Param('id') id: string,
    @Body() dto: CreateInaugurationCommitmentDto,
  ) {
    return this.gymsService.addInaugurationCommitment(id, dto);
  }

  @Get(':id/clients')
  @ApiOperation({ summary: 'Get all clients linked to a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiResponse({ status: 200, description: 'List of linked clients' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  getGymClients(@Param('id') id: string) {
    return this.gymsService.getGymClients(id);
  }

  @Post(':id/clients/:clientId')
  @ApiOperation({ summary: 'Link a client to a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiParam({ name: 'clientId', description: 'Client UUID' })
  @ApiResponse({ status: 201, description: 'Client successfully linked' })
  @ApiResponse({ status: 404, description: 'Gym or client not found' })
  @ApiResponse({
    status: 409,
    description: 'Client is already linked to this gym',
  })
  linkClient(@Param('id') id: string, @Param('clientId') clientId: string) {
    return this.gymsService.linkClient(id, clientId);
  }

  @Delete(':id/clients/:clientId')
  @ApiOperation({ summary: 'Unlink a client from a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiParam({ name: 'clientId', description: 'Client UUID' })
  @ApiResponse({ status: 200, description: 'Client successfully unlinked' })
  @ApiResponse({ status: 404, description: 'Gym, client, or link not found' })
  unlinkClient(@Param('id') id: string, @Param('clientId') clientId: string) {
    return this.gymsService.unlinkClient(id, clientId);
  }

  @Get(':id/technicians')
  @ApiOperation({ summary: 'Get all technicians linked to a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiResponse({ status: 200, description: 'List of linked technicians' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  getGymTechnicians(@Param('id') id: string) {
    return this.gymsService.getGymTechnicians(id);
  }

  @Post(':id/technicians/:technicianId')
  @ApiOperation({ summary: 'Link a technician to a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiParam({ name: 'technicianId', description: 'Technician UUID' })
  @ApiResponse({ status: 201, description: 'Technician successfully linked' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  @ApiResponse({
    status: 409,
    description: 'Technician is already linked to this gym',
  })
  linkTechnician(
    @Param('id') id: string,
    @Param('technicianId') technicianId: string,
  ) {
    return this.gymsService.linkTechnician(id, technicianId);
  }

  @Delete(':id/technicians/:technicianId')
  @ApiOperation({ summary: 'Unlink a technician from a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiParam({ name: 'technicianId', description: 'Technician UUID' })
  @ApiResponse({ status: 200, description: 'Technician successfully unlinked' })
  @ApiResponse({
    status: 404,
    description: 'Gym, technician, or link not found',
  })
  unlinkTechnician(
    @Param('id') id: string,
    @Param('technicianId') technicianId: string,
  ) {
    return this.gymsService.unlinkTechnician(id, technicianId);
  }

  @Get(':id/managers')
  @ApiOperation({ summary: 'Get all managers linked to a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiResponse({ status: 200, description: 'List of linked managers' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  getGymManagers(@Param('id') id: string) {
    return this.gymsService.getGymManagers(id);
  }

  @Post(':id/managers/:managerId')
  @ApiOperation({ summary: 'Link a manager to a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiParam({ name: 'managerId', description: 'Manager UUID' })
  @ApiResponse({ status: 201, description: 'Manager successfully linked' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  linkManager(@Param('id') id: string, @Param('managerId') managerId: string) {
    return this.gymsService.linkManager(id, managerId);
  }

  @Delete(':id/managers/:managerId')
  @ApiOperation({ summary: 'Unlink a manager from a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiParam({ name: 'managerId', description: 'Manager UUID' })
  @ApiResponse({ status: 200, description: 'Manager successfully unlinked' })
  unlinkManager(@Param('id') id: string, @Param('managerId') managerId: string) {
    return this.gymsService.unlinkManager(id, managerId);
  }

  @Get(':id/trainers')
  @ApiOperation({ summary: 'Get all trainers linked to a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiResponse({ status: 200, description: 'List of linked trainers' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  getGymTrainers(@Param('id') id: string) {
    return this.gymsService.getGymTrainers(id);
  }

  @Post(':id/trainers/:trainerId')
  @ApiOperation({ summary: 'Link a trainer to a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiParam({ name: 'trainerId', description: 'Trainer UUID' })
  @ApiResponse({ status: 201, description: 'Trainer successfully linked' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  linkTrainer(@Param('id') id: string, @Param('trainerId') trainerId: string) {
    return this.gymsService.linkTrainer(id, trainerId);
  }

  @Delete(':id/trainers/:trainerId')
  @ApiOperation({ summary: 'Unlink a trainer from a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiParam({ name: 'trainerId', description: 'Trainer UUID' })
  @ApiResponse({ status: 200, description: 'Trainer successfully unlinked' })
  unlinkTrainer(@Param('id') id: string, @Param('trainerId') trainerId: string) {
    return this.gymsService.unlinkTrainer(id, trainerId);
  }

  @Post(':id/media')
  @ApiOperation({ summary: 'Upload media (image or video) to a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        mediaType: { type: 'string', enum: ['IMAGE', 'VIDEO'] },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadGymMedia(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('mediaType') mediaType: 'IMAGE' | 'VIDEO',
  ) {
    return this.gymsService.uploadGymMedia(id, file, mediaType);
  }

  @Delete(':id/media/:mediaId')
  @ApiOperation({ summary: 'Delete media from a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiParam({ name: 'mediaId', description: 'Media UUID' })
  @ApiResponse({ status: 200, description: 'Media successfully deleted' })
  @ApiResponse({ status: 404, description: 'Gym or media not found' })
  deleteGymMedia(@Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.gymsService.deleteGymMedia(id, mediaId);
  }

  @Get(':id/media')
  @ApiOperation({ summary: 'Get all media for a gym' })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiResponse({ status: 200, description: 'List of gym media' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  getGymMedia(@Param('id') id: string) {
    return this.gymsService.getGymMedia(id);
  }

  @Get(':id/summary')
  @ApiOperation({
    summary:
      'Get gym summary (clients, quotes, orders, technicians, inauguration date)',
  })
  @ApiParam({ name: 'id', description: 'Gym UUID' })
  @ApiResponse({ status: 200, description: 'Gym summary' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  getGymSummary(@Param('id') id: string) {
    return this.gymsService.getGymSummary(id);
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Get all documents for a gym' })
  getDocuments(@Param('id') id: string) {
    return this.gymsService.getDocuments(id);
  }

  @Post(':id/documents/:type')
  @ApiOperation({ summary: 'Create or update document data' })
  upsertDocument(
    @Param('id') id: string,
    @Param('type') type: GymDocumentType,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.gymsService.upsertDocument(id, type, dto);
  }

  @Post(':id/documents/:type/upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload file for a document type' })
  uploadDocumentFile(
    @Param('id') id: string,
    @Param('type') type: GymDocumentType,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.gymsService.uploadDocumentFile(id, type, file);
  }

  @Post(':id/documents/:type/parse')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload file to S3 and run OCR, returning parsed data without updating DB' })
  parseDocumentFile(
    @Param('id') id: string,
    @Param('type') type: GymDocumentType,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.gymsService.parseDocumentFile(id, type, file);
  }

  @Delete(':id/documents/:type/files/:index')
  @ApiOperation({ summary: 'Delete file from a document by index' })
  deleteDocumentFile(
    @Param('id') id: string,
    @Param('type') type: GymDocumentType,
    @Param('index') index: string,
  ) {
    return this.gymsService.deleteDocumentFile(id, type, parseInt(index));
  }

  @Patch(':id/documents/:type/verify')
  @ApiOperation({ summary: 'Verify document' })
  verifyDocument(
    @Param('id') id: string,
    @Param('type') type: GymDocumentType,
    @Body() dto: VerifyDocumentDto,
  ) {
    return this.gymsService.verifyDocument(id, type, dto);
  }

}
