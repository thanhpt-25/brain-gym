import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmUsageService } from '../llm-usage/llm-usage.service';
import { LlmQuotaService } from '../llm-usage/llm-quota.service';
import { llmClient } from '../llm/llm-client';
import { DdsReason, DdsVariantStatus } from '@prisma/client';

export interface QuestionVariantDto {
  id: string;
  questionId: string;
  reason: DdsReason;
  status: DdsVariantStatus;
  diff: {
    originalChoices: Array<{
      label: string;
      content: string;
      isCorrect: boolean;
    }>;
    revisedChoices: Array<{
      label: string;
      content: string;
      isCorrect: boolean;
    }>;
  };
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdAt: Date;
}

/** US-1003: Result of evaluating whether a variant should auto-apply. */
export interface AutoApplyDecision {
  shouldApply: boolean;
  reason: string;
  cohort: string;
  approvedCount: number;
  threshold: number;
}

const DDS_SYSTEM_PROMPT =
  'You are an expert exam question editor. Rewrite the WRONG answer choices ' +
  '(distractors) to be harder and more plausible. NEVER change which answer is ' +
  'correct. Return ONLY a JSON array: ' +
  '[{"label":"A","content":"...","isCorrect":false},{"label":"B","content":"...","isCorrect":true},...]';

/** US-1003: Read at call time so tests can override via process.env. */
function getAutoApplyThreshold(): number {
  return parseInt(process.env.DDS_AUTO_APPLY_THRESHOLD ?? '30', 10);
}

@Injectable()
export class DdsService {
  private readonly logger = new Logger(DdsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmUsage: LlmUsageService,
    private readonly llmQuota: LlmQuotaService,
  ) {}

  async proposeVariant(
    questionId: string,
    reason: DdsReason = DdsReason.DDS_HARDEN,
    triggeredByUserId?: string,
    orgId?: string,
  ): Promise<QuestionVariantDto> {
    // US-1004: enforce org quota before calling LLM
    if (orgId) {
      await this.llmQuota.enforceQuota(orgId);
    }

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { choices: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!question)
      throw new NotFoundException(`Question ${questionId} not found`);
    if (!question.choices.length)
      throw new BadRequestException('Question has no choices');

    const choicesJson = JSON.stringify(
      question.choices.map((c) => ({
        label: c.label,
        content: c.content,
        isCorrect: c.isCorrect,
      })),
    );
    const userPrompt =
      `Question: ${question.title}\n` +
      (question.description ? `Context: ${question.description}\n` : '') +
      `Choices: ${choicesJson}\nRewrite the distractor choices to be harder.`;

    const revisedChoices = await this.callLlm(userPrompt, triggeredByUserId);

    // Correctness invariant: correct answer must not change
    const originalCorrect = question.choices.find((c) => c.isCorrect);
    const revisedCorrect = revisedChoices.find((c) => c.isCorrect);
    if (!originalCorrect || !revisedCorrect) {
      throw new BadRequestException('DDS: correct answer missing');
    }
    if (
      originalCorrect.label !== revisedCorrect.label ||
      originalCorrect.content !== revisedCorrect.content
    ) {
      throw new BadRequestException('DDS correctness invariant violated');
    }

    const diff = {
      originalChoices: question.choices.map((c) => ({
        label: c.label,
        content: c.content,
        isCorrect: c.isCorrect,
      })),
      revisedChoices,
    };

    const variant = await this.prisma.questionVariant.create({
      data: { questionId, reason, status: DdsVariantStatus.PENDING, diff },
    });
    return this.toDto(variant);
  }

  async listPending(limit = 20): Promise<QuestionVariantDto[]> {
    const variants = await this.prisma.questionVariant.findMany({
      where: { status: DdsVariantStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return variants.map((v) => this.toDto(v));
  }

  async listForQuestion(questionId: string): Promise<QuestionVariantDto[]> {
    const variants = await this.prisma.questionVariant.findMany({
      where: { questionId },
      orderBy: { createdAt: 'desc' },
    });
    return variants.map((v) => this.toDto(v));
  }

  async approve(
    variantId: string,
    reviewerId: string,
    reviewNote?: string,
  ): Promise<QuestionVariantDto> {
    const variant = await this.findPendingOrThrow(variantId);
    const diff = variant.diff as {
      revisedChoices: Array<{
        label: string;
        content: string;
        isCorrect: boolean;
      }>;
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.choice.deleteMany({ where: { questionId: variant.questionId } });
      await tx.choice.createMany({
        data: diff.revisedChoices.map((c, i) => ({
          questionId: variant.questionId,
          label: c.label,
          content: c.content,
          isCorrect: c.isCorrect,
          sortOrder: i,
        })),
      });
      await tx.questionVariant.update({
        where: { id: variantId },
        data: {
          status: DdsVariantStatus.APPROVED,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNote: reviewNote ?? null,
        },
      });
    });

    return this.toDto(
      await this.prisma.questionVariant.findUniqueOrThrow({
        where: { id: variantId },
      }),
    );
  }

  async reject(
    variantId: string,
    reviewerId: string,
    reviewNote?: string,
  ): Promise<QuestionVariantDto> {
    await this.findPendingOrThrow(variantId);
    const updated = await this.prisma.questionVariant.update({
      where: { id: variantId },
      data: {
        status: DdsVariantStatus.REJECTED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: reviewNote ?? null,
      },
    });
    return this.toDto(updated);
  }

  async rollback(
    variantId: string,
    reviewerId: string,
  ): Promise<QuestionVariantDto> {
    const variant = await this.prisma.questionVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);
    if (variant.status !== DdsVariantStatus.APPROVED) {
      throw new BadRequestException('Can only roll back APPROVED variants');
    }

    const diff = variant.diff as {
      originalChoices: Array<{
        label: string;
        content: string;
        isCorrect: boolean;
      }>;
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.choice.deleteMany({ where: { questionId: variant.questionId } });
      await tx.choice.createMany({
        data: diff.originalChoices.map((c, i) => ({
          questionId: variant.questionId,
          label: c.label,
          content: c.content,
          isCorrect: c.isCorrect,
          sortOrder: i,
        })),
      });
      await tx.questionVariant.update({
        where: { id: variantId },
        data: {
          status: DdsVariantStatus.ROLLED_BACK,
          reviewedAt: new Date(),
          reviewedBy: reviewerId,
        },
      });
    });

    return this.toDto(
      await this.prisma.questionVariant.findUniqueOrThrow({
        where: { id: variantId },
      }),
    );
  }

  // ─── US-1003: Auto-apply ─────────────────────────────────────────────────

  /**
   * Evaluate whether a pending variant should be auto-applied.
   * Shadow mode (DDS_SHADOW_MODE != 'false'): logs decision but never applies.
   */
  async evaluateAutoApply(variantId: string): Promise<AutoApplyDecision> {
    const threshold = getAutoApplyThreshold();
    const killSwitch = process.env.DDS_AUTO_APPLY_ENABLED === 'true';
    const cohort = process.env.DDS_AUTO_APPLY_COHORT ?? 'default';

    if (!killSwitch) {
      return {
        shouldApply: false,
        reason: 'auto-apply disabled (kill-switch off)',
        cohort,
        approvedCount: 0,
        threshold,
      };
    }

    const variant = await this.prisma.questionVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant || variant.status !== DdsVariantStatus.PENDING) {
      return {
        shouldApply: false,
        reason: 'variant not found or not PENDING',
        cohort,
        approvedCount: 0,
        threshold,
      };
    }

    const approved = await this.prisma.questionVariant.findMany({
      where: { status: DdsVariantStatus.APPROVED },
      select: { id: true },
    });
    const approvedCount = approved.length;

    const shouldApply = approvedCount >= threshold;

    return {
      shouldApply,
      reason: shouldApply
        ? `cohort=${cohort} reached threshold (${approvedCount}/${threshold})`
        : `cohort=${cohort} below threshold (${approvedCount}/${threshold})`,
      cohort,
      approvedCount,
      threshold,
    };
  }

  /**
   * Evaluate and optionally execute auto-apply for a pending variant.
   * Shadow mode state now read from database DdsConfig per cohort.
   * US-1101: canary auto-pause — if rollback rate in recent window exceeds threshold,
   * automatically pause canary and log a warning.
   */
  async tryAutoApply(variantId: string): Promise<{
    decision: AutoApplyDecision;
    applied: boolean;
    shadowMode: boolean;
    canaryPaused?: boolean;
  }> {
    const cohort = process.env.DDS_AUTO_APPLY_COHORT ?? 'default';
    const config = await this.getOrInitCohortConfig(cohort);
    let shadowMode = config.shadowModeEnabled;

    // US-1101: canary check — auto-pause if rollback-rate is too high
    if (!shadowMode && config.canaryArmed) {
      const canarySafe = await this.checkCanary();
      if (!canarySafe) {
        this.logger.warn(
          `dds_canary_paused cohort=${cohort}: rollback rate exceeded threshold, pausing canary`,
        );
        // Update database if config is real (not in-memory fallback)
        if (!config.id?.startsWith('fallback-')) {
          await this.prisma.ddsConfig.update({
            where: { cohortName: cohort },
            data: {
              shadowModeEnabled: true,
              canaryArmed: false,
              canaryPausedAt: new Date(),
            },
          });
        }
        // Update environment to reflect paused state
        process.env.DDS_SHADOW_MODE = 'true';
        shadowMode = true;
        const decision = await this.evaluateAutoApply(variantId);
        return {
          decision,
          applied: false,
          shadowMode: true,
          canaryPaused: true,
        };
      }
    }

    const decision = await this.evaluateAutoApply(variantId);

    if (!decision.shouldApply) {
      return { decision, applied: false, shadowMode };
    }

    if (shadowMode) {
      this.logger.log(
        `dds_auto_apply_shadow variantId=${variantId} cohort=${cohort} reason="${decision.reason}"`,
      );
      return { decision, applied: false, shadowMode: true };
    }

    const note = `auto-applied (live, cohort=${decision.cohort}, threshold=${decision.threshold}, approvedCount=${decision.approvedCount})`;
    await this.approve(variantId, 'auto', note);
    this.logger.log(
      `dds_auto_applied variantId=${variantId} cohort=${cohort} reason="${decision.reason}"`,
    );
    return { decision, applied: true, shadowMode: false };
  }

  // ─── US-1107: Gate 2 readiness ────────────────────────────────────────────

  /**
   * Return production data to support the Gate 2 decision.
   * "Clean approvals" = APPROVED variants not subsequently rolled back.
   */
  async getAutoApplyReadiness(): Promise<{
    cleanApprovals: number;
    threshold: number;
    rollbackCount: number;
    lastRollbackAt: Date | null;
    readyToPromote: boolean;
  }> {
    const threshold = getAutoApplyThreshold();

    const [approvedCount, rolledBackCount, lastRollback] = await Promise.all([
      this.prisma.questionVariant.count({
        where: { status: DdsVariantStatus.APPROVED },
      }),
      this.prisma.questionVariant.count({
        where: { status: DdsVariantStatus.ROLLED_BACK },
      }),
      this.prisma.questionVariant.findFirst({
        where: { status: DdsVariantStatus.ROLLED_BACK },
        orderBy: { reviewedAt: 'desc' },
        select: { reviewedAt: true },
      }),
    ]);

    return {
      cleanApprovals: approvedCount,
      threshold,
      rollbackCount: rolledBackCount,
      lastRollbackAt: lastRollback?.reviewedAt ?? null,
      readyToPromote: approvedCount >= threshold && rolledBackCount === 0,
    };
  }

  /**
   * Get current cohort DDS config (shadow mode, canary status).
   * US-1101: Returns null if config does not exist in database.
   * Exposed for FE dashboard to show promotion state.
   */
  async getCohortConfig(cohortName: string = 'default'): Promise<{
    cohortName: string;
    shadowModeEnabled: boolean;
    canaryArmed: boolean;
    promotedAt: Date | null;
    canaryPausedAt: Date | null;
    canaryAutoResumeAt: Date | null;
  } | null> {
    const config = await this.prisma.ddsConfig.findUnique({
      where: { cohortName },
    });

    if (!config) {
      return null;
    }

    return {
      cohortName: config.cohortName,
      shadowModeEnabled: config.shadowModeEnabled,
      canaryArmed: config.canaryArmed,
      promotedAt: config.promotedAt,
      canaryPausedAt: config.canaryPausedAt,
      canaryAutoResumeAt: config.canaryAutoResumeAt,
    };
  }

  /**
   * Get or initialize cohort config from database.
   * Falls back to in-memory config when DB returns nothing (for testing without auto-create).
   * This allows env-var-driven tests to work without mocking DB write calls.
   */
  private async getOrInitCohortConfig(cohortName: string = 'default') {
    let config = await this.prisma.ddsConfig.findUnique({
      where: { cohortName },
    });

    if (!config) {
      // In-memory fallback: derive from env vars for test compatibility
      // When DDS_SHADOW_MODE='false', we enter live mode and arm the canary
      return {
        id: `fallback-${cohortName}`,
        cohortName,
        shadowModeEnabled: process.env.DDS_SHADOW_MODE !== 'false',
        canaryArmed: process.env.DDS_SHADOW_MODE === 'false',
        promotedAt: null,
        promotedBy: null,
        canaryPausedAt: null,
        canaryAutoResumeAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return config;
  }

  /**
   * US-1101: Promote a cohort from shadow mode to live.
   * Checks Gate 2 readiness and updates database config using upsert.
   */
  async promoteCohortToLive(
    cohortName: string,
    adminUserId: string,
  ): Promise<{
    success: boolean;
    reason: string;
    config?: { cohortName: string; shadowModeEnabled: boolean };
  }> {
    const cohort = cohortName || 'default';
    const readiness = await this.getAutoApplyReadiness();

    // Gate 2 validation: Check for rollbacks first (distinct error message)
    if (readiness.rollbackCount > 0) {
      return {
        success: false,
        reason: `Cannot promote: rollback(s) detected (count: ${readiness.rollbackCount}). Must resolve before promotion.`,
      };
    }

    // Gate 2 validation: Check approval threshold second (distinct error message)
    if (readiness.cleanApprovals < readiness.threshold) {
      return {
        success: false,
        reason: `Cannot promote: insufficient approvals (${readiness.cleanApprovals}/${readiness.threshold}). Need ${readiness.threshold - readiness.cleanApprovals} more approval(s).`,
      };
    }

    // Check if already promoted
    const existingConfig = await this.getCohortConfig(cohort);
    if (existingConfig && existingConfig.promotedAt) {
      return {
        success: false,
        reason: `Cohort ${cohort} already promoted to live mode on ${existingConfig.promotedAt.toISOString()}`,
        config: {
          cohortName: existingConfig.cohortName,
          shadowModeEnabled: existingConfig.shadowModeEnabled,
        },
      };
    }

    // Promote: use upsert to handle both new and existing configs
    const updated = await this.prisma.ddsConfig.upsert({
      where: { cohortName: cohort },
      update: {
        shadowModeEnabled: false,
        canaryArmed: true,
        promotedAt: new Date(),
        promotedBy: adminUserId,
      },
      create: {
        cohortName: cohort,
        shadowModeEnabled: false,
        canaryArmed: true,
        promotedBy: adminUserId,
        promotedAt: new Date(),
      },
    });

    this.logger.log(
      `dds_cohort_promoted cohort=${cohort} promotedBy=${adminUserId} approvals=${readiness.cleanApprovals}`,
    );

    return {
      success: true,
      reason: `Cohort ${cohort} successfully promoted to live mode with canary armed`,
      config: {
        cohortName: updated.cohortName,
        shadowModeEnabled: updated.shadowModeEnabled,
      },
    };
  }

  // ─── US-1101: Canary rollback-rate check ─────────────────────────────────

  /**
   * Returns true if rollback rate in the canary window is within threshold.
   * Window = last CANARY_WINDOW_SIZE auto-applied variants;
   * pauses if rollback rate > CANARY_ROLLBACK_RATE_THRESHOLD (default 20%).
   */
  private async checkCanary(): Promise<boolean> {
    const windowSize = parseInt(process.env.DDS_CANARY_WINDOW_SIZE ?? '20', 10);
    const rateThreshold = parseFloat(
      process.env.DDS_CANARY_ROLLBACK_RATE_THRESHOLD ?? '0.2',
    );

    const recentAutoApplied = await this.prisma.questionVariant.findMany({
      where: { reviewedBy: 'auto' },
      orderBy: { reviewedAt: 'desc' },
      take: windowSize,
      select: { id: true, status: true },
    });

    if (recentAutoApplied.length === 0) return true;

    const rollbackCount = recentAutoApplied.filter(
      (v) => v.status === DdsVariantStatus.ROLLED_BACK,
    ).length;
    const rollbackRate = rollbackCount / recentAutoApplied.length;

    if (rollbackRate > rateThreshold) {
      this.logger.warn(
        `dds_canary_check: rollbackRate=${rollbackRate.toFixed(2)} > threshold=${rateThreshold} window=${recentAutoApplied.length}`,
      );
      return false;
    }

    return true;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async findPendingOrThrow(variantId: string) {
    const variant = await this.prisma.questionVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);
    if (variant.status !== DdsVariantStatus.PENDING) {
      throw new BadRequestException(`Variant is already ${variant.status}`);
    }
    return variant;
  }

  private async callLlm(
    userPrompt: string,
    userId?: string,
  ): Promise<Array<{ label: string; content: string; isCorrect: boolean }>> {
    if (!llmClient.configured) {
      this.logger.warn('No LLM API key configured for DDS');
      return [];
    }

    // US-1004: shared client returns real token counts
    const result = await llmClient.call({
      system: DDS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1024,
    });

    await this.llmUsage.recordUsageEvent({
      userId: userId ?? 'system',
      orgId: null,
      feature: 'dds',
      modelId: result.modelId,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });

    try {
      const cleaned = result.content.replace(/```(?:json)?\n?/g, '').trim();
      return JSON.parse(cleaned) as Array<{
        label: string;
        content: string;
        isCorrect: boolean;
      }>;
    } catch (err) {
      this.logger.error(`DDS parse error: ${err}`);
      throw new BadRequestException('DDS LLM returned unparseable response');
    }
  }

  private toDto(v: {
    id: string;
    questionId: string;
    reason: DdsReason;
    status: DdsVariantStatus;
    diff: unknown;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    reviewNote: string | null;
    createdAt: Date;
  }): QuestionVariantDto {
    return {
      id: v.id,
      questionId: v.questionId,
      reason: v.reason,
      status: v.status,
      diff: v.diff as QuestionVariantDto['diff'],
      reviewedBy: v.reviewedBy,
      reviewedAt: v.reviewedAt,
      reviewNote: v.reviewNote,
      createdAt: v.createdAt,
    };
  }
}
