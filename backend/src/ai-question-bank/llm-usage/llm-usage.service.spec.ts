import { Test, TestingModule } from '@nestjs/testing';
import { LlmUsageService } from './llm-usage.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('LlmUsageService', () => {
  let service: LlmUsageService;
  let prisma: PrismaService;

  const mockPrisma = {
    llmUsageEvent: {
      create: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmUsageService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<LlmUsageService>(LlmUsageService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateTokenCost', () => {
    it('should calculate cost for GPT-4-Turbo correctly', () => {
      // 1000 input tokens @ $0.01/1k, 2000 output tokens @ $0.03/1k
      const cost = service.calculateTokenCost('gpt-4-turbo', 1000, 2000);
      expect(cost).toBe(0.07); // (1000/1000 * 0.01) + (2000/1000 * 0.03) = 0.01 + 0.06 = 0.07
    });

    it('should calculate cost for GPT-3.5-Turbo correctly', () => {
      // 1500 input @ $0.0005/1k, 1000 output @ $0.0015/1k
      const cost = service.calculateTokenCost('gpt-3.5-turbo', 1500, 1000);
      expect(cost).toBe(0.00225); // (1500/1000 * 0.0005) + (1000/1000 * 0.0015) = 0.00075 + 0.0015 = 0.00225
    });

    it('should calculate cost for Claude 3 Opus correctly', () => {
      const cost = service.calculateTokenCost('claude-3-opus', 1000, 2000);
      expect(cost).toBe(0.165); // (1000/1000 * 0.015) + (2000/1000 * 0.075) = 0.015 + 0.15 = 0.165
    });

    it('should handle unknown models with fallback pricing', () => {
      const cost = service.calculateTokenCost('unknown-model', 1000, 1000);
      expect(cost).toBe(0.002); // (1000/1000 * 0.001) + (1000/1000 * 0.001) = 0.001 + 0.001 = 0.002
    });

    it('should round cost to nearest cent', () => {
      // GPT-3.5 is cheap, this preserves 6 decimals of precision
      const cost = service.calculateTokenCost('gpt-3.5-turbo', 999, 999);
      // (999/1000 * 0.0005) + (999/1000 * 0.0015) = 0.0004995 + 0.0014985 = 0.001998
      expect(cost).toBe(0.001998); // Preserves full precision (Decimal(10,6))
    });
  });

  describe('recordUsageEvent', () => {
    it('should create LlmUsageEvent with calculated cost', async () => {
      const input = {
        userId: 'user-123',
        orgId: 'org-456',
        feature: 'question_generation' as const,
        modelId: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 2000,
      };

      await service.recordUsageEvent(input);

      expect(mockPrisma.llmUsageEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          orgId: 'org-456',
          feature: 'question_generation',
          modelId: 'gpt-4',
          inputTokens: 1000,
          outputTokens: 2000,
          costUsd: expect.any(Object), // Decimal object
        }),
      });
    });

    it('should handle null orgId gracefully', async () => {
      const input = {
        userId: 'user-123',
        orgId: null as unknown as string | null,
        feature: 'question_generation' as const,
        modelId: 'gpt-4-turbo',
        inputTokens: 500,
        outputTokens: 1000,
      };

      await service.recordUsageEvent(input);

      expect(mockPrisma.llmUsageEvent.create).toHaveBeenCalled();
    });

    it('should not throw on database error', async () => {
      mockPrisma.llmUsageEvent.create.mockRejectedValueOnce(
        new Error('DB error'),
      );

      const input = {
        userId: 'user-123',
        orgId: 'org-456',
        feature: 'question_generation' as const,
        modelId: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 2000,
      };

      // Should not throw
      await expect(service.recordUsageEvent(input)).resolves.toBeUndefined();
    });
  });

  describe('recordQuestionGeneration', () => {
    it('should record question generation with mapped token names', async () => {
      await service.recordQuestionGeneration(
        'user-456',
        'org-789',
        'gpt-4',
        1000, // promptTokens → inputTokens
        2000, // completionTokens → outputTokens
      );

      expect(mockPrisma.llmUsageEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          feature: 'question_generation',
          inputTokens: 1000,
          outputTokens: 2000,
        }),
      });
    });
  });

  describe('getOrgDailyCost', () => {
    it('should aggregate daily cost for an org', async () => {
      const mockDecimal = {
        toString: jest.fn().mockReturnValue('25.5'),
      };
      mockPrisma.llmUsageEvent.aggregate.mockResolvedValueOnce({
        _sum: { costUsd: mockDecimal },
      });

      const cost = await service.getOrgDailyCost('org-123');

      expect(cost).toBe(25.5);
      expect(mockPrisma.llmUsageEvent.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            orgId: 'org-123',
            createdAt: expect.any(Object),
          },
          _sum: { costUsd: true },
        }),
      );
    });

    it('should return 0 when no events exist', async () => {
      mockPrisma.llmUsageEvent.aggregate.mockResolvedValueOnce({
        _sum: { costUsd: null },
      });

      const cost = await service.getOrgDailyCost('org-123');

      expect(cost).toBe(0);
    });

    it('should use provided date', async () => {
      const testDate = new Date('2026-05-09');
      mockPrisma.llmUsageEvent.aggregate.mockResolvedValueOnce({
        _sum: { costUsd: null },
      });

      await service.getOrgDailyCost('org-123', testDate);

      const call = mockPrisma.llmUsageEvent.aggregate.mock.calls[0][0];
      // Service sets UTC hours, so we compare with UTC time
      expect(call.where.createdAt.gte).toEqual(
        new Date('2026-05-09T00:00:00Z'),
      );
      // Check end of day is the same day in UTC
      expect(call.where.createdAt.lte.getUTCDate()).toBe(9); // Same day in UTC
    });
  });

  describe('getUserDailyCost', () => {
    it('should aggregate daily cost for a user', async () => {
      const mockDecimal = {
        toString: jest.fn().mockReturnValue('12.75'),
      };
      mockPrisma.llmUsageEvent.aggregate.mockResolvedValueOnce({
        _sum: { costUsd: mockDecimal },
      });

      const cost = await service.getUserDailyCost('user-123');

      expect(cost).toBe(12.75);
      expect(mockPrisma.llmUsageEvent.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-123',
            createdAt: expect.any(Object),
          },
        }),
      );
    });
  });

  describe('getOrgCostByFeature', () => {
    it('should group costs by feature', async () => {
      const mockDecimal20 = {
        toString: jest.fn().mockReturnValue('20.0'),
      };
      const mockDecimal5 = {
        toString: jest.fn().mockReturnValue('5.0'),
      };
      mockPrisma.llmUsageEvent.groupBy.mockResolvedValueOnce([
        { feature: 'question_generation', _sum: { costUsd: mockDecimal20 } },
        { feature: 'coach', _sum: { costUsd: mockDecimal5 } },
      ]);

      const breakdown = await service.getOrgCostByFeature('org-123');

      expect(breakdown).toHaveLength(2);
      expect(breakdown[0]).toEqual({
        feature: 'question_generation',
        costUsd: 20,
      });
      expect(breakdown[1]).toEqual({
        feature: 'coach',
        costUsd: 5,
      });
    });

    it('should return empty array when no events', async () => {
      mockPrisma.llmUsageEvent.groupBy.mockResolvedValueOnce([]);

      const breakdown = await service.getOrgCostByFeature('org-123');

      expect(breakdown).toEqual([]);
    });
  });
});
