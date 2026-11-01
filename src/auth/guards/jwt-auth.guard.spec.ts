import { Controller, Delete, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { JwtAuthGuard, isPublicRoute } from './jwt-auth.guard';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { AuthService } from '../auth.service';

const SECRET = 'test-secret';

@Controller('users')
class UsersStubController {
  @Get()
  list() {
    return { ok: true };
  }
}

@Controller('files')
class FilesStubController {
  @Post('upload')
  upload() {
    return { ok: true };
  }

  @Get('share-proxy')
  shareProxy() {
    return { ok: true };
  }

  @Get('*path')
  get() {
    return { ok: true };
  }

  @Delete('*path')
  remove() {
    return { ok: true };
  }
}

@Controller('pdf')
class PdfStubController {
  @Get('quotations/:id/preview')
  preview() {
    return { ok: true };
  }

  @Post('shorten')
  shorten() {
    return { ok: true };
  }

  @Post('generate')
  generate() {
    return { ok: true };
  }
}

@Controller('auth')
class AuthStubController {
  @Post('login')
  login() {
    return { ok: true };
  }

  @Post('verify-otp')
  verifyOtp() {
    return { ok: true };
  }

  @Post('send-otp')
  sendOtp() {
    return { ok: true };
  }
}

describe('JwtAuthGuard', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const config = { get: (key: string) => (key === 'JWT_SECRET' ? SECRET : undefined) };
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [UsersStubController, FilesStubController, PdfStubController, AuthStubController],
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: config },
        { provide: AuthService, useValue: { validateUser: async (id: string) => ({ id }) } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalGuards(new JwtAuthGuard(config as unknown as ConfigService));
    await app.init();

    token = new JwtService({ secret: SECRET }).sign({ sub: 'user-1' });
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  describe('query-string bypass', () => {
    it.each([
      '/api/users?x=/api/files',
      '/api/users?x=/api/auth/login',
      '/api/users?x=/api/pdf',
      '/api/users?x=/api/pdf/shorten',
      '/api/users#/api/files',
    ])('rejects %s without a token', async (url) => {
      await request(server()).get(url).expect(401);
    });

    it('rejects POST /api/pdf/generate?x=/api/pdf/shorten', async () => {
      await request(server()).post('/api/pdf/generate?x=/api/pdf/shorten').expect(401);
    });

    it('still allows a protected route with a valid token', async () => {
      await request(server()).get('/api/users?x=/api/files').set('Authorization', `Bearer ${token}`).expect(200);
    });
  });

  describe('public routes', () => {
    it.each([
      ['get', '/api/files/products/a.jpg'],
      ['get', '/api/files/share-proxy?url=https%3A%2F%2Fexample.com%2Fa.jpg'],
      ['get', '/api/pdf/quotations/1/preview'],
      ['post', '/api/pdf/shorten'],
      ['post', '/api/auth/login'],
      ['post', '/api/auth/verify-otp'],
    ] as const)('%s %s needs no token', async (method, url) => {
      await request(server())[method](url).expect((res) => {
        if (res.status === 401) throw new Error(`expected public, got 401`);
      });
    });
  });

  describe('file upload and delete', () => {
    it('rejects POST /api/files/upload without a token', async () => {
      await request(server()).post('/api/files/upload').expect(401);
    });

    it('rejects DELETE /api/files/* without a token', async () => {
      await request(server()).delete('/api/files/products/a.jpg').expect(401);
    });

    it('allows upload and delete with a valid token', async () => {
      await request(server()).post('/api/files/upload').set('Authorization', `Bearer ${token}`).expect(201);
      await request(server()).delete('/api/files/products/a.jpg').set('Authorization', `Bearer ${token}`).expect(200);
    });
  });

  it('keeps send-otp protected, as before', async () => {
    await request(server()).post('/api/auth/send-otp').expect(401);
  });

  it('does not log request headers', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await request(server()).get('/api/users').set('Authorization', 'Bearer not-a-real-token').expect(401);
    await request(server()).get('/api/users').set('Authorization', `Bearer ${token}`).expect(200);
    const logged = JSON.stringify([...log.mock.calls]);
    expect(logged).not.toContain('not-a-real-token');
    expect(logged).not.toContain(token);
    jest.restoreAllMocks();
  });
});

describe('isPublicRoute', () => {
  it('matches whole path segments only', () => {
    expect(isPublicRoute('GET', '/api/files')).toBe(true);
    expect(isPublicRoute('GET', '/api/files/a.jpg')).toBe(true);
    expect(isPublicRoute('GET', '/api/filesx/a.jpg')).toBe(false);
    expect(isPublicRoute('POST', '/api/auth/loginx')).toBe(false);
  });

  it('ignores the query string', () => {
    expect(isPublicRoute('GET', '/api/users?x=/api/files')).toBe(false);
    expect(isPublicRoute('GET', '/api/files/a.jpg?v=1')).toBe(true);
  });

  it('applies method restrictions', () => {
    expect(isPublicRoute('GET', '/api/pdf/s/abc')).toBe(true);
    expect(isPublicRoute('HEAD', '/api/files/a.jpg')).toBe(true);
    expect(isPublicRoute('POST', '/api/pdf/generate')).toBe(false);
    expect(isPublicRoute('PUT', '/api/files/a.jpg')).toBe(false);
  });
});
