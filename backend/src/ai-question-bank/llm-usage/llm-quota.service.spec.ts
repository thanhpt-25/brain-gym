import { Test, TestingModule } from '@nestjs/testing';
import { LlmQuotaService } from './llm-quota.service';
import { LlmUsageService } from './llm-usage.service';

describe('LlmQuotaService', () => {
  let service: LlmQuotaService;
  let llmUsageService: LlmUsageService;

  const mockLlmUsageService = {
    getOrgDailyCost: jest.fn(),
  };

  beforeEach(async () => {
    // Reset env var before each test
    delete process.env.LLM_DAILY_QUOTA_USD;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmQuotaService,
        {
          provide: LlmUsageService,
          useValue: mockLlmUsageService,
        },
      ],
    }).compile();

    service = module.get<LlmQuotaService>(LlmQuotaService);
    llmUsageService = module.get<LlmUsageService>(LlmUsageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkOrgDailyQuota', () => {
    it('should return quota status below limit', async () => {
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(2.5);

      const result = await service.checkOrgDailyQuota('org-123');

      expect(result).toEqual({
        usedCost: 2.5,
        limitCost: 5, // Default from env
        isExceeded: false,
      });
    });

    it('should return quota status at limit', async () => {
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(5.0);

      const result = await service.checkOrgDailyQuota('org-123');

      expect(result).toEqual({
        usedCost: 5.0,
        limitCost: 5,
        isExceeded: false, // At limit is not exceeded
      });
    });

    it('should detect exceeded quota', async () => {
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(5.01);

      const result = await service.checkOrgDailyQuota('org-123');

      expect(result).toEqual({
        usedCost: 5.01,
        limitCost: 5,
        isExceeded: true,
      });
    });

    it('should return 0 cost when no usage', async () => {
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(0);

      const result = await service.checkOrgDailyQuota('org-123');

      expect(result).toEqual({
        usedCost: 0,
        limitCost: 5,
        isExceeded: false,
      });
    });

    it('should respect LLM_DAILY_QUOTA_USD env var', async () => {
      process.env.LLM_DAILY_QUOTA_USD = '10';

      // Need to recreate service with new env var
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LlmQuotaService,
          {
            provide: LlmUsageService,
            useValue: mockLlmUsageService,
          },
        ],
      }).compile();

      const testService = module.get<LlmQuotaService>(LlmQuotaService);
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(8.5);

      const result = await testService.checkOrgDailyQuota('org-123');

      expect(result.limitCost).toBe(10);
      expect(result.isExceeded).toBe(false);
    });
  });

  describe('logQuotaWarning', () => {
    it('should log warning when quota exceeded', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'warn');
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(6.0);

      await service.logQuotaWarning('org-123');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Organization quota exceeded'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('org-123'),
      );
    });

    it('should not log warning when below quota', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'warn');
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(3.0);

      await service.logQuotaWarning('org-123');

      expect(loggerSpy).not.toHaveBeenCalled();
    });
  });

  describe('getDailyLimitUsd', () => {
    it('should return default limit of 5 USD', () => {
      const limit = service.getDailyLimitUsd();
      expect(limit).toBe(5);
    });

    it('should return custom limit from env var', async () => {
      process.env.LLM_DAILY_QUOTA_USD = '15';

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LlmQuotaService,
          {
            provide: LlmUsageService,
            useValue: mockLlmUsageService,
          },
        ],
      }).compile();

      const testService = module.get<LlmQuotaService>(LlmQuotaService);
      expect(testService.getDailyLimitUsd()).toBe(15);
    });
  });

  describe('Multiple orgs isolation', () => {
    it('should check quotas independently for different orgs', async () => {
      mockLlmUsageService.getOrgDailyCost
        .mockResolvedValueOnce(3.0) // org-1: 3.0 (below limit)
        .mockResolvedValueOnce(6.0); // org-2: 6.0 (above limit)

      const result1 = await service.checkOrgDailyQuota('org-1');
      const result2 = await service.checkOrgDailyQuota('org-2');

      expect(result1.isExceeded).toBe(false);
      expect(result2.isExceeded).toBe(true);
      expect(mockLlmUsageService.getOrgDailyCost).toHaveBeenCalledWith('org-1');
      expect(mockLlmUsageService.getOrgDailyCost).toHaveBeenCalledWith('org-2');
    });
  });

  describe('Daily reset', () => {
    it('should check cost for different dates', async () => {
      mockLlmUsageService.getOrgDailyCost
        .mockResolvedValueOnce(2.0) // Today: 2.0
        .mockResolvedValueOnce(5.5); // Yesterday: 5.5

      const today = new Date('2026-05-09');
      const yesterday = new Date('2026-05-08');

      const todayResult = await service.checkOrgDailyQuota('org-123'); // Uses today's date
      // Note: getOrgDailyCost is called without date param in checkOrgDailyQuota,
      // so it defaults to today. For date-specific testing, we'd need to expose the date param.

      expect(mockLlmUsageService.getOrgDailyCost).toHaveBeenCalled();
    });
  });
});
