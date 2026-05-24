import { Test, TestingModule } from '@nestjs/testing';
import { DdsService } from './dds.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmUsageService } from '../llm-usage/llm-usage.service';
import { LlmQuotaService } from '../llm-usage/llm-quota.service';

const mockLlmUsage = { logUsage: jest.fn().mockResolvedValue(undefined) };
const mockQuota = { enforceQuota: jest.fn().mockResolvedValue(undefined) };

describe('DdsService — auto-apply & quota (US-1003/1004)', () => {
  let service: DdsService;
  let mockPrisma: any;

  beforeEach(async () => {
    // Recreate mock object fresh in each test to ensure proper jest.fn() setup
    mockPrisma = {
      question: { findUnique: jest.fn(), update: jest.fn() },
      questionVariant: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      choice: { deleteMany: jest.fn(), createMany: jest.fn() },
      llmUsageLog: { create: jest.fn() },
      ddsConfig: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    delete process.env.DDS_AUTO_APPLY_ENABLED;
    delete process.env.DDS_AUTO_APPLY_THRESHOLD;
    delete process.env.DDS_SHADOW_MODE;

    // Setup default ddsConfig mocks — dynamically respond to env vars
    // When DDS_SHADOW_MODE='false', mock returns shadowModeEnabled=false (live mode)
    // Otherwise returns null to allow in-memory fallback
    mockPrisma.ddsConfig.findUnique.mockImplementation((query) => {
      if (process.env.DDS_SHADOW_MODE === 'false') {
        return {
          cohortName: 'default',
          shadowModeEnabled: false,
          canaryArmed: true,
          promotedAt: null,
        };
      }
      // Return null to allow in-memory fallback for env-var-driven tests
      return null;
    });

    mockPrisma.ddsConfig.upsert.mockResolvedValue({
      cohortName: 'default',
      shadowModeEnabled: false,
      canaryArmed: true,
      promotedAt: null,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DdsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LlmUsageService, useValue: mockLlmUsage },
        { provide: LlmQuotaService, useValue: mockQuota },
      ],
    }).compile();

    service = module.get(DdsService);
  });

  describe('evaluateAutoApply (US-1003)', () => {
    it('returns shouldApply=false when feature flag is disabled', async () => {
      process.env.DDS_AUTO_APPLY_ENABLED = 'false';
      mockPrisma.questionVariant.findUnique.mockResolvedValue({
        id: 'var-1',
        questionId: 'q-1',
        status: 'PENDING',
      });

      const result = await service.evaluateAutoApply('var-1');

      expect(result.shouldApply).toBe(false);
      expect(result.reason).toMatch(/disabled/i);
    });

    it('returns shouldApply=true when approved count meets threshold', async () => {
      process.env.DDS_AUTO_APPLY_ENABLED = 'true';
      process.env.DDS_AUTO_APPLY_THRESHOLD = '2';
      mockPrisma.questionVariant.findUnique.mockResolvedValue({
        id: 'var-1',
        questionId: 'q-1',
        status: 'PENDING',
      });
      mockPrisma.questionVariant.findMany.mockResolvedValue([
        { id: 'var-2', status: 'APPROVED' },
        { id: 'var-3', status: 'APPROVED' },
      ]);

      const result = await service.evaluateAutoApply('var-1');

      expect(result.shouldApply).toBe(true);
      expect(result.approvedCount).toBeGreaterThanOrEqual(2);
    });

    it('returns shouldApply=false when approved count is below threshold', async () => {
      process.env.DDS_AUTO_APPLY_ENABLED = 'true';
      process.env.DDS_AUTO_APPLY_THRESHOLD = '5';
      mockPrisma.questionVariant.findUnique.mockResolvedValue({
        id: 'var-1',
        questionId: 'q-1',
        status: 'PENDING',
      });
      mockPrisma.questionVariant.findMany.mockResolvedValue([
        { id: 'var-2', status: 'APPROVED' },
      ]);

      const result = await service.evaluateAutoApply('var-1');

      expect(result.shouldApply).toBe(false);
      expect(result.approvedCount).toBe(1);
    });
  });

  describe('tryAutoApply (US-1004)', () => {
    it('shadow mode: logs decision without committing when DDS_SHADOW_MODE is not "false"', async () => {
      process.env.DDS_AUTO_APPLY_ENABLED = 'true';
      process.env.DDS_AUTO_APPLY_THRESHOLD = '1';
      mockPrisma.questionVariant.findUnique.mockResolvedValue({
        id: 'var-1',
        questionId: 'q-1',
        status: 'PENDING',
      });
      mockPrisma.questionVariant.findMany.mockResolvedValue([
        { id: 'var-2', status: 'APPROVED' },
      ]);

      const result = await service.tryAutoApply('var-1');

      expect(result).toMatchObject({ shadowMode: true });
      expect(mockPrisma.questionVariant.update).not.toHaveBeenCalled();
    });

    it('applies variant when DDS_SHADOW_MODE=false and threshold is met', async () => {
      process.env.DDS_AUTO_APPLY_ENABLED = 'true';
      process.env.DDS_AUTO_APPLY_THRESHOLD = '1';
      process.env.DDS_SHADOW_MODE = 'false';
      const variantWithDiff = {
        id: 'var-1',
        questionId: 'q-1',
        status: 'PENDING',
        diff: {
          revisedChoices: [{ label: 'A', content: 'yes', isCorrect: true }],
        },
      };
      mockPrisma.questionVariant.findUnique.mockResolvedValue(variantWithDiff);
      mockPrisma.questionVariant.findUniqueOrThrow.mockResolvedValue({
        ...variantWithDiff,
        status: 'APPROVED',
        reviewedBy: 'auto',
      });
      mockPrisma.questionVariant.findMany.mockResolvedValue([
        { id: 'var-2', status: 'APPROVED' },
      ]);
      mockPrisma.$transaction.mockImplementation((fn) => fn(mockPrisma));
      mockPrisma.choice.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.choice.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.questionVariant.update.mockResolvedValue({
        id: 'var-1',
        status: 'APPROVED',
        reviewedBy: 'auto',
        diff: {},
      });
      mockPrisma.question.update.mockResolvedValue({ id: 'q-1' });

      await service.tryAutoApply('var-1');

      expect(mockPrisma.questionVariant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'var-1' },
          data: expect.objectContaining({ reviewedBy: 'auto' }),
        }),
      );
    });
  });

  describe('proposeVariant quota guard (US-1003)', () => {
    it('calls enforceQuota with orgId before the LLM call', async () => {
      const orgId = 'org-1';
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 'q-1',
        stem: 'Which of the following…',
        choices: [],
        explanation: 'Because…',
        certificationId: 'cert-1',
      });
      mockQuota.enforceQuota.mockRejectedValueOnce(new Error('quota exceeded'));

      await expect(
        service.proposeVariant('q-1', 'DDS_HARDEN' as any, 'user-1', orgId),
      ).rejects.toThrow('quota exceeded');

      expect(mockQuota.enforceQuota).toHaveBeenCalledWith(orgId);
    });
  });
});
