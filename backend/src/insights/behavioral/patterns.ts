// RFC-008 (Sprint 5 US-503) — Pure pattern functions.
//
// Each function takes a plain array of pre-fetched DB rows and returns either an
// `InsightOutput` (a kind + payload + evidenceCount the service can persist) or
// `null` when there isn't enough evidence / the effect is too small to surface.
//
// Keeping these pure means:
//   * The service handles all Prisma I/O and can mock these with synthetic data.
//   * Unit tests cover branches without a DB.
//   * Re-running the nightly job is deterministic given the same inputs.

import {
  ACCURACY_WINDOW_MINUTES,
  InsightKind,
  LONG_STEM_WORDS,
  MIN_DELTA_LONG_STEMS,
  MIN_DROP_ACCURACY_DECLINE,
  MIN_EVIDENCE_ACCURACY_DECLINE,
  MIN_EVIDENCE_LONG_STEMS,
  MIN_EVIDENCE_STREAK_BREAK,
  STREAK_BREAK_GAP_DAYS,
} from './behavioral.constants';

// ---------- Input row shapes (plain, no Prisma types) ----------

/** One observed answer with its question's stem length and time spent. */
export interface AnswerRow {
  /** Total time on this question in milliseconds. */
  timeSpentMs: number;
  /** Number of words in `title + description` of the question stem. */
  stemWordCount: number;
  /** When the user answered (used for session-window bucketing). */
  answeredAt: Date;
  /** When the user started the attempt this answer belongs to. */
  attemptStartedAt: Date;
  /** Whether the answer was marked correct (null if not graded yet). */
  isCorrect: boolean | null;
  /** Domain for `domain_streak_break`. Null is allowed and skipped. */
  domainId: string | null;
}

// ---------- Output shape (one per insight kind) ----------

export type InsightPayload = Record<string, unknown>;

export interface InsightOutput {
  kind: InsightKind;
  payload: InsightPayload;
  evidenceCount: number;
}

// ---------- Pattern: slow on long stems ----------

/**
 * Compares avg time-per-question on stems > 200 words vs ≤ 200 words.
 * Returns null when either bucket is empty, evidence is below the floor,
 * or the relative slowdown is below `MIN_DELTA_LONG_STEMS`.
 */
export function detectSlowOnLongStems(
  answers: ReadonlyArray<AnswerRow>,
): InsightOutput | null {
  const long: number[] = [];
  const short: number[] = [];

  for (const a of answers) {
    if (!Number.isFinite(a.timeSpentMs) || a.timeSpentMs <= 0) continue;
    if (a.stemWordCount > LONG_STEM_WORDS) {
      long.push(a.timeSpentMs);
    } else {
      short.push(a.timeSpentMs);
    }
  }

  const evidenceCount = long.length + short.length;
  if (evidenceCount < MIN_EVIDENCE_LONG_STEMS) return null;
  if (long.length === 0 || short.length === 0) return null;

  const avgLong = mean(long);
  const avgShort = mean(short);
  if (avgShort === 0) return null;

  const delta = (avgLong - avgShort) / avgShort;
  if (delta < MIN_DELTA_LONG_STEMS) return null;

  return {
    kind: InsightKind.SLOW_ON_LONG_STEMS,
    payload: {
      avgMsLong: Math.round(avgLong),
      avgMsShort: Math.round(avgShort),
      delta: round3(delta),
      longCount: long.length,
      shortCount: short.length,
    },
    evidenceCount,
  };
}

// ---------- Pattern: accuracy decline after 30 minutes ----------

/**
 * Buckets answers by minutes-since-attempt-start: 0..30 vs 30+.
 * Returns null if either bucket has fewer than 10 graded answers or the drop
 * is below `MIN_DROP_ACCURACY_DECLINE`.
 */
export function detectAccuracyDeclineAfter30Min(
  answers: ReadonlyArray<AnswerRow>,
): InsightOutput | null {
  const early: boolean[] = [];
  const late: boolean[] = [];

  for (const a of answers) {
    if (a.isCorrect === null) continue;
    const minutes =
      (a.answeredAt.getTime() - a.attemptStartedAt.getTime()) / 60_000;
    if (!Number.isFinite(minutes) || minutes < 0) continue;
    if (minutes < ACCURACY_WINDOW_MINUTES) {
      early.push(a.isCorrect);
    } else {
      late.push(a.isCorrect);
    }
  }

  const evidenceCount = early.length + late.length;
  if (evidenceCount < MIN_EVIDENCE_ACCURACY_DECLINE) return null;
  // Per-bucket floor: need at least 10 each side or the comparison is noise.
  if (early.length < 10 || late.length < 10) return null;

  const accEarly = accuracy(early);
  const accLate = accuracy(late);
  const drop = accEarly - accLate;
  if (drop < MIN_DROP_ACCURACY_DECLINE) return null;

  return {
    kind: InsightKind.ACCURACY_DECLINE_AFTER_30MIN,
    payload: {
      firstWindow: round3(accEarly),
      secondWindow: round3(accLate),
      drop: round3(drop),
      earlyCount: early.length,
      lateCount: late.length,
    },
    evidenceCount,
  };
}

// ---------- Pattern: domain streak break ----------

/**
 * Finds the domain with the longest gap between its last-seen answer and
 * `referenceDate` (the run date) — provided that domain had been seen at all
 * in the lookback window. Returns null below evidence floor or when no domain
 * crosses the gap threshold.
 *
 * `referenceDate` defaults to the latest `answeredAt` in the input; tests can
 * pass it explicitly for determinism.
 */
export function detectDomainStreakBreak(
  answers: ReadonlyArray<AnswerRow>,
  referenceDate?: Date,
): InsightOutput | null {
  const evidenceCount = answers.filter((a) => a.domainId !== null).length;
  if (evidenceCount < MIN_EVIDENCE_STREAK_BREAK) return null;

  // Latest answeredAt across all answers; falls back to provided date.
  const reference =
    referenceDate ??
    new Date(
      Math.max(
        0,
        ...answers.map((a) => a.answeredAt.getTime()).filter(Number.isFinite),
      ),
    );

  const lastSeenByDomain = new Map<string, Date>();
  for (const a of answers) {
    if (a.domainId === null) continue;
    const prev = lastSeenByDomain.get(a.domainId);
    if (!prev || a.answeredAt > prev) {
      lastSeenByDomain.set(a.domainId, a.answeredAt);
    }
  }

  let staleDomainId: string | null = null;
  let staleLastSeen: Date | null = null;
  let staleGapDays = 0;

  for (const [domainId, lastSeen] of lastSeenByDomain) {
    const gapDays =
      (reference.getTime() - lastSeen.getTime()) / (24 * 60 * 60 * 1000);
    if (gapDays > staleGapDays) {
      staleGapDays = gapDays;
      staleDomainId = domainId;
      staleLastSeen = lastSeen;
    }
  }

  if (
    staleDomainId === null ||
    staleLastSeen === null ||
    staleGapDays < STREAK_BREAK_GAP_DAYS
  ) {
    return null;
  }

  return {
    kind: InsightKind.DOMAIN_STREAK_BREAK,
    payload: {
      domainId: staleDomainId,
      lastSeenAt: staleLastSeen.toISOString(),
      gapDays: round3(staleGapDays),
    },
    evidenceCount,
  };
}

// ---------- Aggregator ----------

/**
 * Convenience: run all three detectors and return the non-null insights.
 * Order in the returned array is stable (long-stems, accuracy-decline,
 * streak-break) so callers can write deterministic tests.
 */
export function detectAllInsights(
  answers: ReadonlyArray<AnswerRow>,
  referenceDate?: Date,
): InsightOutput[] {
  const out: InsightOutput[] = [];
  const longStems = detectSlowOnLongStems(answers);
  if (longStems) out.push(longStems);
  const decline = detectAccuracyDeclineAfter30Min(answers);
  if (decline) out.push(decline);
  const streak = detectDomainStreakBreak(answers, referenceDate);
  if (streak) out.push(streak);
  return out;
}

// ---------- Helpers ----------

function mean(xs: ReadonlyArray<number>): number {
  if (xs.length === 0) return 0;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

function accuracy(xs: ReadonlyArray<boolean>): number {
  if (xs.length === 0) return 0;
  let correct = 0;
  for (const x of xs) if (x) correct += 1;
  return correct / xs.length;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
