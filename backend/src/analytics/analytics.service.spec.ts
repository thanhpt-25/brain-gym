import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttemptStatus } from '@prisma/client';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    examAttempt: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    certification: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    answer: {
      findMany: jest.fn(),
    },
    question: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSummary', () => {
    it('should calculate summary correctly', async () => {
      const attempts = [
        { score: 80, totalCorrect: 8, totalQuestions: 10, timeSpent: 600 },
        { score: 60, totalCorrect: 6, totalQuestions: 10, timeSpent: 400 },
      ];
      mockPrismaService.examAttempt.findMany.mockResolvedValue(attempts);

      const result = await service.getSummary('user-1');

      expect(result.totalExams).toBe(2);
      expect(result.avgScore).toBe(70);
      expect(result.bestScore).toBe(80);
      expect(result.totalPassed).toBe(1);
    });

    it('should return zeros if no attempts found', async () => {
      mockPrismaService.examAttempt.findMany.mockResolvedValue([]);
      const result = await service.getSummary('user-1');
      expect(result.totalExams).toBe(0);
      expect(result.avgScore).toBe(0);
    });

    it("honors each certification's own passing score", async () => {
      // Cert requires 75% to pass: a 72% attempt should NOT count as passed,
      // even though it clears the default 70% fallback.
      const attempts = [
        {
          score: 80,
          totalCorrect: 8,
          totalQuestions: 10,
          timeSpent: 600,
          exam: { certification: { passingScore: 75 } },
        },
        {
          score: 72,
          totalCorrect: 7,
          totalQuestions: 10,
          timeSpent: 500,
          exam: { certification: { passingScore: 75 } },
        },
      ];
      mockPrismaService.examAttempt.findMany.mockResolvedValue(attempts);

      const result = await service.getSummary('user-1');

      expect(result.totalPassed).toBe(1);
      expect(result.passRate).toBe(50);
    });

    it('falls back to 70 when a certification has no passing score', async () => {
      const attempts = [
        {
          score: 70,
          totalCorrect: 7,
          totalQuestions: 10,
          timeSpent: 600,
          exam: { certification: { passingScore: null } },
        },
      ];
      mockPrismaService.examAttempt.findMany.mockResolvedValue(attempts);

      const result = await service.getSummary('user-1');

      expect(result.totalPassed).toBe(1);
    });
  });

  describe('getPlatformStats', () => {
    it("judges each attempt against its own certification's passing score, not a flat 70%", async () => {
      mockPrismaService.question.count.mockResolvedValue(500);
      mockPrismaService.certification.count.mockResolvedValue(2);
      mockPrismaService.examAttempt.findMany.mockResolvedValue([
        // Fails its own cert's 80% cutoff, even though it clears a flat 70%.
        { score: 78, exam: { certification: { passingScore: 80 } } },
        // Fails a flat 70% cutoff but passes this cert's real 60% cutoff.
        { score: 65, exam: { certification: { passingScore: 60 } } },
      ]);

      const result = await service.getPlatformStats();

      expect(result.totalQuestions).toBe(500);
      expect(result.totalCertifications).toBe(2);
      expect(result.totalExamAttempts).toBe(2);
      // Only the second attempt passes its own cert's cutoff.
      expect(result.averagePassRate).toBe(50);
    });

    it('falls back to the default passing score when a certification has none set', async () => {
      mockPrismaService.question.count.mockResolvedValue(10);
      mockPrismaService.certification.count.mockResolvedValue(1);
      mockPrismaService.examAttempt.findMany.mockResolvedValue([
        { score: 70, exam: { certification: { passingScore: null } } },
      ]);

      const result = await service.getPlatformStats();

      expect(result.averagePassRate).toBe(100);
    });

    it('returns a zero pass rate instead of dividing by zero when there are no attempts', async () => {
      mockPrismaService.question.count.mockResolvedValue(0);
      mockPrismaService.certification.count.mockResolvedValue(0);
      mockPrismaService.examAttempt.findMany.mockResolvedValue([]);

      const result = await service.getPlatformStats();

      expect(result.totalExamAttempts).toBe(0);
      expect(result.averagePassRate).toBe(0);
    });
  });

  describe('getReadiness', () => {
    it('should calculate readiness based on weighted scores', async () => {
      mockPrismaService.certification.findUnique.mockResolvedValue({
        id: 'cert-1',
      });
      const now = new Date();
      const attempts = [
        {
          score: 90,
          submittedAt: now,
          domainScores: { 'Domain A': { correct: 9, total: 10 } },
        },
      ];
      mockPrismaService.examAttempt.findMany.mockResolvedValue(attempts);

      const result = await service.getReadiness('user-1', 'cert-1');

      expect(result.totalExams).toBe(1);
      expect(result.weightedAvgScore).toBe(90);
      expect(result.readinessScore).toBeGreaterThan(0);
    });
  });
});
