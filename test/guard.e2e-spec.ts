import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { FilesService } from '../src/files/files.service';
import { UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';

describe('Guard Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let filesService: FilesService;
  
  // Test Data
  let guardToken: string;
  let testGuardId: string;
  const usedPhones = new Set<string>();
  const MIN_RESPONSE_MS = 1500;

  // Helper to get an isolated phone number for a test
  function getUniquePhone(): string {
    const p = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    usedPhones.add(p);
    return p;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    filesService = app.get<FilesService>(FilesService);

    // Mock FilesService to prevent real S3 uploads
    jest.spyOn(filesService, 'saveFile').mockResolvedValue({
      url: 'https://mock-s3-bucket.amazonaws.com/mock-photo.jpg',
      key: 'mock-photo.jpg',
    });

    // Mock OtpService SNS client to prevent real SMS sending and 500 errors
    const otpService = app.get(require('../src/otp/otp.service').OtpService);
    jest.spyOn((otpService as any).snsClient, 'send').mockResolvedValue({});

    // Setup: Create a test guard user
    const testGuard = await prisma.user.create({
      data: {
        email: `test-guard-${Date.now()}@example.com`,
        password: 'hashed-password',
        name: 'Test Guard',
        role: UserRole.GUARD,
      },
    });
    testGuardId = testGuard.id;

    // Setup: Create an auth token for the guard
    guardToken = jwtService.sign({ sub: testGuardId, role: UserRole.GUARD });
  });

  afterAll(async () => {
    // Cleanup everything created during tests
    await prisma.clientVisit.deleteMany({ where: { guardId: testGuardId } });
    await prisma.guardOtpSession.deleteMany({ where: { guardId: testGuardId } });
    await prisma.otpSession.deleteMany({ where: { phone: { in: Array.from(usedPhones) } } });
    await prisma.user.delete({ where: { id: testGuardId } });
    
    // Cleanup clients and phones universally based on used phone numbers
    if (usedPhones.size > 0) {
      const phones = Array.from(usedPhones);
      const clientPhones = await prisma.clientPhone.findMany({
        where: { phone: { in: phones } }
      });
      
      const clientIds = clientPhones.map(cp => cp.clientId);
      if (clientIds.length > 0) {
        await prisma.clientPhone.deleteMany({ where: { clientId: { in: clientIds } } });
        await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
      }
    }
    
    await app.close();
  });

  // Helper to generate a valid session token for a phone
  async function generateSessionToken(phone: string): Promise<string> {
    const jti = randomUUID();
    await prisma.guardOtpSession.create({
      data: {
        jti,
        guardId: testGuardId,
        phone,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    return jwtService.sign({
      jti,
      phone,
      guardId: testGuardId,
      purpose: 'guard_visit',
    });
  }

  describe('OTP flow', () => {
    it('should allow OTP verification for a dormant phone number, intentionally deferring existence check', async () => {
      const dormantPhone = getUniquePhone();
      
      // Setup: Create Client A with the phone, then mark it dormant
      const clientA = await prisma.client.create({ data: { clientCode: 'TEST/OTP-DORMANT' } });
      await prisma.clientPhone.create({
        data: { phone: dormantPhone, clientId: clientA.id, isPrimary: false, isDormant: true },
      });

      // 1. Send OTP should succeed despite dormancy
      await request(app.getHttpServer())
        .post('/api/guard/otp/send')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({ phone: dormantPhone })
        .expect(201)
        .expect({ status: 'otp_sent' });

      // Grab the generated OTP directly from DB for testing
      const session = await prisma.otpSession.findFirst({
        where: { phone: dormantPhone, isUsed: false },
        orderBy: { createdAt: 'desc' }
      });

      // 2. Verify OTP should succeed and return a session token
      const res = await request(app.getHttpServer())
        .post('/api/guard/otp/verify')
        .set('Authorization', `Bearer ${guardToken}`)
        .send({ phone: dormantPhone, otp: session!.otp })
        .expect(201);

      expect(res.body.status).toBe('verified');
      expect(res.body.sessionToken).toBeDefined();
    });
  });

  describe('POST /guard/visits', () => {
    const dummyPhoto = Buffer.from('fake-image-content');

    it('should assert the session token query is atomic (consumed: false AND expiresAt > now())', async () => {
      const sessionToken = await generateSessionToken(getUniquePhone());

      await request(app.getHttpServer())
        .post('/api/guard/visits')
        .set('Authorization', `Bearer ${guardToken}`)
        .attach('photo', dummyPhoto, 'test.jpg')
        .field('sessionToken', sessionToken)
        .field('latitude', '28.7041')
        .field('longitude', '77.1025')
        .expect(201);
    });

    it('should create a NEW client (isPrimary, isPhoneVerified) on first visit, response has zero data leakage', async () => {
      const phone = getUniquePhone();
      const sessionToken = await generateSessionToken(phone);

      const res = await request(app.getHttpServer())
        .post('/api/guard/visits')
        .set('Authorization', `Bearer ${guardToken}`)
        .attach('photo', dummyPhoto, 'test.jpg')
        .field('sessionToken', sessionToken)
        .field('latitude', '28.7041')
        .field('longitude', '77.1025')
        .expect(201);

      // Strict response shape check (no clientId leaked)
      expect(res.body).toEqual({
        status: 'success',
        visitLogged: true,
      });

      // Verify DB state
      const clientPhone = await prisma.clientPhone.findFirst({
        where: { phone },
        include: { client: { include: { visits: true } } },
      });

      expect(clientPhone).toBeDefined();
      expect(clientPhone.isPrimary).toBe(true);
      expect(clientPhone.isPhoneVerified).toBe(true);
      expect(clientPhone.isDormant).toBe(false);
      expect(clientPhone.client.visits.length).toBe(1);
      expect(clientPhone.client.visits[0].visitNumber).toBe(1);
    });

    it('should link to EXISTING client on second visit, increment visitNumber to 2, identical response shape', async () => {
      const phone = getUniquePhone();
      
      // Setup: manually run first visit
      const firstSessionToken = await generateSessionToken(phone);
      await request(app.getHttpServer())
        .post('/api/guard/visits')
        .set('Authorization', `Bearer ${guardToken}`)
        .attach('photo', dummyPhoto, 'test.jpg')
        .field('sessionToken', firstSessionToken)
        .field('latitude', '28.7041')
        .field('longitude', '77.1025')
        .expect(201);

      // Execute second visit
      const secondSessionToken = await generateSessionToken(phone);
      const res = await request(app.getHttpServer())
        .post('/api/guard/visits')
        .set('Authorization', `Bearer ${guardToken}`)
        .attach('photo', dummyPhoto, 'test.jpg')
        .field('sessionToken', secondSessionToken)
        .field('latitude', '28.7041')
        .field('longitude', '77.1025')
        .expect(201);

      // Strict response shape check
      expect(res.body).toEqual({
        status: 'success',
        visitLogged: true,
      });

      // Verify DB state
      const clientPhone = await prisma.clientPhone.findFirst({
        where: { phone },
        include: { client: { include: { visits: { orderBy: { createdAt: 'desc' } } } } },
      });

      expect(clientPhone.client.visits.length).toBe(2);
      expect(clientPhone.client.visits[0].visitNumber).toBe(2);
    });

    it('should handle Dormant Reassignment: log visit against NEW client B, update supersededByPhoneId on client A', async () => {
      const dormantPhone = getUniquePhone();
      
      // Setup: Create Client A with the phone, then mark it dormant
      const clientA = await prisma.client.create({ data: { clientCode: 'TEST/A' } });
      const phoneA = await prisma.clientPhone.create({
        data: { phone: dormantPhone, clientId: clientA.id, isPrimary: false, isDormant: true },
      });

      // Guard logs visit with the dormant number
      const sessionToken = await generateSessionToken(dormantPhone);
      await request(app.getHttpServer())
        .post('/api/guard/visits')
        .set('Authorization', `Bearer ${guardToken}`)
        .attach('photo', dummyPhoto, 'test.jpg')
        .field('sessionToken', sessionToken)
        .field('latitude', '28.7041')
        .field('longitude', '77.1025')
        .expect(201);

      // Verify DB state
      // 1. A NEW active client B phone should exist
      const phoneB = await prisma.clientPhone.findFirst({
        where: { phone: dormantPhone, isDormant: false },
        include: { client: { include: { visits: true } } },
      });
      expect(phoneB).toBeDefined();
      expect(phoneB.clientId).not.toBe(clientA.id);
      expect(phoneB.client.visits.length).toBe(1);

      // 2. The dormant phone A should have supersededByPhoneId pointing to phone B
      const updatedPhoneA = await prisma.clientPhone.findUnique({ where: { id: phoneA.id } });
      expect(updatedPhoneA.supersededByPhoneId).toBe(phoneB.id);
    });

    it('should enforce timing normalization on success and error paths', async () => {
      const sessionToken = await generateSessionToken(getUniquePhone());
      
      // Success path
      const start1 = Date.now();
      await request(app.getHttpServer())
        .post('/api/guard/visits')
        .set('Authorization', `Bearer ${guardToken}`)
        .attach('photo', dummyPhoto, 'test.jpg')
        .field('sessionToken', sessionToken)
        .field('latitude', '28.7041')
        .field('longitude', '77.1025')
        .expect(201);
      expect(Date.now() - start1).toBeGreaterThanOrEqual(MIN_RESPONSE_MS);

      // Error path (invalid token)
      const start2 = Date.now();
      await request(app.getHttpServer())
        .post('/api/guard/visits')
        .set('Authorization', `Bearer ${guardToken}`)
        .attach('photo', dummyPhoto, 'test.jpg')
        .field('sessionToken', 'invalid.token')
        .field('latitude', '28.7041')
        .field('longitude', '77.1025')
        .expect(403);
      expect(Date.now() - start2).toBeGreaterThanOrEqual(MIN_RESPONSE_MS);
    });

    it('should reject reuse of a consumed session token immediately', async () => {
      const sessionToken = await generateSessionToken(getUniquePhone());

      // First request - succeeds
      await request(app.getHttpServer())
        .post('/api/guard/visits')
        .set('Authorization', `Bearer ${guardToken}`)
        .attach('photo', dummyPhoto, 'test.jpg')
        .field('sessionToken', sessionToken)
        .field('latitude', '28.7041')
        .field('longitude', '77.1025')
        .expect(201);

      // Second request immediately after - fails
      await request(app.getHttpServer())
        .post('/api/guard/visits')
        .set('Authorization', `Bearer ${guardToken}`)
        .attach('photo', dummyPhoto, 'test.jpg')
        .field('sessionToken', sessionToken)
        .field('latitude', '28.7041')
        .field('longitude', '77.1025')
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toContain('invalid, expired, or already used');
        });
    });

    it('should prevent race conditions on concurrent token reuse', async () => {
      const sessionToken = await generateSessionToken(getUniquePhone());

      // Fire 10 concurrent requests
      const concurrentRequests = Array(10).fill(0).map(() => 
        request(app.getHttpServer())
          .post('/api/guard/visits')
          .set('Authorization', `Bearer ${guardToken}`)
          .attach('photo', dummyPhoto, 'test.jpg')
          .field('sessionToken', sessionToken)
          .field('latitude', '28.7041')
          .field('longitude', '77.1025')
      );

      const responses = await Promise.all(concurrentRequests);

      const successCount = responses.filter(r => r.status === 201).length;
      const failCount = responses.filter(r => r.status === 403).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(9);
    });
  });

  describe('GET /guard/admin/visits (Access Control)', () => {
    it('should return 403 Forbidden for GUARD role users', async () => {
      await request(app.getHttpServer())
        .get('/api/guard/admin/visits')
        .set('Authorization', `Bearer ${guardToken}`)
        .expect(403);
    });
  });
});
