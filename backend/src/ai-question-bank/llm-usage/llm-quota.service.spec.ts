import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LlmQuotaService, QuotaExceededBody } from './llm-quota.service';
import { LlmUsageService } from './llm-usage.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('LlmQuotaService', () => {
  let service: LlmQuotaService;

  const mockLlmUsageService = {
    getOrgDailyCost: jest.fn(),
  };

  const mockPrismaService = {
    organization: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    delete process.env.LLM_DAILY_QUOTA_USD;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmQuotaService,
        { provide: LlmUsageService, useValue: mockLlmUsageService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<LlmQuotaService>(LlmQuotaService);
  });

  // ─── getOrgDailyCap ──────────────────────────────────────────────────────────

  describe('getOrgDailyCap', () => {
    it('returns per-org cap from DB when set', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValueOnce({
        llmDailyUsdCap: { toString: () => '20' },
      });

      const cap = await service.getOrgDailyCap('org-1');

      expect(cap).toBe(20);
    });

    it('falls back to env-var default when org has no cap', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValueOnce({
        llmDailyUsdCap: null,
      });

      const cap = await service.getOrgDailyCap('org-1');

      expect(cap).toBe(5); // default $5
    });

    it('falls back to env-var when org not found', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValueOnce(null);

      const cap = await service.getOrgDailyCap('org-missing');

      expect(cap).toBe(5);
    });

    it('respects LLM_DAILY_QUOTA_USD env var as fallback', async () => {
      process.env.LLM_DAILY_QUOTA_USD = '12';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LlmQuotaService,
          { provide: LlmUsageService, useValue: mockLlmUsageService },
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();
      const svc = module.get<LlmQuotaService>(LlmQuotaService);
      mockPrismaService.organization.findUnique.mockResolvedValueOnce(null);

      expect(await svc.getOrgDailyCap('org-1')).toBe(12);
    });
  });

  // ─── checkOrgDailyQuota ──────────────────────────────────────────────────────

  describe('checkOrgDailyQuota', () => {
    beforeEach(() => {
      mockPrismaService.organization.findUnique.mockResolvedValue({
        llmDailyUsdCap: null, // use env default $5
      });
    });

    it('returns not-exceeded when below limit', async () => {
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(2.5);

      const result = await service.checkOrgDailyQuota('org-1');

      expect(result).toEqual({
        usedCost: 2.5,
        limitCost: 5,
        isExceeded: false,
      });
    });

    it('returns not-exceeded at exactly the limit', async () => {
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(5.0);

      const result = await service.checkOrgDailyQuota('org-1');

      expect(result.isExceeded).toBe(false);
    });

    it('returns exceeded when over limit', async () => {
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(5.01);

      const result = await service.checkOrgDailyQuota('org-1');

      expect(result).toEqual({
        usedCost: 5.01,
        limitCost: 5,
        isExceeded: true,
      });
    });

    it('uses per-org cap from DB', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValueOnce({
        llmDailyUsdCap: { toString: () => '50' },
      });
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(30);

      const result = await service.checkOrgDailyQuota('org-big');

      expect(result).toEqual({
        usedCost: 30,
        limitCost: 50,
        isExceeded: false,
      });
    });
  });

  // ─── isNearQuota ─────────────────────────────────────────────────────────────

  describe('isNearQuota', () => {
    beforeEach(() => {
      mockPrismaService.organization.findUnique.mockResolvedValue({
        llmDailyUsdCap: null,
      });
    });

    it('returns true when usage is exactly at 80%', async () => {
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(4.0); // 80% of $5

      expect(await service.isNearQuota('org-1')).toBe(true);
    });

    it('returns true when usage is above 80%', async () => {
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(4.5); // 90% of $5

      expect(await service.isNearQuota('org-1')).toBe(true);
    });

    it('returns false when usage is below 80%', async () => {
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(3.9); // 78% of $5

      expect(await service.isNearQuota('org-1')).toBe(false);
    });

    it('supports custom threshold', async () => {
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(5.1); // >100%

      expect(await service.isNearQuota('org-1', 0.9)).toBe(true);
    });
  });

  // ─── enforceQuota ────────────────────────────────────────────────────────────

  describe('enforceQuota', () => {
    beforeEach(() => {
      mockPrismaService.organization.findUnique.mockResolvedValue({
        llmDailyUsdCap: null,
      });
    });

    it('does not throw when org is under quota', async () => {
      mockLlmUsageService.getOrgDailyCost.mockResolvedValue(2.0);

      await expect(service.enforceQuota('org-1')).resolves.toBeUndefined();
    });

    it('throws HTTP 429 with LLM_QUOTA_EXCEEDED body when over quota', async () => {
      mockLlmUsageService.getOrgDailyCost.mockResolvedValue(6.0);

      let caught: unknown;
      try {
        await service.enforceQuota('org-1');
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(HttpException);
      const httpErr = caught as HttpException;
      expect(httpErr.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);

      const body = httpErr.getResponse() as QuotaExceededBody;
      expect(body.code).toBe('LLM_QUOTA_EXCEEDED');
      expect(body.usedCost).toBe(6.0);
      expect(body.limitCost).toBe(5);
      expect(body.resetAt).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    });

    it('resetAt points to the next UTC midnight', async () => {
      mockLlmUsageService.getOrgDailyCost.mockResolvedValue(99.0);

      let caught: unknown;
      try {
        await service.enforceQuota('org-1');
      } catch (err) {
        caught = err;
      }

      const body = (caught as HttpException).getResponse() as QuotaExceededBody;
      const resetAt = new Date(body.resetAt);
      const now = new Date();

      expect(resetAt.getTime()).toBeGreaterThan(now.getTime());
      expect(resetAt.getUTCHours()).toBe(0);
      expect(resetAt.getUTCMinutes()).toBe(0);
      expect(resetAt.getUTCSeconds()).toBe(0);
    });

    it('emits llm_quota_near_cap log at 80% utilisation', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'warn');
      mockLlmUsageService.getOrgDailyCost.mockResolvedValue(4.0); // exactly 80% of $5

      await service.enforceQuota('org-1');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('llm_quota_near_cap'),
      );
    });

    it('does not emit near-quota log below 80%', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'warn');
      mockLlmUsageService.getOrgDailyCost.mockResolvedValue(3.0);

      await service.enforceQuota('org-1');

      expect(loggerSpy).not.toHaveBeenCalled();
    });

    it('blocks independently per org (org-a under, org-b over)', async () => {
      // org-a: 2.0 usage → under quota
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(2.0);
      await expect(service.enforceQuota('org-a')).resolves.toBeUndefined();

      // org-b: 6.0 usage → over quota
      mockLlmUsageService.getOrgDailyCost.mockResolvedValue(6.0);
      await expect(service.enforceQuota('org-b')).rejects.toThrow(
        HttpException,
      );
    });
  });

  // ─── logQuotaWarning (backward compat) ──────────────────────────────────────

  describe('logQuotaWarning', () => {
    beforeEach(() => {
      mockPrismaService.organization.findUnique.mockResolvedValue({
        llmDailyUsdCap: null,
      });
    });

    it('logs warning when quota exceeded', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'warn');
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(6.0);

      await service.logQuotaWarning('org-1');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Organization quota exceeded'),
      );
    });

    it('does not log when below quota', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'warn');
      mockLlmUsageService.getOrgDailyCost.mockResolvedValueOnce(3.0);

      await service.logQuotaWarning('org-1');

      expect(loggerSpy).not.toHaveBeenCalled();
    });
  });

  // ─── getDailyLimitUsd ────────────────────────────────────────────────────────

  describe('getDailyLimitUsd', () => {
    it('returns default $5 when env var not set', () => {
      expect(service.getDailyLimitUsd()).toBe(5);
    });
  });
});
