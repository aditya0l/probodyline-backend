import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

@Injectable()
export class FilesService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
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
    this.bucketName = process.env.AWS_S3_BUCKET || 'probodyline-uploads';
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  private sanitizeFileName(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_');
  }

  private validateFile(file: Express.Multer.File): void {
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }
  }

  async processAndUploadImage(buffer: Buffer, key: string, isThumbnail = false): Promise<Buffer> {
    const s = sharp(buffer);
    
    if (isThumbnail) {
      s.resize(200, 200, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 70 });
    } else {
      s.resize(800, 800, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 });
    }
    
    const processedBuffer = await s.toBuffer();
    
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: processedBuffer,
        ContentType: 'image/webp',
      })
    );
    
    return processedBuffer;
  }

  async generateLQIP(buffer: Buffer): Promise<string> {
    const lqipBuffer = await sharp(buffer)
      .resize(8, 8, { fit: 'inside' })
      .webp({ quality: 20 })
      .toBuffer();
    return `data:image/webp;base64,${lqipBuffer.toString('base64')}`;
  }

  async uploadToS3(buffer: Buffer, key: string, mimetype: string): Promise<void> {
     await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      })
    );
  }

  async saveFile(
    file: Express.Multer.File,
    subfolder?: string,
  ): Promise<any> {
    this.validateFile(file);

    const sanitizedFilename = this.sanitizeFileName(file.originalname);
    const baseFilename = `${Date.now()}-${sanitizedFilename.replace(/\.[^/.]+$/, "")}`;
    const folderPrefix = subfolder ? `${subfolder}/` : '';
    
    const isImage = file.mimetype.startsWith('image/');

    if (isImage) {
      const mainKey = `${folderPrefix}${baseFilename}.webp`;
      const thumbKey = `${folderPrefix}${baseFilename}_thumb.webp`;
      
      try {
        await this.processAndUploadImage(file.buffer, mainKey, false);
        await this.processAndUploadImage(file.buffer, thumbKey, true);
        const lqip = await this.generateLQIP(file.buffer);
        
        return {
          url: `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${mainKey}`,
          thumbnailUrl: `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${thumbKey}`,
          lqip,
          mainKey,
          thumbKey
        };
      } catch (error) {
         console.error('Error processing image:', error);
         throw new InternalServerErrorException('Error processing image');
      }
    } else {
       // Non-image files
       const key = `${folderPrefix}${Date.now()}-${sanitizedFilename}`;
       await this.uploadToS3(file.buffer, key, file.mimetype);
       return {
         url: `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`,
         key
       };
    }
  }

  async deleteFile(filepath: string): Promise<void> {
    let key = filepath;
    if (filepath.startsWith('http')) {
      const url = new URL(filepath);
      key = url.pathname.substring(1); // Remove leading slash
    }
    
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
    } catch (e) {
      console.error(`Failed to delete ${key} from S3:`, e);
    }
  }

  getFilePath(relativePath: string): string {
    return path.join(process.cwd(), relativePath);
  }
}
