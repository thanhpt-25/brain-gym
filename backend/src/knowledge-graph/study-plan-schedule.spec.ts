import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../ai-question-bank/embedding/embedding.service';
import { getQueueToken } from '@nestjs/bullmq';
import { OVERLAP_QUEUE } from './overlap.processor';

const mockPrisma = {
  studyPlan: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  domain: { findMany: jest.fn() },
  question: { findMany: jest.fn() },
  reviewSchedule: {
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  certOverlap: { findMany: jest.fn() },
  certification: { findUnique: jest.fn(), findMany: jest.fn() },
  questionTag: { findMany: jest.fn() },
  $queryRawUnsafe: jest.fn(),
};

const mockEmbedding = { embed: jest.fn() };
const mockQueue = { add: jest.fn() };

describe('KnowledgeGraphService — study-plan scheduling (US-1104)', () => {
  let service: KnowledgeGraphService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeGraphService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmbeddingService, useValue: mockEmbedding },
        { provide: getQueueToken(OVERLAP_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get(KnowledgeGraphService);
  });

  const plan = {
    id: 'plan-1',
    userId: 'user-1',
    targetCertId: 'cert-target',
    sourceCertIds: ['cert-source'],
    skipTopics: ['Networking'],
    mustLearnTopics: ['Security', 'Storage'],
    effortReductionPct: 30,
    totalTopics: 3,
    skippableCount: 1,
    createdAt: new Date('2026-06-23'),
  };

  describe('happy path', () => {
    it('creates ReviewSchedule entries for all must-learn domain questions', async () => {
      mockPrisma.studyPlan.findUnique.mockResolvedValue(plan);
      mockPrisma.domain.findMany.mockResolvedValue([
        { id: 'dom-security' },
        { id: 'dom-storage' },
      ]);
      mockPrisma.question.findMany.mockResolvedValue([
        { id: 'q-1' },
        { id: 'q-2' },
        { id: 'q-3' },
      ]);
      // No existing schedules
      mockPrisma.reviewSchedule.findMany.mockResolvedValue([]);
      mockPrisma.reviewSchedule.createMany.mockResolvedValue({ count: 3 });

      const result = await service.scheduleFromPlan('user-1', 'plan-1');

      expect(result.scheduled).toBe(3);
      expect(result.alreadyExisted).toBe(0);
      expect(mockPrisma.reviewSchedule.createMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.reviewSchedule.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              userId: 'user-1',
              questionId: 'q-1',
              intervalDays: 1,
              repetitions: 0,
            }),
          ]),
          skipDuplicates: true,
        }),
      );
    });

    it('is idempotent — skips questions that already have a ReviewSchedule', async () => {
      mockPrisma.studyPlan.findUnique.mockResolvedValue(plan);
      mockPrisma.domain.findMany.mockResolvedValue([{ id: 'dom-security' }]);
      mockPrisma.question.findMany.mockResolvedValue([
        { id: 'q-1' },
        { id: 'q-2' },
      ]);
      // q-1 already scheduled, q-2 is new
      mockPrisma.reviewSchedule.findMany.mockResolvedValue([
        { questionId: 'q-1' },
      ]);
      mockPrisma.reviewSchedule.createMany.mockResolvedValue({ count: 1 });

      const result = await service.scheduleFromPlan('user-1', 'plan-1');

      expect(result.scheduled).toBe(1);
      expect(result.alreadyExisted).toBe(1);
      expect(mockPrisma.reviewSchedule.createMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.reviewSchedule.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [expect.objectContaining({ questionId: 'q-2' })],
        }),
      );
    });

    it('does not issue per-question queries — N+1 regression (S12)', async () => {
      mockPrisma.studyPlan.findUnique.mockResolvedValue(plan);
      mockPrisma.domain.findMany.mockResolvedValue([{ id: 'dom-security' }]);
      const questions = Array.from({ length: 50 }, (_, i) => ({
        id: `q-${i}`,
      }));
      mockPrisma.question.findMany.mockResolvedValue(questions);
      mockPrisma.reviewSchedule.findMany.mockResolvedValue([]);
      mockPrisma.reviewSchedule.createMany.mockResolvedValue({ count: 50 });

      await service.scheduleFromPlan('user-1', 'plan-1');

      // Exactly one batch read and one batch write — never per-question
      expect(mockPrisma.reviewSchedule.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.reviewSchedule.createMany).toHaveBeenCalledTimes(1);
    });

    it('skips createMany entirely when all questions already exist', async () => {
      mockPrisma.studyPlan.findUnique.mockResolvedValue(plan);
      mockPrisma.domain.findMany.mockResolvedValue([{ id: 'dom-security' }]);
      mockPrisma.question.findMany.mockResolvedValue([
        { id: 'q-1' },
        { id: 'q-2' },
      ]);
      // Both already scheduled
      mockPrisma.reviewSchedule.findMany.mockResolvedValue([
        { questionId: 'q-1' },
        { questionId: 'q-2' },
      ]);

      const result = await service.scheduleFromPlan('user-1', 'plan-1');

      expect(result.scheduled).toBe(0);
      expect(result.alreadyExisted).toBe(2);
      expect(mockPrisma.reviewSchedule.createMany).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('returns zero counts when mustLearnTopics is empty', async () => {
      mockPrisma.studyPlan.findUnique.mockResolvedValue({
        ...plan,
        mustLearnTopics: [],
      });

      const result = await service.scheduleFromPlan('user-1', 'plan-1');

      expect(result.scheduled).toBe(0);
      expect(result.alreadyExisted).toBe(0);
      expect(mockPrisma.domain.findMany).not.toHaveBeenCalled();
    });

    it('returns zero counts when no domains match mustLearnTopics names', async () => {
      mockPrisma.studyPlan.findUnique.mockResolvedValue(plan);
      mockPrisma.domain.findMany.mockResolvedValue([]);

      const result = await service.scheduleFromPlan('user-1', 'plan-1');

      expect(result.scheduled).toBe(0);
      expect(result.alreadyExisted).toBe(0);
      expect(mockPrisma.question.findMany).not.toHaveBeenCalled();
    });

    it('throws when plan does not exist', async () => {
      mockPrisma.studyPlan.findUnique.mockResolvedValue(null);

      await expect(
        service.scheduleFromPlan('user-1', 'nonexistent'),
      ).rejects.toThrow('StudyPlan nonexistent not found');
    });

    it('throws when plan belongs to a different user', async () => {
      mockPrisma.studyPlan.findUnique.mockResolvedValue({
        ...plan,
        userId: 'other-user',
      });

      await expect(
        service.scheduleFromPlan('user-1', 'plan-1'),
      ).rejects.toThrow('StudyPlan does not belong to user');
    });

    it('queries domains filtered by mustLearnTopics names and target cert', async () => {
      mockPrisma.studyPlan.findUnique.mockResolvedValue(plan);
      mockPrisma.domain.findMany.mockResolvedValue([]);

      await service.scheduleFromPlan('user-1', 'plan-1');

      expect(mockPrisma.domain.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            certificationId: 'cert-target',
            name: { in: ['Security', 'Storage'] },
          },
        }),
      );
    });
  });
});
