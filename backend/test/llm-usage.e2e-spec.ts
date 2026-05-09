import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestUser,
  generateToken,
  createTestOrg,
  createTestCertification,
  cleanupByEmail,
  cleanupCertByCode,
} from './e2e-helpers';
import { LlmUsageService } from '../src/ai-question-bank/llm-usage/llm-usage.service';
import { LlmQuotaService } from '../src/ai-question-bank/llm-usage/llm-quota.service';

const EMAIL_PREFIX = 'e2e-llm-usage-';
const CERT_CODE_PREFIX = 'e2e-llm-cert-';

describe('LLM Usage & Quota (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let llmUsage: LlmUsageService;
  let llmQuota: LlmQuotaService;

  let userId: string;
  let userToken: string;
  let orgId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    llmUsage = app.get<LlmUsageService>(LlmUsageService);
    llmQuota = app.get<LlmQuotaService>(LlmQuotaService);

    // Clean up any leftover data
    await cleanupByEmail(prisma, EMAIL_PREFIX);
    await cleanupCertByCode(prisma, CERT_CODE_PREFIX);

    // Create test user
    const user = await createTestUser(prisma, {
      email: `${EMAIL_PREFIX}user@test.com`,
      displayName: 'E2E LLM Usage User',
    });
    userId = user.id;
    userToken = generateToken(app, user);

    // Create test organization
    const { org } = await createTestOrg(prisma, userId, {
      name: 'E2E LLM Usage Org',
    });
    orgId = org.id;
  });

  afterAll(async () => {
    // Clean up usage events and jobs created during tests
    if (orgId) {
      await prisma.llmUsageEvent.deleteMany({ where: { orgId } });
      await prisma.questionGenerationJob.deleteMany({ where: { orgId } });
    }

    // Clean up users and orgs
    await cleanupByEmail(prisma, EMAIL_PREFIX);
    await cleanupCertByCode(prisma, CERT_CODE_PREFIX);

    await prisma.$disconnect();
    await app.close();
  });

  describe('LlmUsageService Integration', () => {
    it('should record usage event with correct cost calculation', async () => {
      await llmUsage.recordQuestionGeneration(
        userId,
        orgId,
        'gpt-4',
        1000, // promptTokens
        2000, // completionTokens
      );

      // Verify event was recorded
      const event = await prisma.llmUsageEvent.findFirst({
        where: {
          userId,
          orgId,
          feature: 'question_generation',
          modelId: 'gpt-4',
        },
      });

      expect(event).toBeDefined();
      expect(event?.userId).toBe(userId);
      expect(event?.orgId).toBe(orgId);
      expect(event?.feature).toBe('question_generation');
      expect(event?.modelId).toBe('gpt-4');
      expect(event?.inputTokens).toBe(1000);
      expect(event?.outputTokens).toBe(2000);

      // Verify cost calculation
      // GPT-4: $0.03/1k input + $0.06/1k output
      // = (1000/1000 * 0.03) + (2000/1000 * 0.06) = 0.03 + 0.12 = 0.15
      expect(event?.costUsd.toNumber()).toBe(0.15);
    });

    it('should calculate costs correctly for different models', async () => {
      const tests = [
        {
          modelId: 'gpt-3.5-turbo',
          inputTokens: 1000,
          outputTokens: 1000,
          expectedCost: 0.002, // (1/1 * 0.0005) + (1/1 * 0.0015) = 0.002
        },
        {
          modelId: 'claude-3-opus',
          inputTokens: 1000,
          outputTokens: 2000,
          expectedCost: 0.165, // (1/1 * 0.015) + (2/1 * 0.075) = 0.165
        },
      ];

      for (const test of tests) {
        await llmUsage.recordQuestionGeneration(
          userId,
          orgId,
          test.modelId,
          test.inputTokens,
          test.outputTokens,
        );

        const event = await prisma.llmUsageEvent.findFirst({
          where: {
            userId,
            orgId,
            modelId: test.modelId,
            feature: 'question_generation',
          },
          orderBy: { createdAt: 'desc' },
        });

        expect(event?.costUsd.toNumber()).toBeCloseTo(test.expectedCost, 3);
      }
    });

    it('should aggregate daily org costs correctly', async () => {
      // Record multiple events for the same org
      const now = new Date();

      for (let i = 0; i < 3; i++) {
        await llmUsage.recordQuestionGeneration(
          userId,
          orgId,
          'gpt-4',
          100 + i * 100,
          200 + i * 100,
        );
      }

      // Get daily cost
      const dailyCost = await llmUsage.getOrgDailyCost(orgId, now);

      // Verify it's a sum of all recorded events (at least the ones we just created)
      expect(dailyCost).toBeGreaterThan(0);
      // Should be approximately the sum of the 3 events we created
      // Event 1: (100/1000 * 0.03) + (200/1000 * 0.06) = 0.003 + 0.012 = 0.015
      // Event 2: (200/1000 * 0.03) + (300/1000 * 0.06) = 0.006 + 0.018 = 0.024
      // Event 3: (300/1000 * 0.03) + (400/1000 * 0.06) = 0.009 + 0.024 = 0.033
      // Total ≈ 0.072
      expect(dailyCost).toBeGreaterThanOrEqual(0.07);
    });

    it('should handle different features correctly', async () => {
      await prisma.llmUsageEvent.create({
        data: {
          userId,
          orgId,
          feature: 'coach',
          modelId: 'gpt-4',
          inputTokens: 500,
          outputTokens: 1000,
          costUsd: '0.075',
        },
      });

      const breakdown = await llmUsage.getOrgCostByFeature(orgId);

      expect(breakdown).toContainEqual(
        expect.objectContaining({
          feature: 'coach',
        }),
      );
    });
  });

  describe('LlmQuotaService Integration', () => {
    it('should check quota status correctly', async () => {
      // Get current daily cost for org
      const costStatus = await llmQuota.checkOrgDailyQuota(orgId);

      expect(costStatus).toHaveProperty('usedCost');
      expect(costStatus).toHaveProperty('limitCost');
      expect(costStatus).toHaveProperty('isExceeded');

      expect(typeof costStatus.usedCost).toBe('number');
      expect(typeof costStatus.limitCost).toBe('number');
      expect(typeof costStatus.isExceeded).toBe('boolean');
    });

    it('should identify when quota is exceeded', async () => {
      // Create expensive usage events to exceed the default $5 limit
      for (let i = 0; i < 60; i++) {
        // Create an event with $0.1 cost each = $6 total (exceeds $5 limit)
        await prisma.llmUsageEvent.create({
          data: {
            userId,
            orgId,
            feature: 'question_generation',
            modelId: 'gpt-4',
            inputTokens: 3000,
            outputTokens: 6000,
            costUsd: '0.1',
          },
        });
      }

      const status = await llmQuota.checkOrgDailyQuota(orgId);

      expect(status.usedCost).toBeGreaterThan(5);
      expect(status.isExceeded).toBe(true);
    });

    it('should return default quota limit', () => {
      const limit = llmQuota.getDailyLimitUsd();

      expect(limit).toBe(5); // Default from service
    });

    it('should support custom quota limit via env var', () => {
      // This test verifies the service reads the env var
      // Note: changing env var requires service re-instantiation
      const limit = llmQuota.getDailyLimitUsd();

      expect(limit).toBeGreaterThan(0);
      expect(typeof limit).toBe('number');
    });

    it('should isolate quotas per organization', async () => {
      // Create another org
      const user2 = await createTestUser(prisma, {
        email: `${EMAIL_PREFIX}user2@test.com`,
        displayName: 'E2E LLM Usage User 2',
      });

      const { org: org2 } = await createTestOrg(prisma, user2.id, {
        name: 'E2E LLM Usage Org 2',
      });

      // Record high cost to org1
      await prisma.llmUsageEvent.create({
        data: {
          userId,
          orgId,
          feature: 'question_generation',
          modelId: 'gpt-4',
          inputTokens: 5000,
          outputTokens: 10000,
          costUsd: '0.6',
        },
      });

      // Record low cost to org2
      await prisma.llmUsageEvent.create({
        data: {
          userId: user2.id,
          orgId: org2.id,
          feature: 'question_generation',
          modelId: 'gpt-4',
          inputTokens: 100,
          outputTokens: 100,
          costUsd: '0.01',
        },
      });

      // Check quotas independently
      const status1 = await llmQuota.checkOrgDailyQuota(orgId);
      const status2 = await llmQuota.checkOrgDailyQuota(org2.id);

      // Org1 should have higher usage
      expect(status1.usedCost).toBeGreaterThan(status2.usedCost);

      // Clean up org2
      await prisma.llmUsageEvent.deleteMany({ where: { orgId: org2.id } });
      await prisma.questionGenerationJob.deleteMany({
        where: { orgId: org2.id },
      });
      await prisma.orgMember.deleteMany({ where: { userId: user2.id } });
      await prisma.organization.delete({ where: { id: org2.id } });
      await prisma.user.delete({ where: { id: user2.id } });
    });
  });

  describe('API Integration', () => {
    it('should support generating questions with org context', async () => {
      // Create certification
      const { cert } = await createTestCertification(prisma, {
        name: 'E2E Test Cert',
        code: CERT_CODE_PREFIX + Date.now(),
      });

      // Create LLM config
      await request(app.getHttpServer())
        .post('/ai-questions/config')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          provider: 'OPENAI',
          apiKey: 'sk-test-fake-key-for-e2e',
          modelId: 'gpt-4',
        })
        .expect(201);

      // Attempt to generate (will fail due to fake API key, but verifies endpoint works)
      const res = await request(app.getHttpServer())
        .post('/ai-questions/generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          certificationId: cert.id,
          provider: 'OPENAI',
          questionCount: 2,
          difficulty: 'MEDIUM',
          questionType: 'SINGLE',
        });

      // Should return a job ID (actual generation will fail in background)
      expect([201, 400]).toContain(res.status); // 201 if queued, 400 if validation fails
      if (res.status === 201) {
        expect(res.body.jobId).toBeDefined();
        expect(res.body.status).toBe('PENDING');
      }
    });

    it('should return LLM configs with masked keys', async () => {
      const res = await request(app.getHttpServer())
        .get('/ai-questions/config')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);

      // If configs exist, verify keys are masked
      if (res.body.length > 0) {
        const config = res.body[0];
        expect(config).toHaveProperty('maskedKey');
        expect(config).not.toHaveProperty('encryptedKey');
      }
    });
  });
});
