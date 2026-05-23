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
   * Default is shadow mode (DDS_SHADOW_MODE=true): decision logged, not applied.
   */
  async tryAutoApply(variantId: string): Promise<{
    decision: AutoApplyDecision;
    applied: boolean;
    shadowMode: boolean;
  }> {
    const shadowMode = process.env.DDS_SHADOW_MODE !== 'false';
    const decision = await this.evaluateAutoApply(variantId);

    if (!decision.shouldApply) {
      return { decision, applied: false, shadowMode };
    }

    if (shadowMode) {
      this.logger.log(
        `dds_auto_apply_shadow variantId=${variantId} reason="${decision.reason}"`,
      );
      return { decision, applied: false, shadowMode: true };
    }

    const note = `auto-applied (cohort=${decision.cohort}, threshold=${decision.threshold}, approvedCount=${decision.approvedCount})`;
    await this.approve(variantId, 'auto', note);
    this.logger.log(
      `dds_auto_applied variantId=${variantId} reason="${decision.reason}"`,
    );
    return { decision, applied: true, shadowMode: false };
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
