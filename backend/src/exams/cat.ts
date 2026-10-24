/**
 * Computerized Adaptive Testing (CAT) on the Rasch model (see ability.ts).
 *
 * After every answer the ability estimate is updated and the next question
 * is the unused one carrying the most Fisher information at that estimate,
 * p(1 - p), i.e. the one closest to a 50% chance of success, subject to:
 * - content balancing: the next question comes from the domain furthest
 *   below its blueprint share (Domain.weight, else its pool share);
 * - exposure control ("randomesque"): a random pick among the best few, so
 *   everybody at the same level doesn't get the exact same test.
 * The test stops at the maximum length, or once the standard error is small
 * enough after a minimum number of questions, or when the pool runs out.
 */
import { estimateAbility, pCorrect } from './ability';

export interface CatItem {
  id: string;
  b: number;
  domainId: string | null;
}

export interface CatResponse {
  questionId: string;
  correct: boolean;
}

export interface CatConfig {
  maxItems: number;
  minItems: number;
  targetSe: number;
}

/** Persisted in ExamAttempt.presentation.cat. */
export interface CatState extends CatConfig {
  /** Candidate pool with difficulties frozen at the start of the attempt. */
  pool: CatItem[];
  /** Prior mean: the learner's ability from earlier attempts. */
  priorTheta: number;
  /** Domain id → blueprint share (sums to 1). */
  domainShares: Record<string, number>;
  theta: number;
  se: number;
  done: boolean;
  stoppedBy?: StopReason;
}

export type StopReason =
  | 'MAX_ITEMS'
  | 'PRECISION'
  | 'POOL_EXHAUSTED'
  | 'TIME'
  | 'ENDED_EARLY';

/**
 * Stop once the ability is known to about ±0.8 logits (95%). A Rasch item
 * gives at most 0.25 information, so this needs ~21 questions at best;
 * 0.3 would need ~40 and never trigger within a 30-question practice test.
 */
export const CAT_TARGET_SE = 0.4;
export const CAT_MIN_ITEMS = 10;
/** How many top candidates the randomesque pick chooses from. */
export const CAT_RANDOMESQUE = 3;

const NO_DOMAIN = '__none__';

export function catConfig(maxItems: number): CatConfig {
  return {
    maxItems,
    minItems: Math.min(CAT_MIN_ITEMS, maxItems),
    targetSe: CAT_TARGET_SE,
  };
}

/** Blueprint shares per domain: weights when any are set, else pool sizes. */
export function domainShares(
  pool: CatItem[],
  weights: Map<string, number | null>,
): Record<string, number> {
  const keys = [...new Set(pool.map((i) => i.domainId ?? NO_DOMAIN))];
  const weighted = keys.some((k) => (weights.get(k) ?? 0) > 0);
  const raw = keys.map((k) => [
    k,
    weighted
      ? (weights.get(k) ?? 0)
      : pool.filter((i) => (i.domainId ?? NO_DOMAIN) === k).length,
  ]) as [string, number][];
  const total = raw.reduce((s, [, v]) => s + v, 0) || 1;
  return Object.fromEntries(raw.map(([k, v]) => [k, v / total]));
}

export function estimate(
  pool: CatItem[],
  responses: CatResponse[],
  priorTheta: number,
): { theta: number; se: number } {
  const b = new Map(pool.map((i) => [i.id, i.b]));
  return estimateAbility(
    responses
      .filter((r) => b.has(r.questionId))
      .map((r) => ({ b: b.get(r.questionId)!, correct: r.correct })),
    priorTheta,
  );
}

export function stopReason(
  state: Pick<CatState, 'maxItems' | 'minItems' | 'targetSe' | 'se'>,
  answered: number,
  remaining: number,
): StopReason | null {
  if (answered >= state.maxItems) return 'MAX_ITEMS';
  if (answered >= state.minItems && state.se <= state.targetSe) {
    return 'PRECISION';
  }
  if (remaining === 0) return 'POOL_EXHAUSTED';
  return null;
}

/**
 * The next question to administer, or null when every question was used.
 * `administered` holds everything already shown (answered or not).
 */
export function nextItem(
  state: Pick<CatState, 'pool' | 'domainShares' | 'theta'>,
  administered: string[],
  rng: () => number = Math.random,
): CatItem | null {
  const used = new Set(administered);
  const unused = state.pool.filter((i) => !used.has(i.id));
  if (unused.length === 0) return null;

  // Content balancing: the domain with the largest deficit against its share.
  const counts = new Map<string, number>();
  const domainOf = new Map(
    state.pool.map((i) => [i.id, i.domainId ?? NO_DOMAIN]),
  );
  for (const id of administered) {
    const d = domainOf.get(id) ?? NO_DOMAIN;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const available = new Set(unused.map((i) => i.domainId ?? NO_DOMAIN));
  const n = administered.length + 1;
  let bestDomain: string | null = null;
  let bestDeficit = -Infinity;
  for (const d of available) {
    const deficit = (state.domainShares[d] ?? 0) * n - (counts.get(d) ?? 0);
    if (deficit > bestDeficit) {
      bestDeficit = deficit;
      bestDomain = d;
    }
  }
  const candidates = unused.filter(
    (i) => (i.domainId ?? NO_DOMAIN) === bestDomain,
  );

  // Maximum information at the current estimate, randomesque among the top.
  const ranked = candidates
    .map((i) => {
      const p = pCorrect(state.theta, i.b);
      return { item: i, info: p * (1 - p) };
    })
    .sort((a, b) => b.info - a.info)
    .slice(0, CAT_RANDOMESQUE);
  return ranked[Math.floor(rng() * ranked.length)].item;
}
