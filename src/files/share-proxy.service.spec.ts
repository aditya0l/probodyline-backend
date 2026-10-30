import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import sharp from 'sharp';
import { ShareProxyService } from './share-proxy.service';

const S3_URL = 'https://probodyline-uploads.s3.us-east-1.amazonaws.com/products/a.webp';
const sha1 = (s: string) => createHash('sha1').update(s).digest('hex');
const noSuchKey = () => Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
const bodyOf = (buf: Buffer) => ({ transformToByteArray: async () => new Uint8Array(buf) });
const makeImage = (width: number, height: number, fmt: 'webp' | 'png' = 'webp') =>
  sharp({ create: { width, height, channels: 3, background: '#336699' } })
    [fmt]()
    .toBuffer();

describe('ShareProxyService', () => {
  let service: ShareProxyService;
  let send: jest.SpyInstance;

  beforeEach(() => {
    process.env.AWS_S3_BUCKET = 'probodyline-uploads';
    process.env.AWS_REGION = 'us-east-1';
    process.env.CLOUDFRONT_URL = 'https://cdn.example.net';
    send = jest.spyOn(S3Client.prototype, 'send' as any);
    service = new ShareProxyService();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('resolveSource', () => {
    it('maps the S3 bucket host to a key', () => {
      expect(service.resolveSource(S3_URL)).toEqual({ kind: 's3', key: 'products/a.webp' });
    });

    it('maps the CloudFront host to a key', () => {
      expect(service.resolveSource('https://cdn.example.net/products/a.webp')).toEqual({
        kind: 's3',
        key: 'products/a.webp',
      });
    });

    it('maps a relative path to a local path', () => {
      expect(service.resolveSource('/uploads/products/a.jpg')).toEqual({
        kind: 'local',
        path: 'uploads/products/a.jpg',
      });
    });

    it('rejects hosts that are not allow-listed', () => {
      expect(() => service.resolveSource('https://evil.com/x.jpg')).toThrow(BadRequestException);
    });

    it.each(['/.env', '/package.json', '/src/main.ts', '/uploads', '/uploads/../package.json'])(
      'rejects local path outside uploads: %s',
      (p) => {
        expect(() => service.resolveSource(p)).toThrow(BadRequestException);
      },
    );

    it('allows names starting with two dots inside uploads', () => {
      expect(service.resolveSource('/uploads/..foo.jpg')).toEqual({
        kind: 'local',
        path: 'uploads/..foo.jpg',
      });
    });

    it('rejects malformed percent-encoding with 400', () => {
      expect(() =>
        service.resolveSource('https://probodyline-uploads.s3.us-east-1.amazonaws.com/a%zz'),
      ).toThrow(BadRequestException);
    });

    it.each([
      'https://probodyline-uploads.s3.us-east-1.amazonaws.com.evil.com/x.jpg',
      'https://probodyline-uploads.s3.us-east-1.amazonaws.com@evil.com/x.jpg',
      'ftp://probodyline-uploads.s3.us-east-1.amazonaws.com/x.jpg',
      'file:///etc/passwd',
    ])('rejects allow-list bypass: %s', (u) => {
      expect(() => service.resolveSource(u)).toThrow(BadRequestException);
    });

    it('rejects path traversal', () => {
      expect(() => service.resolveSource('/uploads/../../etc/passwd')).toThrow(BadRequestException);
    });
  });

  describe('getShareFile', () => {
    it('converts a cache miss to JPEG and writes it to the cache', async () => {
      const webp = await makeImage(10, 10);
      send.mockRejectedValueOnce(noSuchKey()).mockResolvedValueOnce({
        Body: bodyOf(webp),
        ContentType: 'image/webp',
      });
      send.mockResolvedValue({});

      const result = await service.getShareFile(S3_URL);

      expect(result.contentType).toBe('image/jpeg');
      expect((await sharp(result.body as Buffer).metadata()).format).toBe('jpeg');
      const cacheKey = `share-cache/${sha1(S3_URL)}.jpg`;
      const first = send.mock.calls[0][0];
      expect(first).toBeInstanceOf(GetObjectCommand);
      expect(first.input.Key).toBe(cacheKey);
      // cache write is fire-and-forget; let it flush
      await new Promise((r) => setImmediate(r));
      const put = send.mock.calls.map((c) => c[0]).find((c) => c instanceof PutObjectCommand);
      expect(put).toBeDefined();
      expect(put.input.Key).toBe(cacheKey);
      expect(put.input.ContentType).toBe('image/jpeg');
    });

    it('returns the cached conversion on a cache hit without converting or writing', async () => {
      const cached = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } })
        .jpeg()
        .toBuffer();
      send.mockResolvedValueOnce({ Body: bodyOf(cached), ContentType: 'image/jpeg' });

      const result = await service.getShareFile(S3_URL);

      expect(result.contentType).toBe('image/jpeg');
      expect(Buffer.from(result.body as Buffer).equals(cached)).toBe(true);
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls.some((c) => c[0] instanceof PutObjectCommand)).toBe(false);
    });

    it('passes PDFs through untouched', async () => {
      const stream = Readable.from([Buffer.from('%PDF-1.4')]);
      send.mockResolvedValueOnce({ Body: stream, ContentType: 'application/pdf' });

      const result = await service.getShareFile(
        'https://probodyline-uploads.s3.us-east-1.amazonaws.com/docs/spec.pdf',
      );

      expect(result.contentType).toBe('application/pdf');
      expect(result.body).toBe(stream);
      expect(result.filename).toBe('spec.pdf');
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls.some((c) => c[0] instanceof PutObjectCommand)).toBe(false);
    });

    it('throws NotFoundException when the source object is missing', async () => {
      send.mockRejectedValue(noSuchKey());
      await expect(service.getShareFile(S3_URL)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when a local file is missing', async () => {
      await expect(service.getShareFile('/uploads/does-not-exist-xyz.jpg')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('downsizes images wider than 2048px', async () => {
      const big = await makeImage(3000, 1000, 'png');
      send.mockRejectedValueOnce(noSuchKey()).mockResolvedValueOnce({
        Body: bodyOf(big),
        ContentType: 'image/png',
      });
      send.mockResolvedValue({});

      const result = await service.getShareFile(
        'https://probodyline-uploads.s3.us-east-1.amazonaws.com/products/big.png',
      );

      const meta = await sharp(result.body as Buffer).metadata();
      expect(meta.width).toBe(2048);
      expect(meta.format).toBe('jpeg');
    });

    it('sanitises a supplied name and forces .jpg for images', async () => {
      const webp = await makeImage(10, 10);
      send.mockRejectedValueOnce(noSuchKey()).mockResolvedValueOnce({
        Body: bodyOf(webp),
        ContentType: 'image/webp',
      });
      send.mockResolvedValue({});

      const result = await service.getShareFile(S3_URL, 'OK0017A 1');
      expect(result.filename).toBe('OK0017A_1.jpg');
    });

    it('derives the filename from the key basename when no name is given', async () => {
      const webp = await makeImage(10, 10);
      send.mockRejectedValueOnce(noSuchKey()).mockResolvedValueOnce({
        Body: bodyOf(webp),
        ContentType: 'image/webp',
      });
      send.mockResolvedValue({});

      const result = await service.getShareFile(S3_URL);
      expect(result.filename).toBe('a.jpg');
    });
  });
});
