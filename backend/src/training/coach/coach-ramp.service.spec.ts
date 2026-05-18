import { Test, TestingModule } from '@nestjs/testing';
import { CoachRampService } from './coach-ramp.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmUsageService } from '../../ai-question-bank/llm-usage/llm-usage.service';
import { ConfigService } from '@nestjs/config';

describe('CoachRampService', () => {
  let service: CoachRampService;
  let prisma: PrismaService;
  let llmUsage: LlmUsageService;
  let config: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoachRampService,
        {
          provide: PrismaService,
          useValue: {
            coachSession: {
              findMany: jest.fn(),
            },
            user: {
              count: jest.fn(),
            },
          },
        },
        {
          provide: LlmUsageService,
          useValue: {
            getOrgDailyCost: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key, defaultValue) => {
              if (key === 'SPRINT_07_START_DATE') {
                return '2026-06-29';
              }
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CoachRampService>(CoachRampService);
    prisma = module.get<PrismaService>(PrismaService);
    llmUsage = module.get<LlmUsageService>(LlmUsageService);
    config = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('shouldRampUpCoach', () => {
    it('should return true when cost and error rate meet thresholds', async () => {
      const result = await service.shouldRampUpCoach(100, {
        costPerSession: 0.08,
        errorRate: 0.03,
      });

      expect(result).toBe(true);
    });

    it('should return false when cost exceeds threshold', async () => {
      const result = await service.shouldRampUpCoach(100, {
        costPerSession: 0.12,
        errorRate: 0.03,
      });

      expect(result).toBe(false);
    });

    it('should return false when error rate exceeds threshold', async () => {
      const result = await service.shouldRampUpCoach(100, {
        costPerSession: 0.08,
        errorRate: 0.07,
      });

      expect(result).toBe(false);
    });

    it('should return false when metrics are missing', async () => {
      const result = await service.shouldRampUpCoach(100, {});

      expect(result).toBe(false);
    });

    it('should allow cost exactly at threshold', async () => {
      const result = await service.shouldRampUpCoach(100, {
        costPerSession: 0.1,
        errorRate: 0.03,
      });

      expect(result).toBe(true);
    });

    it('should allow error rate exactly at threshold', async () => {
      const result = await service.shouldRampUpCoach(100, {
        costPerSession: 0.08,
        errorRate: 0.05,
      });

      expect(result).toBe(true);
    });
  });

  describe('getRampPercentage', () => {
    it('should return 0% before day 3', async () => {
      const day1 = new Date('2026-06-30'); // Day 1
      const percentage = await service.getRampPercentage(day1);
      expect(percentage).toBe(0);
    });

    it('should return 10% on day 3', async () => {
      const day3 = new Date('2026-07-02'); // Day 3
      const percentage = await service.getRampPercentage(day3);
      expect(percentage).toBe(10);
    });

    it('should return 25% on day 6', async () => {
      const day6 = new Date('2026-07-05'); // Day 6
      const percentage = await service.getRampPercentage(day6);
      expect(percentage).toBe(25);
    });

    it('should return 50% on day 9', async () => {
      const day9 = new Date('2026-07-08'); // Day 9
      const percentage = await service.getRampPercentage(day9);
      expect(percentage).toBe(50);
    });

    it('should return 100% on day 10', async () => {
      const day10 = new Date('2026-07-09'); // Day 10
      const percentage = await service.getRampPercentage(day10);
      expect(percentage).toBe(100);
    });
  });

  describe('getCoachMetrics', () => {
    it('should return zero metrics when no sessions exist', async () => {
      (prisma.coachSession.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      const metrics = await service.getCoachMetrics();

      expect(metrics.cohortSize).toBe(0);
      expect(metrics.costPerSession).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.optOutRate).toBe(0);
    });

    it('should calculate cost per session correctly', async () => {
      const sessions = [
        {
          id: 'session-1',
          status: 'completed',
          createdAt: new Date(),
          coachMessages: [],
        },
        {
          id: 'session-2',
          status: 'completed',
          createdAt: new Date(),
          coachMessages: [],
        },
      ];
      (prisma.coachSession.findMany as jest.Mock).mockResolvedValue(sessions);
      (llmUsage.getOrgDailyCost as jest.Mock).mockResolvedValue(0.16); // $0.16 total

      const metrics = await service.getCoachMetrics();

      expect(metrics.cohortSize).toBe(2);
      expect(metrics.costPerSession).toBe(0.08);
    });

    it('should calculate error rate correctly', async () => {
      const sessions = [
        {
          id: 'session-1',
          status: 'completed',
          createdAt: new Date(),
          coachMessages: [],
        },
        {
          id: 'session-2',
          status: 'error',
          createdAt: new Date(),
          coachMessages: [],
        },
        {
          id: 'session-3',
          status: 'error',
          createdAt: new Date(),
          coachMessages: [],
        },
      ];
      (prisma.coachSession.findMany as jest.Mock).mockResolvedValue(sessions);
      (llmUsage.getOrgDailyCost as jest.Mock).mockResolvedValue(0.2);

      const metrics = await service.getCoachMetrics();

      expect(metrics.errorRate).toBeCloseTo(2 / 3);
    });

    it('should calculate opt-out rate correctly', async () => {
      (prisma.coachSession.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'session-1',
          status: 'completed',
          createdAt: new Date(),
          coachMessages: [],
        },
      ]);
      (llmUsage.getOrgDailyCost as jest.Mock).mockResolvedValue(0.08);
      (prisma.user.count as jest.Mock)
        .mockResolvedValueOnce(20) // opt-out count
        .mockResolvedValueOnce(100); // total users

      const metrics = await service.getCoachMetrics();

      expect(metrics.optOutRate).toBe(0.2);
    });
  });

  describe('evaluateGate1', () => {
    it('should evaluate scenario quality gate', async () => {
      const result = await service.evaluateGate1({});

      expect(result.gate).toBe(1);
      expect(result.metric).toBe('scenario_accuracy');
      expect(result.threshold).toBe(0.6);
      expect(result.passed).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('evaluateGate2', () => {
    it('should pass when cost below threshold', async () => {
      const result = await service.evaluateGate2({
        costPerSession: 0.08,
      });

      expect(result.gate).toBe(2);
      expect(result.metric).toBe('cost_per_session');
      expect(result.passed).toBe(true);
      expect(result.actual).toBe(0.08);
    });

    it('should fail when cost exceeds threshold', async () => {
      const result = await service.evaluateGate2({
        costPerSession: 0.12,
      });

      expect(result.passed).toBe(false);
    });

    it('should handle missing cost metric', async () => {
      const result = await service.evaluateGate2({});

      expect(result.actual).toBe(0);
      expect(result.passed).toBe(true);
    });
  });

  describe('evaluateGate3', () => {
    it('should pass when opt-out rate below threshold', async () => {
      const result = await service.evaluateGate3({
        optOutRate: 0.03,
      });

      expect(result.gate).toBe(3);
      expect(result.metric).toBe('digest_opt_out_rate');
      expect(result.passed).toBe(true);
    });

    it('should fail when opt-out rate exceeds threshold', async () => {
      const result = await service.evaluateGate3({
        optOutRate: 0.08,
      });

      expect(result.passed).toBe(false);
    });

    it('should handle missing opt-out metric', async () => {
      const result = await service.evaluateGate3({});

      expect(result.actual).toBe(0);
      expect(result.passed).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should evaluate all gates for full ramp decision', async () => {
      const gate1 = await service.evaluateGate1({});
      const gate2 = await service.evaluateGate2({ costPerSession: 0.09 });
      const gate3 = await service.evaluateGate3({ optOutRate: 0.04 });

      expect(gate1.passed).toBe(true);
      expect(gate2.passed).toBe(true);
      expect(gate3.passed).toBe(true);
    });

    it('should handle mixed gate results', async () => {
      const gate1 = await service.evaluateGate1({});
      const gate2 = await service.evaluateGate2({ costPerSession: 0.12 });
      const gate3 = await service.evaluateGate3({ optOutRate: 0.04 });

      expect(gate1.passed).toBe(true);
      expect(gate2.passed).toBe(false);
      expect(gate3.passed).toBe(true);
    });
  });
});
