import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmUsageService } from './llm-usage.service';

/**
 * RFC-012 v1 (US-507): Quota enforcement for LLM usage per organization.
 *
 * Sprint 4: warn-only mode.
 * Sprint 5 (this file): blocking mode — `enforceQuota()` throws HTTP 429 when the
 * org's daily spending cap is exceeded.  The cap is looked up from
 * `Organization.llmDailyUsdCap`; if NULL it falls back to the
 * `LLM_DAILY_QUOTA_USD` environment variable (default $5/day).
 *
 * The Grafana alert is triggered via the structured log emitted by `enforceQuota`
 * when the org reaches ≥80% of cap (`llm_quota_near_cap` log key).
 */

/** Response body shape for over-quota 429 errors. */
export interface QuotaExceededBody {
  code: 'LLM_QUOTA_EXCEEDED';
  resetAt: string; // ISO-8601 — next UTC midnight
  usedCost: number;
  limitCost: number;
}

export interface QuotaCheckResult {
  usedCost: number;
  limitCost: number;
  isExceeded: boolean;
}

@Injectable()
export class LlmQuotaService {
  private readonly logger = new Logger(LlmQuotaService.name);

  /** Fallback daily limit (USD) when the org row has no explicit cap. */
  private readonly envDailyLimitUsd = parseFloat(
    process.env.LLM_DAILY_QUOTA_USD || '5',
  );

  constructor(
    private readonly llmUsageService: LlmUsageService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Cap resolution ─────────────────────────────────────────────────────────

  /**
   * Returns the effective daily cap for `orgId`.
   * Org-level override wins; falls back to the env-var default.
   */
  async getOrgDailyCap(orgId: string): Promise<number> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { llmDailyUsdCap: true },
    });

    if (org?.llmDailyUsdCap != null) {
      return parseFloat(org.llmDailyUsdCap.toString());
    }

    return this.envDailyLimitUsd;
  }

  // ─── Quota checks ───────────────────────────────────────────────────────────

  /**
   * Check whether the org has exceeded its daily quota.
   * Uses the per-org cap from the DB (falls back to env var if NULL).
   */
  async checkOrgDailyQuota(orgId: string): Promise<QuotaCheckResult> {
    const [usedCost, limitCost] = await Promise.all([
      this.llmUsageService.getOrgDailyCost(orgId),
      this.getOrgDailyCap(orgId),
    ]);

    return { usedCost, limitCost, isExceeded: usedCost > limitCost };
  }

  /**
   * Returns true if the org has consumed ≥ `thresholdPct` of its daily cap.
   * Used to emit the `llm_quota_near_cap` log that drives the Grafana alert.
   */
  async isNearQuota(orgId: string, thresholdPct = 0.8): Promise<boolean> {
    const { usedCost, limitCost } = await this.checkOrgDailyQuota(orgId);
    return limitCost > 0 && usedCost / limitCost >= thresholdPct;
  }

  // ─── Blocking enforcement ────────────────────────────────────────────────────

  /**
   * Throws HTTP 429 `LLM_QUOTA_EXCEEDED` when the org is over-quota.
   * Call this at the start of any LLM-generating endpoint.
   *
   * Also emits a `llm_quota_near_cap` structured log at 80% utilisation so
   * Prometheus / Loki can trigger the Grafana alert before the hard wall is hit.
   *
   * `resetAt` in the response body is the next UTC midnight — the moment the
   * daily window resets and the org can generate again.
   */
  async enforceQuota(orgId: string): Promise<void> {
    const status = await this.checkOrgDailyQuota(orgId);

    if (!status.isExceeded) {
      if (status.limitCost > 0) {
        const pct = status.usedCost / status.limitCost;
        if (pct >= 0.8) {
          this.logger.warn(
            `llm_quota_near_cap orgId=${orgId} used=$${status.usedCost.toFixed(2)} limit=$${status.limitCost.toFixed(2)} pct=${(pct * 100).toFixed(0)}%`,
          );
        }
      }
      return;
    }

    this.logger.warn(
      `llm_quota_exceeded orgId=${orgId} used=$${status.usedCost.toFixed(2)} limit=$${status.limitCost.toFixed(2)}`,
    );

    const body: QuotaExceededBody = {
      code: 'LLM_QUOTA_EXCEEDED',
      resetAt: nextUtcMidnight().toISOString(),
      usedCost: status.usedCost,
      limitCost: status.limitCost,
    };

    throw new HttpException(body, HttpStatus.TOO_MANY_REQUESTS);
  }

  // ─── Observability helpers ──────────────────────────────────────────────────

  /**
   * Emit a structured warning log when the org is over-quota.
   * Kept for backward compatibility with Sprint-4 callers.
   */
  async logQuotaWarning(orgId: string): Promise<void> {
    const quotaStatus = await this.checkOrgDailyQuota(orgId);

    if (quotaStatus.isExceeded) {
      this.logger.warn(
        `Organization quota exceeded: orgId=${orgId}, used=$${quotaStatus.usedCost.toFixed(2)}, limit=$${quotaStatus.limitCost.toFixed(2)}`,
      );
    }
  }

  /** Returns the environment-variable fallback daily limit (for transparency endpoints). */
  getDailyLimitUsd(): number {
    return this.envDailyLimitUsd;
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/** Returns the next UTC midnight Date from the current moment. */
function nextUtcMidnight(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
}
