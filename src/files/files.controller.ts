import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Res,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FilesService } from './files.service';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        folder: {
          type: 'string',
          description: 'Optional folder path',
        },
      },
    },
  })
  @ApiQuery({
    name: 'folder',
    required: false,
    description: 'Optional folder path for organization',
  })
  @ApiResponse({ status: 201, description: 'File successfully uploaded' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - no file or invalid file type/size',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const filepath = await this.filesService.saveFile(file, folder);
    return {
      message: 'File uploaded successfully',
      filepath,
      filename: file.originalname,
      size: file.size,
    };
  }

  @Get('*path')
  @ApiOperation({ summary: 'Get file by path' })
  @ApiParam({ name: 'path', description: 'File path' })
  @ApiResponse({ status: 200, description: 'File content' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFile(
    @Param('path') filepath: string | string[],
    @Res() res: Response,
  ) {
    const safeFilePath = Array.isArray(filepath)
      ? filepath.join('/')
      : filepath;
    const fullPath = this.filesService.getFilePath(safeFilePath);

    if (!fs.existsSync(fullPath)) {
      const dir = path.dirname(fullPath);
      res.status(404).json({
        message: 'File not found',
        debug: {
          attemptedPath: fullPath,
          originalParam: filepath,
          cwd: process.cwd(),
          exists: false,
          dirExists: fs.existsSync(dir),
          filesInDir: fs.existsSync(dir)
            ? fs.readdirSync(dir)
            : 'Dir not found',
        },
      });
      return;
    }

    res.sendFile(path.resolve(fullPath));
  }

  @Delete('*path')
  @ApiOperation({ summary: 'Delete file by path' })
  @ApiParam({ name: 'path', description: 'File path' })
  @ApiResponse({ status: 200, description: 'File successfully deleted' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async deleteFile(@Param('path') filepath: string) {
    await this.filesService.deleteFile(filepath);
    return { message: 'File deleted successfully' };
  }
}
