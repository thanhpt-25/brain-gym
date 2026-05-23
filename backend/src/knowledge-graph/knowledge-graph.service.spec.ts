import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../ai-question-bank/embedding/embedding.service';
import { OVERLAP_QUEUE } from './overlap.processor';

const mockPrisma = {
  certOverlap: { findMany: jest.fn(), upsert: jest.fn() },
  certification: { findUnique: jest.fn(), findMany: jest.fn() },
  domain: { findMany: jest.fn() },
  studyPlan: { create: jest.fn(), findMany: jest.fn() },
  readinessScore: { findMany: jest.fn() },
  questionTag: { findMany: jest.fn() },
  $queryRawUnsafe: jest.fn(),
};

const mockQueue = { add: jest.fn() };

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeGraphService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmbeddingService, useValue: {} },
        { provide: getQueueToken(OVERLAP_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get(KnowledgeGraphService);
  });

  describe('enqueueOverlapCompute (US-1001)', () => {
    it('adds a BullMQ job and returns its id', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-42' });

      const result = await service.enqueueOverlapCompute('cert-1');

      expect(mockQueue.add).toHaveBeenCalledWith('compute', {
        certId: 'cert-1',
      });
      expect(result).toEqual({ jobId: 'job-42' });
    });

    it('returns empty string when queue job has no id', async () => {
      mockQueue.add.mockResolvedValue({ id: undefined });
      const result = await service.enqueueOverlapCompute('cert-1');
      expect(result.jobId).toBe('');
    });
  });

  describe('generateStudyPlan (US-1002)', () => {
    const userId = 'user-1';
    const targetCertId = 'cert-target';
    const passedCertIds = ['cert-src'];

    beforeEach(() => {
      mockPrisma.domain.findMany.mockResolvedValue([
        { id: 'dom-1', name: 'Security', certificationId: targetCertId },
        { id: 'dom-2', name: 'Networking', certificationId: targetCertId },
      ]);
      mockPrisma.certOverlap.findMany.mockResolvedValue([
        {
          certBId: targetCertId,
          certAId: 'cert-src',
          domainBId: 'dom-1',
          overlapPct: 0.8,
          sharedTopics: ['TLS'],
        },
      ]);
      mockPrisma.studyPlan.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'plan-1',
          createdAt: new Date('2026-01-01'),
          ...data,
        }),
      );
    });

    it('persists the plan and returns it with an id', async () => {
      const plan = await service.generateStudyPlan(
        userId,
        targetCertId,
        passedCertIds,
      );

      expect(mockPrisma.studyPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId, targetCertId }),
        }),
      );
      expect(plan.id).toBe('plan-1');
    });

    it('skips domain when overlap >= 0.65', async () => {
      const plan = await service.generateStudyPlan(
        userId,
        targetCertId,
        passedCertIds,
      );
      expect(plan.skipTopics).toContain('Security');
      expect(plan.mustLearnTopics).toContain('Networking');
    });

    it('computes cosine-weighted effortReductionPct', async () => {
      const plan = await service.generateStudyPlan(
        userId,
        targetCertId,
        passedCertIds,
      );
      // overlap 0.8 for 1 skip domain out of 2 total → floor(0.8/2 * 100) = 40
      expect(plan.effortReductionPct).toBe(40);
    });

    it('caps effortReductionPct at 100', async () => {
      mockPrisma.certOverlap.findMany.mockResolvedValue([
        {
          certBId: targetCertId,
          certAId: 'cert-src',
          domainBId: 'dom-1',
          overlapPct: 1.0,
          sharedTopics: [],
        },
        {
          certBId: targetCertId,
          certAId: 'cert-src',
          domainBId: 'dom-2',
          overlapPct: 1.0,
          sharedTopics: [],
        },
      ]);
      const plan = await service.generateStudyPlan(
        userId,
        targetCertId,
        passedCertIds,
      );
      expect(plan.effortReductionPct).toBeLessThanOrEqual(100);
    });
  });

  describe('listStudyPlans (US-1002)', () => {
    it('returns persisted plans for the user', async () => {
      const rows = [
        {
          id: 'plan-1',
          userId: 'user-1',
          targetCertId: 'cert-1',
          sourceCertIds: ['cert-src'],
          skipTopics: ['Security'],
          mustLearnTopics: ['Networking'],
          effortReductionPct: 40,
          totalTopics: 2,
          skippableCount: 1,
          createdAt: new Date('2026-01-01'),
        },
      ];
      mockPrisma.studyPlan.findMany.mockResolvedValue(rows);

      const plans = await service.listStudyPlans('user-1');

      expect(mockPrisma.studyPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
      expect(plans).toHaveLength(1);
      expect(plans[0].id).toBe('plan-1');
      expect(plans[0].effortReductionPct).toBe(40);
    });
  });
});
