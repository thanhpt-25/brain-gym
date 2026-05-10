import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * RFC-012: Tracks LLM API usage for cost attribution, quota enforcement, and observability
 * Records every LLM call with token counts and calculated USD cost
 */

export interface TokenCostConfig {
  inputPricePerKToken: number; // $/1k tokens
  outputPricePerKToken: number; // $/1k tokens
}

export interface LlmUsageEventInput {
  userId: string;
  orgId?: string | null;
  feature: string; // e.g., 'question_generation', 'coach', 'dds', 'embedding'
  modelId: string; // e.g., 'gpt-4-turbo', 'claude-3-opus'
  inputTokens: number;
  outputTokens: number;
}

export interface DailyCostBreakdown {
  feature: string;
  costUsd: number;
}

@Injectable()
export class LlmUsageService {
  private readonly logger = new Logger(LlmUsageService.name);

  // Provider-specific pricing matrix (USD per 1K tokens)
  // Data sources: OpenAI pricing page, Anthropic pricing page, Google Gemini pricing page
  private static readonly PROVIDER_PRICING: Record<string, TokenCostConfig> = {
    'gpt-4-turbo': { inputPricePerKToken: 0.01, outputPricePerKToken: 0.03 },
    'gpt-4': { inputPricePerKToken: 0.03, outputPricePerKToken: 0.06 },
    'gpt-3.5-turbo': {
      inputPricePerKToken: 0.0005,
      outputPricePerKToken: 0.0015,
    },
    'claude-3-opus': {
      inputPricePerKToken: 0.015,
      outputPricePerKToken: 0.075,
    },
    'claude-3-sonnet': {
      inputPricePerKToken: 0.003,
      outputPricePerKToken: 0.015,
    },
    'claude-3-haiku': {
      inputPricePerKToken: 0.00025,
      outputPricePerKToken: 0.00125,
    },
    'gemini-pro': { inputPricePerKToken: 0.0005, outputPricePerKToken: 0.0015 },
    'gemini-1.5-pro': {
      inputPricePerKToken: 0.00075,
      outputPricePerKToken: 0.003,
    },
  };

  // Fallback pricing for unknown models (conservative estimate)
  private static readonly FALLBACK_PRICING: TokenCostConfig = {
    inputPricePerKToken: 0.001,
    outputPricePerKToken: 0.001,
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate token cost in USD based on provider and model
   * Result preserves full precision (6 decimal places) to avoid rounding loss
   */
  calculateTokenCost(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const pricing =
      LlmUsageService.PROVIDER_PRICING[modelId] ||
      LlmUsageService.FALLBACK_PRICING;

    const inputCost = (inputTokens / 1000) * pricing.inputPricePerKToken;
    const outputCost = (outputTokens / 1000) * pricing.outputPricePerKToken;
    const totalCost = inputCost + outputCost;

    // Preserve 6 decimal places (Decimal(10,6) in schema) to avoid precision loss
    return Math.round(totalCost * 1000000) / 1000000;
  }

  /**
   * Record a single LLM API usage event
   * Gracefully handles failures without blocking the operation that triggered it
   */
  async recordUsageEvent(input: LlmUsageEventInput): Promise<void> {
    try {
      const costUsd = this.calculateTokenCost(
        input.modelId,
        input.inputTokens,
        input.outputTokens,
      );

      await this.prisma.llmUsageEvent.create({
        data: {
          userId: input.userId,
          orgId: input.orgId || null,
          feature: input.feature,
          modelId: input.modelId,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          costUsd: new Decimal(costUsd.toString()),
        },
      });

      // Warn-only quota enforcement (RFC-012)
      if (input.orgId) {
        const usedCost = await this.getOrgDailyCost(input.orgId);
        const limit = parseFloat(process.env.LLM_DAILY_QUOTA_USD || '5');
        if (usedCost > limit) {
          this.logger.warn(
            `Organization quota exceeded: orgId=${input.orgId}, used=$${usedCost.toFixed(2)}, limit=$${limit.toFixed(2)}`
          );
        }
      }
    } catch (error) {
      // Non-fatal: log but don't throw
      // LLM operation already succeeded; we just failed to record it
      this.logger.error(
        `Failed to record LLM usage event for user ${input.userId}`,
        error,
      );
    }
  }

  /**
   * Specialized method for recording question generation LLM calls
   * Maps promptTokens/completionTokens from QuestionGenerationJob to inputTokens/outputTokens
   */
  async recordQuestionGeneration(
    userId: string,
    orgId: string | null | undefined,
    modelId: string,
    promptTokens: number,
    completionTokens: number,
  ): Promise<void> {
    await this.recordUsageEvent({
      userId,
      orgId: orgId || null,
      feature: 'question_generation',
      modelId,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
    });
  }

  /**
   * Get total LLM cost for an organization on a specific date
   * Defaults to today if date not provided
   */
  async getOrgDailyCost(orgId: string, date?: Date): Promise<number> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const result = await this.prisma.llmUsageEvent.aggregate({
      where: {
        orgId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      _sum: {
        costUsd: true,
      },
    });

    return result._sum.costUsd ? parseFloat(result._sum.costUsd.toString()) : 0;
  }

  /**
   * Get total LLM cost for a user on a specific date
   * Defaults to today if date not provided
   */
  async getUserDailyCost(userId: string, date?: Date): Promise<number> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const result = await this.prisma.llmUsageEvent.aggregate({
      where: {
        userId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      _sum: {
        costUsd: true,
      },
    });

    return result._sum.costUsd ? parseFloat(result._sum.costUsd.toString()) : 0;
  }

  /**
   * Get cost breakdown by feature for an organization on a specific date
   */
  async getOrgCostByFeature(
    orgId: string,
    date?: Date,
  ): Promise<DailyCostBreakdown[]> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const results = await this.prisma.llmUsageEvent.groupBy({
      by: ['feature'],
      where: {
        orgId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      _sum: {
        costUsd: true,
      },
    });

    return results.map((row) => ({
      feature: row.feature,
      costUsd: row._sum.costUsd ? parseFloat(row._sum.costUsd.toString()) : 0,
    }));
  }
}
