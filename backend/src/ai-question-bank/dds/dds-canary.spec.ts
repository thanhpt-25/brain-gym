import { Test, TestingModule } from '@nestjs/testing';
import { DdsService } from './dds.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmUsageService } from '../llm-usage/llm-usage.service';
import { LlmQuotaService } from '../llm-usage/llm-quota.service';
import { DdsVariantStatus } from '@prisma/client';

const mockPrisma = {
  question: { findUnique: jest.fn(), update: jest.fn() },
  questionVariant: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
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

const mockLlmUsage = { logUsage: jest.fn().mockResolvedValue(undefined) };
const mockQuota = { enforceQuota: jest.fn().mockResolvedValue(undefined) };

describe('DdsService — canary auto-pause & Gate2 readiness (US-1101/US-1107)', () => {
  let service: DdsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    delete process.env.DDS_AUTO_APPLY_ENABLED;
    delete process.env.DDS_AUTO_APPLY_THRESHOLD;
    delete process.env.DDS_SHADOW_MODE;
    delete process.env.DDS_CANARY_WINDOW_SIZE;
    delete process.env.DDS_CANARY_ROLLBACK_RATE_THRESHOLD;

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

  // ─── getAutoApplyReadiness (US-1107) ──────────────────────────────────────

  describe('getAutoApplyReadiness (US-1107)', () => {
    beforeEach(() => {
      // No promotedAt yet → since=null → all-time counts (pre-GA behaviour)
      mockPrisma.ddsConfig.findUnique.mockResolvedValue(null);
    });

    it('returns readyToPromote=true when approvals meet threshold and zero rollbacks', async () => {
      process.env.DDS_AUTO_APPLY_THRESHOLD = '3';
      mockPrisma.questionVariant.count
        .mockResolvedValueOnce(5) // APPROVED count
        .mockResolvedValueOnce(0); // ROLLED_BACK count
      mockPrisma.questionVariant.findFirst.mockResolvedValue(null);

      const result = await service.getAutoApplyReadiness();

      expect(result.cleanApprovals).toBe(5);
      expect(result.rollbackCount).toBe(0);
      expect(result.threshold).toBe(3);
      expect(result.readyToPromote).toBe(true);
      expect(result.lastRollbackAt).toBeNull();
    });

    it('returns readyToPromote=false when rollbacks exist', async () => {
      process.env.DDS_AUTO_APPLY_THRESHOLD = '3';
      mockPrisma.questionVariant.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2);
      mockPrisma.questionVariant.findFirst.mockResolvedValue({
        reviewedAt: new Date('2026-06-01'),
      });

      const result = await service.getAutoApplyReadiness();

      expect(result.rollbackCount).toBe(2);
      expect(result.readyToPromote).toBe(false);
      expect(result.lastRollbackAt).toEqual(new Date('2026-06-01'));
    });

    it('returns readyToPromote=false when approvals are below threshold', async () => {
      process.env.DDS_AUTO_APPLY_THRESHOLD = '30';
      mockPrisma.questionVariant.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(0);
      mockPrisma.questionVariant.findFirst.mockResolvedValue(null);

      const result = await service.getAutoApplyReadiness();

      expect(result.cleanApprovals).toBe(5);
      expect(result.threshold).toBe(30);
      expect(result.readyToPromote).toBe(false);
    });

    it('correctly calculates progress percentage', async () => {
      process.env.DDS_AUTO_APPLY_THRESHOLD = '10';
      mockPrisma.questionVariant.count
        .mockResolvedValueOnce(7) // 7/10 = 70%
        .mockResolvedValueOnce(0);
      mockPrisma.questionVariant.findFirst.mockResolvedValue(null);

      const result = await service.getAutoApplyReadiness();

      expect(result.cleanApprovals).toBe(7);
      expect(result.threshold).toBe(10);
      // Note: progressPercent is calculated in the controller, not the service
      // This test verifies the raw data is correct for controller to calculate
    });

    it('returns all-zero readiness when no variants exist', async () => {
      process.env.DDS_AUTO_APPLY_THRESHOLD = '30';
      mockPrisma.questionVariant.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.questionVariant.findFirst.mockResolvedValue(null);

      const result = await service.getAutoApplyReadiness();

      expect(result.cleanApprovals).toBe(0);
      expect(result.rollbackCount).toBe(0);
      expect(result.readyToPromote).toBe(false);
      expect(result.lastRollbackAt).toBeNull();
      expect(result.since).toBeNull();
    });

    it('scopes counts to since-promotedAt when cohort has been promoted (S12)', async () => {
      process.env.DDS_AUTO_APPLY_THRESHOLD = '3';
      const promotedAt = new Date('2026-07-08T00:00:00Z');

      // Override the beforeEach mock: cohort has a promotedAt
      mockPrisma.ddsConfig.findUnique.mockResolvedValue({
        cohortName: 'default',
        shadowModeEnabled: false,
        canaryArmed: true,
        promotedAt,
        canaryPausedAt: null,
        canaryAutoResumeAt: null,
      });

      mockPrisma.questionVariant.count
        .mockResolvedValueOnce(5) // approved since promotedAt
        .mockResolvedValueOnce(0); // rolled back since promotedAt
      mockPrisma.questionVariant.findFirst.mockResolvedValue(null);

      const result = await service.getAutoApplyReadiness();

      expect(result.since).toEqual(promotedAt);
      expect(result.cleanApprovals).toBe(5);
      expect(result.readyToPromote).toBe(true);

      // Verify the queries used the since filter
      const countCalls = mockPrisma.questionVariant.count.mock.calls;
      expect(countCalls[0][0].where.reviewedAt).toEqual({ gte: promotedAt });
      expect(countCalls[1][0].where.reviewedAt).toEqual({ gte: promotedAt });
    });
  });

  // ─── canary auto-pause (US-1101) ─────────────────────────────────────────

  describe('tryAutoApply — canary auto-pause (US-1101)', () => {
    it('pauses and reverts to shadow when rollback rate exceeds threshold', async () => {
      process.env.DDS_AUTO_APPLY_ENABLED = 'true';
      process.env.DDS_AUTO_APPLY_THRESHOLD = '1';
      process.env.DDS_SHADOW_MODE = 'false';
      process.env.DDS_CANARY_WINDOW_SIZE = '10';
      process.env.DDS_CANARY_ROLLBACK_RATE_THRESHOLD = '0.2';

      // 4 out of 10 rolled back = 40% > 20% threshold → canary fires
      mockPrisma.questionVariant.findMany
        .mockResolvedValueOnce(
          Array.from({ length: 10 }, (_, i) => ({
            id: `var-${i}`,
            status:
              i < 4 ? DdsVariantStatus.ROLLED_BACK : DdsVariantStatus.APPROVED,
          })),
        )
        .mockResolvedValueOnce([{ id: 'var-approved' }]); // evaluateAutoApply

      mockPrisma.questionVariant.findUnique.mockResolvedValue({
        id: 'var-pending',
        questionId: 'q-1',
        status: DdsVariantStatus.PENDING,
      });

      const result = await service.tryAutoApply('var-pending');

      expect(result.canaryPaused).toBe(true);
      expect(result.shadowMode).toBe(true);
      expect(result.applied).toBe(false);
      // env var is no longer mutated to 'true' — shadow state lives in DB config only
      expect(process.env.DDS_SHADOW_MODE).not.toBe('true');
    });

    it('does not pause when rollback rate is within threshold', async () => {
      process.env.DDS_AUTO_APPLY_ENABLED = 'true';
      // Threshold=5 but only 1 approved → shouldApply=false, so approve() is never called
      process.env.DDS_AUTO_APPLY_THRESHOLD = '5';
      process.env.DDS_SHADOW_MODE = 'false';
      process.env.DDS_CANARY_WINDOW_SIZE = '10';
      process.env.DDS_CANARY_ROLLBACK_RATE_THRESHOLD = '0.2';

      // 1 out of 10 = 10% < 20% → canary is safe
      mockPrisma.questionVariant.findMany
        .mockResolvedValueOnce(
          Array.from({ length: 10 }, (_, i) => ({
            id: `var-${i}`,
            status:
              i === 0
                ? DdsVariantStatus.ROLLED_BACK
                : DdsVariantStatus.APPROVED,
          })),
        )
        .mockResolvedValueOnce([{ id: 'var-approved' }]); // evaluateAutoApply: 1 < 5 → no apply

      mockPrisma.questionVariant.findUnique.mockResolvedValue({
        id: 'var-pending',
        questionId: 'q-1',
        status: DdsVariantStatus.PENDING,
      });

      const result = await service.tryAutoApply('var-pending');

      expect(result.canaryPaused).toBeUndefined();
      expect(result.applied).toBe(false); // below threshold, not applied
    });

    it('skips canary check entirely when already in shadow mode', async () => {
      process.env.DDS_AUTO_APPLY_ENABLED = 'true';
      process.env.DDS_AUTO_APPLY_THRESHOLD = '1';
      // DDS_SHADOW_MODE not set → defaults to shadow mode

      mockPrisma.questionVariant.findUnique.mockResolvedValue({
        id: 'var-1',
        questionId: 'q-1',
        status: DdsVariantStatus.PENDING,
      });
      mockPrisma.questionVariant.findMany.mockResolvedValue([
        { id: 'var-approved' },
      ]);

      const result = await service.tryAutoApply('var-1');

      expect(result.shadowMode).toBe(true);
      expect(result.applied).toBe(false);
      // No call with reviewedBy='auto' filter (that's the canary check)
      const canaryCall = mockPrisma.questionVariant.findMany.mock.calls.find(
        (args) => args[0]?.where?.reviewedBy === 'auto',
      );
      expect(canaryCall).toBeUndefined();
    });

    it('applies variant when canary window is empty (no rollback data)', async () => {
      process.env.DDS_AUTO_APPLY_ENABLED = 'true';
      process.env.DDS_AUTO_APPLY_THRESHOLD = '1';
      process.env.DDS_SHADOW_MODE = 'false';

      const variantWithDiff = {
        id: 'var-1',
        questionId: 'q-1',
        status: DdsVariantStatus.PENDING,
        diff: {
          revisedChoices: [{ label: 'A', content: 'x', isCorrect: true }],
        },
      };

      mockPrisma.questionVariant.findMany
        .mockResolvedValueOnce([]) // canary window empty → safe
        .mockResolvedValueOnce([{ id: 'v' }]); // evaluateAutoApply approved count

      mockPrisma.questionVariant.findUnique.mockResolvedValue(variantWithDiff);
      mockPrisma.$transaction.mockImplementation((fn) => fn(mockPrisma));
      mockPrisma.choice.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.choice.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.questionVariant.update.mockResolvedValue({
        id: 'var-1',
        status: DdsVariantStatus.APPROVED,
        reviewedBy: 'auto',
      });
      mockPrisma.questionVariant.findUniqueOrThrow.mockResolvedValue({
        id: 'var-1',
        questionId: 'q-1',
        reason: 'DDS_HARDEN',
        status: DdsVariantStatus.APPROVED,
        diff: {},
        reviewedBy: 'auto',
        reviewedAt: new Date(),
        reviewNote: null,
        createdAt: new Date(),
      });
      mockPrisma.question.update.mockResolvedValue({ id: 'q-1' });

      const result = await service.tryAutoApply('var-1');

      expect(result.canaryPaused).toBeUndefined();
      expect(result.applied).toBe(true);
      expect(result.shadowMode).toBe(false);
    });
  });

  // ─── getCohortConfig (US-1101) ───────────────────────────────────────────

  describe('getCohortConfig (US-1101)', () => {
    it('returns cohort config from database when it exists', async () => {
      const cohortConfig = {
        cohortName: 'default',
        shadowModeEnabled: true,
        canaryArmed: false,
        promotedAt: new Date('2026-06-15'),
        canaryPausedAt: null,
      };

      mockPrisma.ddsConfig.findUnique.mockResolvedValue(cohortConfig);

      const result = await service.getCohortConfig('default');

      expect(result).toEqual(cohortConfig);
      expect(mockPrisma.ddsConfig.findUnique).toHaveBeenCalledWith({
        where: { cohortName: 'default' },
      });
    });

    it('returns null when cohort config does not exist', async () => {
      mockPrisma.ddsConfig.findUnique.mockResolvedValue(null);

      const result = await service.getCohortConfig('nonexistent');

      expect(result).toBeNull();
    });

    it('shows canary as Armed when canaryArmed=true', async () => {
      mockPrisma.ddsConfig.findUnique.mockResolvedValue({
        cohortName: 'beta',
        shadowModeEnabled: false,
        canaryArmed: true,
        promotedAt: new Date('2026-06-10'),
        canaryPausedAt: null,
      });

      const result = await service.getCohortConfig('beta');

      expect(result.canaryArmed).toBe(true);
    });

    it('shows canary as Paused when canaryPausedAt is set', async () => {
      mockPrisma.ddsConfig.findUnique.mockResolvedValue({
        cohortName: 'beta',
        shadowModeEnabled: true,
        canaryArmed: false,
        promotedAt: new Date('2026-06-10'),
        canaryPausedAt: new Date('2026-06-12'),
      });

      const result = await service.getCohortConfig('beta');

      expect(result.canaryPausedAt).not.toBeNull();
      expect(result.canaryArmed).toBe(false);
    });
  });

  // ─── promoteCohortToLive (US-1101) ───────────────────────────────────────

  describe('promoteCohortToLive (US-1101)', () => {
    it('promotes cohort to live when Gate 2 readiness is met', async () => {
      process.env.DDS_AUTO_APPLY_THRESHOLD = '30';

      // Mock Gate 2 checks
      mockPrisma.questionVariant.count
        .mockResolvedValueOnce(35) // APPROVED count >= 30
        .mockResolvedValueOnce(0); // ROLLED_BACK count = 0
      mockPrisma.questionVariant.findFirst.mockResolvedValue(null); // no last rollback

      // Mock getCohortConfig — cohort doesn't exist yet
      mockPrisma.ddsConfig.findUnique.mockResolvedValue(null);

      // Mock upsert to create/update config
      const promotedConfig = {
        id: 'new-id',
        cohortName: 'default',
        shadowModeEnabled: false,
        canaryArmed: true,
        promotedAt: new Date(),
        promotedBy: 'admin-user-123',
      };
      mockPrisma.ddsConfig.upsert.mockResolvedValue(promotedConfig);

      const result = await service.promoteCohortToLive(
        'default',
        'admin-user-123',
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.ddsConfig.upsert).toHaveBeenCalledWith({
        where: { cohortName: 'default' },
        update: expect.objectContaining({
          shadowModeEnabled: false,
          canaryArmed: true,
          promotedAt: expect.any(Date),
          promotedBy: 'admin-user-123',
        }),
        create: expect.objectContaining({
          cohortName: 'default',
          shadowModeEnabled: false,
          canaryArmed: true,
          promotedBy: 'admin-user-123',
        }),
      });
    });

    it('rejects promotion when rollbacks exist', async () => {
      process.env.DDS_AUTO_APPLY_THRESHOLD = '30';

      // Gate 2 check: approvals OK but rollbacks exist
      mockPrisma.questionVariant.count
        .mockResolvedValueOnce(35)
        .mockResolvedValueOnce(2); // Rollback count = 2, not 0
      mockPrisma.questionVariant.findFirst.mockResolvedValue({
        reviewedAt: new Date('2026-06-10'),
      });

      const result = await service.promoteCohortToLive(
        'default',
        'admin-user-123',
      );

      expect(result.success).toBe(false);
      expect(result.reason).toContain('rollback');
      expect(mockPrisma.ddsConfig.upsert).not.toHaveBeenCalled();
    });

    it('rejects promotion when approvals below threshold', async () => {
      process.env.DDS_AUTO_APPLY_THRESHOLD = '30';

      // Gate 2 check: only 10 approvals, need 30
      mockPrisma.questionVariant.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(0);
      mockPrisma.questionVariant.findFirst.mockResolvedValue(null);

      const result = await service.promoteCohortToLive(
        'default',
        'admin-user-123',
      );

      expect(result.success).toBe(false);
      expect(result.reason).toContain('approval');
      expect(mockPrisma.ddsConfig.upsert).not.toHaveBeenCalled();
    });

    it('rejects promotion when cohort is already promoted', async () => {
      process.env.DDS_AUTO_APPLY_THRESHOLD = '30';

      // Mock readiness passes
      mockPrisma.questionVariant.count
        .mockResolvedValueOnce(35)
        .mockResolvedValueOnce(0);
      mockPrisma.questionVariant.findFirst.mockResolvedValue(null);

      // Mock getCohortConfig — cohort already promoted
      mockPrisma.ddsConfig.findUnique.mockResolvedValue({
        cohortName: 'default',
        shadowModeEnabled: false,
        canaryArmed: true,
        promotedAt: new Date('2026-06-10'),
        promotedBy: 'admin-user-123',
      });

      const result = await service.promoteCohortToLive(
        'default',
        'admin-user-456',
      );

      expect(result.success).toBe(false);
      expect(result.reason).toContain('already');
      expect(mockPrisma.ddsConfig.upsert).not.toHaveBeenCalled();
    });

    it('handles database errors gracefully', async () => {
      mockPrisma.questionVariant.count.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        service.promoteCohortToLive('default', 'admin-user-123'),
      ).rejects.toThrow('Database connection failed');
    });
  });

  // ─── tryAutoApply with cohort config (US-1101) ──────────────────────────

  describe('tryAutoApply — reading shadowMode from DdsConfig (US-1101)', () => {
    it('reads shadowModeEnabled from database instead of env var only', async () => {
      process.env.DDS_AUTO_APPLY_ENABLED = 'true';
      process.env.DDS_AUTO_APPLY_THRESHOLD = '1';
      // Note: not setting DDS_SHADOW_MODE env var
      // Instead, database has shadowModeEnabled=true

      mockPrisma.ddsConfig.findUnique.mockResolvedValue({
        cohortName: 'default',
        shadowModeEnabled: true, // ← DB says shadow mode ON
        canaryArmed: false,
        promotedAt: null,
        canaryPausedAt: null,
      });

      mockPrisma.questionVariant.findUnique.mockResolvedValue({
        id: 'var-1',
        questionId: 'q-1',
        status: DdsVariantStatus.PENDING,
      });
      mockPrisma.questionVariant.findMany.mockResolvedValue([
        { id: 'var-approved' },
      ]);

      const result = await service.tryAutoApply('var-1');

      expect(result.shadowMode).toBe(true);
      expect(mockPrisma.ddsConfig.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ cohortName: 'default' }),
        }),
      );
    });

    it('prefers database config over env var when both exist', async () => {
      process.env.DDS_AUTO_APPLY_ENABLED = 'true';
      process.env.DDS_AUTO_APPLY_THRESHOLD = '1';
      process.env.DDS_SHADOW_MODE = 'false'; // Env says OFF

      mockPrisma.ddsConfig.findUnique.mockResolvedValue({
        cohortName: 'default',
        shadowModeEnabled: true, // DB says ON (takes precedence)
        canaryArmed: false,
        promotedAt: null,
        canaryPausedAt: null,
      });

      mockPrisma.questionVariant.findUnique.mockResolvedValue({
        id: 'var-1',
        questionId: 'q-1',
        status: DdsVariantStatus.PENDING,
      });
      mockPrisma.questionVariant.findMany.mockResolvedValue([
        { id: 'var-approved' },
      ]);

      const result = await service.tryAutoApply('var-1');

      expect(result.shadowMode).toBe(true); // DB config wins
    });

    it('updates canaryPausedAt in database when canary pauses', async () => {
      process.env.DDS_AUTO_APPLY_ENABLED = 'true';
      process.env.DDS_AUTO_APPLY_THRESHOLD = '1';
      process.env.DDS_CANARY_WINDOW_SIZE = '10';
      process.env.DDS_CANARY_ROLLBACK_RATE_THRESHOLD = '0.2';

      // Initial config: not in shadow mode, canary armed
      mockPrisma.ddsConfig.findUnique.mockResolvedValue({
        cohortName: 'default',
        shadowModeEnabled: false,
        canaryArmed: true,
        promotedAt: new Date('2026-06-10'),
        canaryPausedAt: null,
      });

      // Canary check: 40% rollbacks > 20% threshold → trigger pause
      mockPrisma.questionVariant.findMany
        .mockResolvedValueOnce(
          Array.from({ length: 10 }, (_, i) => ({
            id: `var-${i}`,
            status:
              i < 4 ? DdsVariantStatus.ROLLED_BACK : DdsVariantStatus.APPROVED,
          })),
        )
        .mockResolvedValueOnce([{ id: 'var-approved' }]);

      mockPrisma.questionVariant.findUnique.mockResolvedValue({
        id: 'var-pending',
        questionId: 'q-1',
        status: DdsVariantStatus.PENDING,
      });

      mockPrisma.ddsConfig.update.mockResolvedValue({
        cohortName: 'default',
        shadowModeEnabled: true,
        canaryArmed: false,
        promotedAt: new Date('2026-06-10'),
        canaryPausedAt: expect.any(Date),
      });

      const result = await service.tryAutoApply('var-pending');

      expect(result.canaryPaused).toBe(true);
      expect(result.shadowMode).toBe(true);
      expect(mockPrisma.ddsConfig.update).toHaveBeenCalledWith({
        where: { cohortName: 'default' },
        data: expect.objectContaining({
          shadowModeEnabled: true,
          canaryArmed: false,
          canaryPausedAt: expect.any(Date),
          canaryAutoResumeAt: expect.any(Date),
        }),
      });
    });
  });

  // ─── canary auto-resume (S12) ────────────────────────────────────────────

  describe('tryAutoApply — canary auto-resume (S12)', () => {
    it('re-arms canary and exits shadow mode when cooldown has elapsed', async () => {
      process.env.DDS_AUTO_APPLY_ENABLED = 'true';
      process.env.DDS_AUTO_APPLY_THRESHOLD = '1';
      process.env.DDS_CANARY_COOLDOWN_MS = '1800000';

      const pausedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const resumeAt = new Date(Date.now() - 30 * 60 * 1000); // resume was 30 min ago

      mockPrisma.ddsConfig.findUnique.mockResolvedValue({
        id: 'real-config',
        cohortName: 'default',
        shadowModeEnabled: true,
        canaryArmed: false,
        promotedAt: new Date('2026-06-10'),
        canaryPausedAt: pausedAt,
        canaryAutoResumeAt: resumeAt,
      });

      // After re-arm, canary check passes (empty window) and variant applies
      mockPrisma.ddsConfig.update.mockResolvedValue({});
      mockPrisma.questionVariant.findMany
        .mockResolvedValueOnce([]) // canary window empty
        .mockResolvedValueOnce([{ id: 'approved' }]); // approved count for threshold

      // Gate 2 guard at apply time: approvals >= threshold, zero rollbacks.
      mockPrisma.questionVariant.count
        .mockResolvedValueOnce(1) // APPROVED count
        .mockResolvedValueOnce(0); // ROLLED_BACK count
      mockPrisma.questionVariant.findFirst.mockResolvedValue(null);

      const variantWithDiff = {
        id: 'var-resume',
        questionId: 'q-1',
        status: 'PENDING',
        diff: {
          revisedChoices: [{ label: 'A', content: 'x', isCorrect: true }],
        },
      };
      mockPrisma.questionVariant.findUnique.mockResolvedValue(variantWithDiff);
      mockPrisma.$transaction.mockImplementation((fn) => fn(mockPrisma));
      mockPrisma.choice.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.choice.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.questionVariant.update.mockResolvedValue({
        id: 'var-resume',
        status: 'APPROVED',
        reviewedBy: 'auto',
      });
      mockPrisma.questionVariant.findUniqueOrThrow.mockResolvedValue({
        id: 'var-resume',
        questionId: 'q-1',
        reason: 'DDS_HARDEN',
        status: 'APPROVED',
        diff: {},
        reviewedBy: 'auto',
        reviewedAt: new Date(),
        reviewNote: null,
        createdAt: new Date(),
      });
      mockPrisma.question.update.mockResolvedValue({ id: 'q-1' });

      const result = await service.tryAutoApply('var-resume');

      // Should have re-armed in DB
      expect(mockPrisma.ddsConfig.update).toHaveBeenCalledWith({
        where: { cohortName: 'default' },
        data: {
          shadowModeEnabled: false,
          canaryArmed: true,
          canaryPausedAt: null,
          canaryAutoResumeAt: null,
        },
      });
      expect(result.shadowMode).toBe(false);
      expect(result.applied).toBe(true);
    });

    it('stays in shadow mode when cooldown has NOT elapsed', async () => {
      process.env.DDS_AUTO_APPLY_ENABLED = 'true';
      process.env.DDS_AUTO_APPLY_THRESHOLD = '1';
      process.env.DDS_CANARY_COOLDOWN_MS = '1800000';

      const pausedAt = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
      const resumeAt = new Date(Date.now() + 25 * 60 * 1000); // resume in 25 min (future)

      mockPrisma.ddsConfig.findUnique.mockResolvedValue({
        id: 'real-config',
        cohortName: 'default',
        shadowModeEnabled: true,
        canaryArmed: false,
        promotedAt: new Date('2026-06-10'),
        canaryPausedAt: pausedAt,
        canaryAutoResumeAt: resumeAt,
      });

      mockPrisma.questionVariant.findUnique.mockResolvedValue({
        id: 'var-1',
        questionId: 'q-1',
        status: 'PENDING',
      });
      mockPrisma.questionVariant.findMany.mockResolvedValue([
        { id: 'approved' },
      ]);

      const result = await service.tryAutoApply('var-1');

      // DB update for re-arm should NOT have been called
      const reArmCall = mockPrisma.ddsConfig.update.mock.calls.find(
        (args) => args[0]?.data?.canaryArmed === true,
      );
      expect(reArmCall).toBeUndefined();
      expect(result.shadowMode).toBe(true);
      expect(result.applied).toBe(false);
    });

    it('skips auto-resume when canaryAutoResumeAt is null (manually paused)', async () => {
      process.env.DDS_AUTO_APPLY_ENABLED = 'true';
      process.env.DDS_AUTO_APPLY_THRESHOLD = '1';

      mockPrisma.ddsConfig.findUnique.mockResolvedValue({
        id: 'real-config',
        cohortName: 'default',
        shadowModeEnabled: true,
        canaryArmed: false,
        promotedAt: null,
        canaryPausedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        canaryAutoResumeAt: null, // no auto-resume scheduled
      });

      mockPrisma.questionVariant.findUnique.mockResolvedValue({
        id: 'var-1',
        questionId: 'q-1',
        status: 'PENDING',
      });
      mockPrisma.questionVariant.findMany.mockResolvedValue([
        { id: 'approved' },
      ]);

      const result = await service.tryAutoApply('var-1');

      expect(result.shadowMode).toBe(true);
      expect(result.applied).toBe(false);
      expect(mockPrisma.ddsConfig.update).not.toHaveBeenCalled();
    });
  });
});
