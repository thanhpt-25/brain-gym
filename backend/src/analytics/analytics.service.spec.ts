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
    },
    answer: {
      findMany: jest.fn(),
    },
    question: {
      findUnique: jest.fn(),
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
  });

  describe('getReadiness', () => {
    it('should calculate readiness based on weighted scores', async () => {
      mockPrismaService.certification.findUnique.mockResolvedValue({ id: 'cert-1' });
      const now = new Date();
      const attempts = [
        { 
          score: 90, 
          submittedAt: now, 
          domainScores: { 'Domain A': { correct: 9, total: 10 } } 
        }
      ];
      mockPrismaService.examAttempt.findMany.mockResolvedValue(attempts);

      const result = await service.getReadiness('user-1', 'cert-1');

      expect(result.totalExams).toBe(1);
      expect(result.weightedAvgScore).toBe(90);
      expect(result.readinessScore).toBeGreaterThan(0);
    });
  });
});
