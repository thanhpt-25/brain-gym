import { Test, TestingModule } from '@nestjs/testing';
import { BenchmarkService } from './benchmark.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BenchmarkService', () => {
  let service: BenchmarkService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BenchmarkService,
        {
          provide: PrismaService,
          useValue: {
            attempt: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
            cohortBenchmark: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<BenchmarkService>(BenchmarkService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('computeCohortPercentile', () => {
    it('should compute percentile rank relative to top 10% cohort', async () => {
      const certId = 'cert-1';
      const userScore = 78;

      const mockAttempts = [
        { id: 'att-1', userId: 'user-1', score: 95 },
        { id: 'att-2', userId: 'user-2', score: 92 },
        { id: 'att-3', userId: 'user-3', score: 88 },
        { id: 'att-4', userId: 'user-4', score: 85 },
        { id: 'att-5', userId: 'user-5', score: 82 },
        { id: 'att-6', userId: 'user-6', score: 78 },
        { id: 'att-7', userId: 'user-7', score: 72 },
        { id: 'att-8', userId: 'user-8', score: 65 },
        { id: 'att-9', userId: 'user-9', score: 60 },
        { id: 'att-10', userId: 'user-10', score: 55 },
      ];

      jest
        .spyOn(prisma.attempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.computeCohortPercentile(certId, userScore);

      expect(result).toHaveProperty('percentileRank');
      expect(result.percentileRank).toBeGreaterThanOrEqual(0);
      expect(result.percentileRank).toBeLessThanOrEqual(100);
    });
  });

  describe('getTop10PctBenchmark', () => {
    it('should return top 10% benchmark metrics for certification', async () => {
      const certId = 'cert-1';

      const mockBenchmark = {
        certificationId: certId,
        topDecileMean: 89.5,
        topDecileMedian: 90,
        topDecileStdDev: 3.2,
        top10PctPassRate: 98.5,
        computedAt: new Date(),
      };

      jest
        .spyOn(prisma.cohortBenchmark, 'findUnique')
        .mockResolvedValue(mockBenchmark as any);

      const result = await service.getTop10PctBenchmark(certId);

      expect(result.topDecileMean).toBe(89.5);
      expect(result.top10PctPassRate).toBe(98.5);
    });
  });

  describe('getUserBenchmarkComparison', () => {
    it('should compare user performance against top 10% cohort', async () => {
      const userId = 'user-1';
      const certId = 'cert-1';
      const userScore = 85;

      const result = await service.getUserBenchmarkComparison(
        userId,
        certId,
        userScore,
      );

      expect(result).toHaveProperty('percentileRank');
      expect(result).toHaveProperty('comparisonText');
      expect(result).toHaveProperty('targetToReachTop10Pct');
    });
  });
});
