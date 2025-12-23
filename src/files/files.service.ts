import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FilesService {
  private readonly uploadPath = path.join(process.cwd(), 'uploads');
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
  ];

  constructor() {
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  private sanitizeFileName(filename: string): string {
    // Remove special characters and replace spaces with underscores
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_');
  }

  private validateFile(file: Express.Multer.File): void {
    // Validate file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`
      );
    }

    // Validate MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`
      );
    }
  }

  async saveFile(file: Express.Multer.File, subfolder?: string): Promise<string> {
    // Validate file
    this.validateFile(file);

    const folder = subfolder ? path.join(this.uploadPath, subfolder) : this.uploadPath;
    
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    // Sanitize filename
    const sanitizedFilename = this.sanitizeFileName(file.originalname);
    const filename = `${Date.now()}-${sanitizedFilename}`;
    const filepath = path.join(folder, filename);

    fs.writeFileSync(filepath, file.buffer);

    // Return relative path for storage in database
    return subfolder ? `uploads/${subfolder}/${filename}` : `uploads/${filename}`;
  }

  async deleteFile(filepath: string): Promise<void> {
    const fullPath = path.join(process.cwd(), filepath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  getFilePath(relativePath: string): string {
    return path.join(process.cwd(), relativePath);
  }
}

