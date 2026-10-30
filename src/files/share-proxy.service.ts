import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import sharp from 'sharp';

export type ShareSource = { kind: 's3'; key: string } | { kind: 'local'; path: string };

export interface ShareFile {
  body: Buffer | Readable;
  contentType: string;
  filename: string;
}

const IMAGE_EXT = /\.(webp|png|jpe?g|avif|gif)$/i;
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 82;

@Injectable()
export class ShareProxyService {
  private readonly logger = new Logger(ShareProxyService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly allowedHosts: string[];

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.bucketName = process.env.AWS_S3_BUCKET || 'probodyline-uploads';
    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    this.allowedHosts = [`${this.bucketName}.s3.${region}.amazonaws.com`];
    if (process.env.CLOUDFRONT_URL) {
      try {
        this.allowedHosts.push(new URL(process.env.CLOUDFRONT_URL).host);
      } catch {
        this.logger.warn('CLOUDFRONT_URL is not a valid URL; ignoring for share allow-list');
      }
    }
  }

  resolveSource(url: string): ShareSource {
    if (/^https?:\/\//i.test(url)) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new BadRequestException('Invalid url');
      }
      if (!this.allowedHosts.includes(parsed.host)) {
        throw new BadRequestException('Host is not allowed');
      }
      let key: string;
      try {
        key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
      } catch {
        throw new BadRequestException('Invalid url');
      }
      if (!key) throw new BadRequestException('Invalid url');
      return { kind: 's3', key };
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      throw new BadRequestException('Unsupported url');
    }
    const cwd = process.cwd();
    const uploadsRoot = path.resolve(cwd, 'uploads');
    const resolved = path.resolve(cwd, url.replace(/^\/+/, ''));
    if (!resolved.startsWith(uploadsRoot + path.sep)) {
      throw new BadRequestException('Invalid path');
    }
    const normalized = path.relative(cwd, resolved);
    return { kind: 'local', path: normalized };
  }

  async getShareFile(url: string, name?: string): Promise<ShareFile> {
    const source = this.resolveSource(url);
    const sourceName = source.kind === 's3' ? source.key : source.path;
    const baseName = path.basename(sourceName);

    if (source.kind === 's3') {
      // Cache lookup only when the extension already tells us it is an image.
      if (IMAGE_EXT.test(baseName)) {
        const cached = await this.readCache(url);
        if (cached) return this.imageResult(cached, name, baseName);
      }
      const obj = await this.getObject(source.key);
      const contentType: string = obj.ContentType || '';
      if (IMAGE_EXT.test(baseName) || contentType.startsWith('image/')) {
        const raw = Buffer.from(await obj.Body.transformToByteArray());
        const jpeg = await this.toJpeg(raw);
        this.writeCache(url, jpeg);
        return this.imageResult(jpeg, name, baseName);
      }
      return {
        body: obj.Body as Readable,
        contentType: contentType || this.contentTypeFromName(baseName),
        filename: this.fileName(name, baseName, false),
      };
    }

    let raw: Buffer;
    try {
      raw = await fs.promises.readFile(path.join(process.cwd(), source.path));
    } catch (err: any) {
      if (err?.code === 'ENOENT' || err?.code === 'EISDIR') throw new NotFoundException('File not found');
      throw err;
    }
    if (IMAGE_EXT.test(baseName)) {
      return this.imageResult(await this.toJpeg(raw), name, baseName);
    }
    return {
      body: raw,
      contentType: this.contentTypeFromName(baseName),
      filename: this.fileName(name, baseName, false),
    };
  }

  private imageResult(body: Buffer, name: string | undefined, baseName: string): ShareFile {
    return { body, contentType: 'image/jpeg', filename: this.fileName(name, baseName, true) };
  }

  private toJpeg(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
  }

  private cacheKey(url: string): string {
    return `share-cache/${createHash('sha1').update(url).digest('hex')}.jpg`;
  }

  private async readCache(url: string): Promise<Buffer | null> {
    try {
      const res = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.bucketName, Key: this.cacheKey(url) }),
      );
      return Buffer.from(await res.Body!.transformToByteArray());
    } catch (err) {
      if (!this.isMissing(err)) this.logger.warn(`Share cache read failed: ${(err as Error).message}`);
      return null;
    }
  }

  private writeCache(url: string, body: Buffer): void {
    this.s3Client
      .send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: this.cacheKey(url),
          Body: body,
          ContentType: 'image/jpeg',
        }),
      )
      .catch((err) => this.logger.warn(`Share cache write failed: ${err?.message}`));
  }

  private async getObject(key: string): Promise<any> {
    try {
      return await this.s3Client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }));
    } catch (err) {
      if (this.isMissing(err)) throw new NotFoundException('File not found');
      throw err;
    }
  }

  private isMissing(err: any): boolean {
    return err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404;
  }

  private contentTypeFromName(name: string): string {
    const ext = path.extname(name).toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    return 'application/octet-stream';
  }

  private fileName(name: string | undefined, baseName: string, image: boolean): string {
    let stem = (name && name.trim()) || baseName;
    if (image) stem = stem.replace(IMAGE_EXT, '');
    const safe = stem
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^[._]+/, '');
    const base = safe || 'file';
    if (image) return `${base}.jpg`;
    return base;
  }
}
