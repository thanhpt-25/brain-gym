import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmUsageService } from '../llm-usage/llm-usage.service';
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

const DDS_SYSTEM_PROMPT =
  'You are an expert exam question editor. Rewrite the WRONG answer choices ' +
  '(distractors) to be harder and more plausible. NEVER change which answer is ' +
  'correct. Return ONLY a JSON array: ' +
  '[{"label":"A","content":"...","isCorrect":false},{"label":"B","content":"...","isCorrect":true},...]';

@Injectable()
export class DdsService {
  private readonly logger = new Logger(DdsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmUsage: LlmUsageService,
  ) {}

  async proposeVariant(
    questionId: string,
    reason: DdsReason = DdsReason.DDS_HARDEN,
    triggeredByUserId?: string,
  ): Promise<QuestionVariantDto> {
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

    // Correctness invariant
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
    const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.warn('No LLM API key configured for DDS');
      return [];
    }

    const isAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const modelId = isAnthropic ? 'claude-haiku-4-5' : 'gpt-3.5-turbo';
    let rawContent: string;

    if (isAnthropic) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 1024,
          system: DDS_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      const data = (await res.json()) as { content: Array<{ text: string }> };
      rawContent = data.content[0]?.text ?? '[]';
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: DDS_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1024,
        }),
      });
      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      rawContent = data.choices[0]?.message?.content ?? '[]';
    }

    await this.llmUsage.recordUsage({
      userId: userId ?? 'system',
      orgId: null,
      feature: 'dds',
      modelId,
      inputTokens: 600,
      outputTokens: 300,
    });

    try {
      const cleaned = rawContent.replace(/```(?:json)?\n?/g, '').trim();
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
