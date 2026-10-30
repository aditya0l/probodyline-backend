import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import request from 'supertest';
import { Readable } from 'stream';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { ShareProxyService } from './share-proxy.service';

describe('FilesController share-proxy', () => {
  let app: INestApplication;
  const shareProxy = { getShareFile: jest.fn() };
  const filesService = {
    getFilePath: jest.fn(),
    saveFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        { provide: FilesService, useValue: filesService },
        { provide: ShareProxyService, useValue: shareProxy },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the file with sharing headers', async () => {
    shareProxy.getShareFile.mockResolvedValue({
      body: Buffer.from('jpegbytes'),
      contentType: 'image/jpeg',
      filename: 'A.jpg',
    });
    const url = 'https://bucket.s3.us-east-1.amazonaws.com/p/x.webp';

    const res = await request(app.getHttpServer())
      .get('/files/share-proxy')
      .query({ url, name: 'A' })
      .expect(200);

    expect(shareProxy.getShareFile).toHaveBeenCalledWith(url, 'A');
    expect(res.headers['content-type']).toContain('image/jpeg');
    expect(res.headers['content-disposition']).toContain('filename="A.jpg"');
    expect(res.headers['cache-control']).toBe(
      'private, max-age=31536000, immutable',
    );
    expect(res.headers['access-control-expose-headers']).toBe(
      'Content-Disposition',
    );
    expect(res.body.toString()).toBe('jpegbytes');
  });

  it('streams a non-image body', async () => {
    shareProxy.getShareFile.mockResolvedValue({
      body: Readable.from([Buffer.from('%PDF-1.4')]),
      contentType: 'application/pdf',
      filename: 'doc.pdf',
    });
    const res = await request(app.getHttpServer())
      .get('/files/share-proxy')
      .query({ url: 'uploads/doc.pdf' })
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect((res.body as Buffer).toString()).toBe('%PDF-1.4');
  });

  it('aborts cleanly when the stream errors mid-transfer', async () => {
    const stream = new Readable({ read() {} });
    stream.push(Buffer.alloc(1024, 1));
    setTimeout(() => stream.destroy(new Error('socket reset')), 20);
    shareProxy.getShareFile.mockResolvedValue({
      body: stream,
      contentType: 'application/pdf',
      filename: 'doc.pdf',
    });
    const uncaught = jest.fn();
    process.on('uncaughtException', uncaught);
    await expect(
      request(app.getHttpServer())
        .get('/files/share-proxy')
        .query({ url: 'uploads/doc.pdf' })
        .timeout(3000),
    ).rejects.toBeDefined();
    process.off('uncaughtException', uncaught);
    expect(uncaught).not.toHaveBeenCalled();
  });

  it('returns 502 when the stream fails before any data', async () => {
    const stream = new Readable({ read() {} });
    setTimeout(() => stream.destroy(new Error('boom')), 10);
    shareProxy.getShareFile.mockResolvedValue({
      body: stream,
      contentType: 'application/pdf',
      filename: 'doc.pdf',
    });
    const res = await request(app.getHttpServer())
      .get('/files/share-proxy')
      .query({ url: 'uploads/doc.pdf' })
      .expect(502);
    expect(res.headers['cache-control']).toBeUndefined();
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.message).toBe('Failed to stream file');
  });

  it('returns 400 when url is missing', async () => {
    await request(app.getHttpServer()).get('/files/share-proxy').expect(400);
    expect(shareProxy.getShareFile).not.toHaveBeenCalled();
  });

  it('maps BadRequestException to 400', async () => {
    shareProxy.getShareFile.mockRejectedValue(
      new BadRequestException('Host is not allowed'),
    );
    await request(app.getHttpServer())
      .get('/files/share-proxy')
      .query({ url: 'https://evil.example.com/x.png' })
      .expect(400);
  });

  it('maps NotFoundException to 404', async () => {
    shareProxy.getShareFile.mockRejectedValue(
      new NotFoundException('File not found'),
    );
    await request(app.getHttpServer())
      .get('/files/share-proxy')
      .query({ url: 'uploads/missing.png' })
      .expect(404);
  });

  it('does not break the wildcard file route', async () => {
    filesService.getFilePath.mockReturnValue('/nonexistent/uploads/products/x.webp');
    const res = await request(app.getHttpServer())
      .get('/files/products/x.webp')
      .expect(404);
    expect(filesService.getFilePath).toHaveBeenCalledWith('products/x.webp');
    expect(res.body.message).toBe('File not found');
    expect(shareProxy.getShareFile).not.toHaveBeenCalled();
  });
});
