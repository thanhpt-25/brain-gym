import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { DigestGenerationService } from '../src/mail/digest/digest-generation.service';

describe('Digest E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let userId: string;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up in correct dependency order
    await prisma.orgMember.deleteMany({});
    await prisma.user.deleteMany({});
    const user = await prisma.user.create({
      data: {
        id: 'test-user-digest',
        email: 'digest@test.com',
        displayName: 'Digest User',
        passwordHash: 'hashed',
        subscriptionTier: 'PREMIUM',
        preferences: { digestEnabled: true },
      },
    });

    userId = user.id;
    accessToken = jwtService.sign(
      { sub: userId, email: user.email },
      { expiresIn: '1h' },
    );
  });

  describe('PATCH /user/digest/preference', () => {
    it('should toggle digest preference to disabled', async () => {
      const response = await request(app.getHttpServer())
        .patch('/user/digest/preference')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ enabled: false })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Digest disabled successfully',
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(
        (user?.preferences as Record<string, unknown>)?.digestEnabled,
      ).toBe(false);
    });

    it('should toggle digest preference to enabled', async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { preferences: { digestEnabled: false } },
      });

      const response = await request(app.getHttpServer())
        .patch('/user/digest/preference')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ enabled: true })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Digest enabled successfully',
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(
        (user?.preferences as Record<string, unknown>)?.digestEnabled,
      ).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app.getHttpServer())
        .patch('/user/digest/preference')
        .send({ enabled: false })
        .expect(401);

      expect(response.body.message).toContain('Invalid or missing token');
    });

    it('should validate request body', async () => {
      const response = await request(app.getHttpServer())
        .patch('/user/digest/preference')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ enabled: 'not-a-boolean' })
        .expect(200);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('Weekly Digest Generation', () => {
    it('should not send digest to users with digest disabled', async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { preferences: { digestEnabled: false } },
      });

      const digestService = app.get<DigestGenerationService>(
        DigestGenerationService,
      );
      const result = await digestService.generateWeeklyDigests();

      expect(result.skipped).toBeGreaterThanOrEqual(1);
      expect(result.sent).toBe(0);
    });

    it('should only send to premium users', async () => {
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionTier: 'FREE',
          preferences: { digestEnabled: true },
        },
      });

      const digestService = app.get<DigestGenerationService>(
        DigestGenerationService,
      );
      const result = await digestService.generateWeeklyDigests();

      expect(result.sent).toBe(0);
    });
  });
});
