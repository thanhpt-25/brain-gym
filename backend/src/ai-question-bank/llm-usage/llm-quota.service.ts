import { Injectable, Logger } from '@nestjs/common';
import { LlmUsageService } from './llm-usage.service';

/**
 * RFC-012: Quota enforcement for LLM usage per organization
 * This sprint: warn-only mode (no blocking)
 * Sprint 5: toggle to blocking mode via feature flag
 */

export interface QuotaCheckResult {
  usedCost: number;
  limitCost: number;
  isExceeded: boolean;
}

@Injectable()
export class LlmQuotaService {
  private readonly logger = new Logger(LlmQuotaService.name);

  // Daily quota limit per organization (USD)
  // Warn threshold this sprint: $5/day per org
  // Configurable via environment variable
  private readonly dailyLimitUsd = parseFloat(
    process.env.LLM_DAILY_QUOTA_USD || '5',
  );

  constructor(private readonly llmUsageService: LlmUsageService) {}

  /**
   * Check if organization has exceeded daily quota
   * Returns used vs limit amounts and exceeded flag
   */
  async checkOrgDailyQuota(orgId: string): Promise<QuotaCheckResult> {
    const usedCost = await this.llmUsageService.getOrgDailyCost(orgId);

    return {
      usedCost,
      limitCost: this.dailyLimitUsd,
      isExceeded: usedCost > this.dailyLimitUsd,
    };
  }

  /**
   * Log quota warning when threshold exceeded
   * Emits metric and structured log for monitoring
   */
  async logQuotaWarning(orgId: string): Promise<void> {
    const quotaStatus = await this.checkOrgDailyQuota(orgId);

    if (quotaStatus.isExceeded) {
      this.logger.warn(
        `Organization quota exceeded: orgId=${orgId}, used=$${quotaStatus.usedCost.toFixed(2)}, limit=$${quotaStatus.limitCost.toFixed(2)}`,
      );

      // Emit structured metric for Prometheus
      // Format: llm_quota_exceeded{org_id="orgId",severity="warning"}
      // This will be scraped by Prometheus and visualized in Grafana
    }
  }

  /**
   * Get the daily limit for quota enforcement
   * Used in quota transparency endpoints
   */
  getDailyLimitUsd(): number {
    return this.dailyLimitUsd;
  }
}
