import { Test, TestingModule } from '@nestjs/testing';
import { BenchmarkService } from './benchmark.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  certification: { findUnique: jest.fn(), findMany: jest.fn() },
  examAttempt: { findMany: jest.fn() },
};

describe('BenchmarkService (US-1006)', () => {
  let service: BenchmarkService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BenchmarkService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(BenchmarkService);
  });

  describe('getBenchmark — passers-only cohort', () => {
    beforeEach(() => {
      mockPrisma.certification.findUnique.mockResolvedValue({
        id: 'cert-1',
        passingScore: 70,
      });
    });

    it('hides stats when cohort is below k-anonymity threshold', async () => {
      mockPrisma.examAttempt.findMany.mockResolvedValue([
        { userId: 'u-1', score: 80, domainScores: null },
        { userId: 'u-2', score: 75, domainScores: null },
        { userId: 'u-3', score: 90, domainScores: null },
      ]);

      const dto = await service.getBenchmark('user-1', 'cert-1');

      expect(dto.percentile).toBeNull();
      expect(dto.cohortSize).toBeNull();
      expect(dto.hiddenReason).toMatch(/cohort too small/i);
    });

    it('computes percentile correctly for a 10-person cohort', async () => {
      const attempts = Array.from({ length: 10 }, (_, i) => ({
        userId: `u-${i}`,
        score: 70 + i * 3, // 70,73,...,97
        domainScores: null,
      }));
      mockPrisma.examAttempt.findMany.mockResolvedValue(attempts);

      const dto = await service.getBenchmark('u-5', 'cert-1');

      expect(dto.percentile).not.toBeNull();
      expect(dto.userScore).toBe(85); // u-5: 70 + 5*3
      expect(dto.cohortSize).toBe(10);
    });

    it('de-duplicates to best score per user', async () => {
      const attempts = [
        ...Array.from({ length: 9 }, (_, i) => ({
          userId: `u-${i + 2}`,
          score: 75,
          domainScores: null,
        })),
        { userId: 'u-1', score: 75, domainScores: null },
        { userId: 'u-1', score: 90, domainScores: null }, // duplicate — higher wins
      ];
      mockPrisma.examAttempt.findMany.mockResolvedValue(attempts);

      const dto = await service.getBenchmark('u-1', 'cert-1');

      expect(dto.cohortSize).toBe(10); // 9 others + u-1 deduplicated
      expect(dto.userScore).toBe(90);
    });

    it('filters by SUBMITTED status and passingScore', async () => {
      mockPrisma.examAttempt.findMany.mockResolvedValue([]);

      await service.getBenchmark('user-1', 'cert-1');

      expect(mockPrisma.examAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            score: { gte: 70 },
            exam: { certificationId: 'cert-1' },
          }),
        }),
      );
    });
  });

  describe('getBenchmark — domain breakdown', () => {
    beforeEach(() => {
      mockPrisma.certification.findUnique.mockResolvedValue({
        id: 'cert-1',
        passingScore: 70,
      });
    });

    it('computes userAccuracy per domain', async () => {
      const domainScores = {
        'dom-sec': { correct: 8, total: 10, name: 'Security' },
      };
      const attempts = Array.from({ length: 10 }, (_, i) => ({
        userId: i === 0 ? 'user-1' : `u-${i}`,
        score: 80,
        domainScores,
      }));
      mockPrisma.examAttempt.findMany.mockResolvedValue(attempts);

      const dto = await service.getBenchmark('user-1', 'cert-1');

      const security = dto.domainBreakdown.find(
        (d) => d.domainId === 'dom-sec',
      );
      expect(security?.userAccuracy).toBe(80);
      expect(security?.domainName).toBe('Security');
    });

    it('hides cohort accuracy per-domain when fewer than 10 samples', async () => {
      const domainScores = { 'dom-x': { correct: 7, total: 10, name: 'X' } };
      const attempts = [
        { userId: 'user-1', score: 80, domainScores },
        ...Array.from({ length: 4 }, (_, i) => ({
          userId: `u-${i + 2}`,
          score: 80,
          domainScores,
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          userId: `u-${i + 10}`,
          score: 80,
          domainScores: null,
        })),
      ];
      mockPrisma.examAttempt.findMany.mockResolvedValue(attempts);

      const dto = await service.getBenchmark('user-1', 'cert-1');
      const domain = dto.domainBreakdown.find((d) => d.domainId === 'dom-x');

      // only 5 cohort members have data for dom-x → below threshold → hidden
      expect(domain?.cohortAccuracy).toBeNull();
    });

    it('returns empty domainBreakdown when user has no domainScores', async () => {
      const attempts = Array.from({ length: 10 }, (_, i) => ({
        userId: `u-${i}`,
        score: 80,
        domainScores: null,
      }));
      mockPrisma.examAttempt.findMany.mockResolvedValue(attempts);

      const dto = await service.getBenchmark('user-1', 'cert-1');

      expect(dto.domainBreakdown).toHaveLength(0);
    });
  });

  describe('getAllBenchmarks — N+1 fix', () => {
    it('uses a single batch query for all certs instead of N individual queries', async () => {
      mockPrisma.examAttempt.findMany
        .mockResolvedValueOnce([
          { exam: { certificationId: 'cert-1' } },
          { exam: { certificationId: 'cert-2' } },
        ])
        .mockResolvedValueOnce([]);

      mockPrisma.certification.findMany.mockResolvedValue([
        { id: 'cert-1', passingScore: 70 },
        { id: 'cert-2', passingScore: 75 },
      ]);

      await service.getAllBenchmarks('user-1');

      // Exactly 2 calls: user cert lookup + batch passer query
      expect(mockPrisma.examAttempt.findMany).toHaveBeenCalledTimes(2);
      const batchCall = mockPrisma.examAttempt.findMany.mock.calls[1][0];
      expect(batchCall.where.exam.certificationId).toEqual({
        in: expect.arrayContaining(['cert-1', 'cert-2']),
      });
    });

    it('returns empty array when user has no submitted attempts', async () => {
      mockPrisma.examAttempt.findMany.mockResolvedValue([]);

      const result = await service.getAllBenchmarks('user-1');

      expect(result).toEqual([]);
      expect(mockPrisma.certification.findMany).not.toHaveBeenCalled();
    });
  });
});
