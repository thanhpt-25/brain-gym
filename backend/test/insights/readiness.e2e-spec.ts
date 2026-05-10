import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ReadinessService } from '../../src/insights/readiness/readiness.service';
import {
  createTestUser,
  generateToken,
  createTestCertification,
  cleanupByEmail,
} from '../e2e-helpers';
import { UserRole } from '@prisma/client';

describe('Readiness (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let readinessService: ReadinessService;

  let testUser: any;
  let authToken: string;
  let testCert: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    readinessService = app.get<ReadinessService>(ReadinessService);

    // Ensure clean state
    await cleanupByEmail(prisma, 'readiness-e2e');

    // Create test user and token
    testUser = await createTestUser(prisma, {
      email: 'readiness-e2e-user@test.com',
      displayName: 'Readiness E2E User',
      role: UserRole.LEARNER,
    });
    authToken = generateToken(app, testUser);

    // Create test certification
    const { cert } = await createTestCertification(prisma, {
      name: 'Readiness Test Cert',
      code: 'READINESS-101',
    });
    testCert = cert;
  });

  afterAll(async () => {
    await cleanupByEmail(prisma, 'readiness-e2e');
    await app.close();
  });

  describe('GET /api/v1/readiness/:certificationId', () => {
    it('should return not_enough_attempts if attempts < 10', async () => {
      const response = await request(app.getHttpServer())
        .get(`/readiness/${testCert.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        score: null,
        reason: 'not_enough_attempts',
      });
    });

    it('should return the score if attempts >= 10', async () => {
      // Manually set a readiness score to bypass the full computation tree
      await prisma.readinessScore.create({
        data: {
          userId: testUser.id,
          certificationId: testCert.id,
          score: 85,
          confidence: 0.75,
          attempts: 12, // Above MIN_ATTEMPTS_FOR_SCORE
          signals: {
            srsCoverage: 0.5,
            recentAccuracy14d: 0.8,
            domainSpread: 0.7,
            timePressure: 0.6,
          },
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/readiness/${testCert.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        score: 85,
        confidence: '0.75', // Decimal usually serializes to string
        attempts: 12,
      });
    });
  });

  describe('ReadinessService.recompute()', () => {
    it('should compute and persist a readiness score based on user data', async () => {
      // Clean up the manual score we added earlier
      await prisma.readinessScore.deleteMany({
        where: { userId: testUser.id, certificationId: testCert.id },
      });

      // Enable feature flag for testing
      process.env.FF_PREDICTOR_BETA = 'true';

      // Call the service directly to simulate what the BullMQ processor would do
      await readinessService.recompute(testUser.id, testCert.id);

      // Verify the database record was created
      const record = await prisma.readinessScore.findUnique({
        where: {
          userId_certificationId: {
            userId: testUser.id,
            certificationId: testCert.id,
          },
        },
      });

      // User has 0 attempts in DB, so score should be 0 and confidence 0
      expect(record).toBeDefined();
      expect(record?.score).toBe(0);
      expect(record?.attempts).toBe(0);
      expect(Number(record?.confidence)).toBe(0);
    });
  });
});
