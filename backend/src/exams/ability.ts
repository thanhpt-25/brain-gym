/**
 * Rasch (1-parameter IRT) helpers for adaptive practice and pass-likelihood.
 *
 * - A question's difficulty `b` blends a prior from its Difficulty label with
 *   how often learners actually got it right.
 * - A learner's ability `theta` is the MAP estimate from their answers under
 *   a N(0, 1) prior, with a standard error.
 * - P(correct) = 1 / (1 + e^-(theta - b)).
 */

export type DifficultyLabel = 'EASY' | 'MEDIUM' | 'HARD';

const LABEL_PRIOR: Record<DifficultyLabel, number> = {
  EASY: -1,
  MEDIUM: 0,
  HARD: 1,
};

/** Answers after which a question's own statistics outweigh its label. */
const STATS_WEIGHT_HALF = 10;

export function pCorrect(theta: number, b: number): number {
  return 1 / (1 + Math.exp(-(theta - b)));
}

/**
 * Difficulty on the logit scale from the label prior and observed accuracy
 * (with +1/+2 smoothing so 0/1 and n/n stay finite).
 */
export function questionDifficulty(
  label: DifficultyLabel | null | undefined,
  attempts = 0,
  correct = 0,
): number {
  const prior = LABEL_PRIOR[label ?? 'MEDIUM'] ?? 0;
  if (attempts <= 0) return prior;
  const rate = (correct + 1) / (attempts + 2);
  const empirical = -Math.log(rate / (1 - rate));
  const w = attempts / (attempts + STATS_WEIGHT_HALF);
  return w * empirical + (1 - w) * prior;
}

export interface Response {
  b: number;
  correct: boolean;
}

/** MAP ability estimate (Newton-Raphson) with a N(0, 1) prior. */
export function estimateAbility(responses: Response[]): {
  theta: number;
  se: number;
} {
  let theta = 0;
  for (let iter = 0; iter < 25; iter++) {
    let gradient = -theta; // prior
    let information = 1; // prior
    for (const r of responses) {
      const p = pCorrect(theta, r.b);
      gradient += (r.correct ? 1 : 0) - p;
      information += p * (1 - p);
    }
    const step = gradient / information;
    theta += Math.max(-1, Math.min(1, step));
    if (Math.abs(step) < 1e-6) break;
  }
  let information = 1;
  for (const r of responses) {
    const p = pCorrect(theta, r.b);
    information += p * (1 - p);
  }
  return { theta, se: 1 / Math.sqrt(information) };
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26). */
function normalCdf(x: number): number {
  const t = 1 / (1 + (0.3275911 * Math.abs(x)) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Gauss-Hermite nodes/weights (probabilists') for integrating over theta. */
const QUADRATURE: [number, number][] = [
  [-2.0202, 0.0113],
  [-0.9586, 0.2221],
  [0, 0.5333],
  [0.9586, 0.2221],
  [2.0202, 0.0113],
];

/**
 * Probability of scoring at least `passingPct`% on an exam of `examLength`
 * questions drawn from a pool with difficulties `poolB`, given an ability
 * estimate. Integrates over the uncertainty of theta; the score at a fixed
 * theta uses a normal approximation with continuity correction.
 */
export function passProbability(
  theta: number,
  se: number,
  poolB: number[],
  examLength: number,
  passingPct: number,
): number {
  if (poolB.length === 0 || examLength <= 0) return 0;
  const needed = Math.ceil((passingPct / 100) * examLength);
  let total = 0;
  for (const [z, w] of QUADRATURE) {
    const t = theta + z * se;
    const ps = poolB.map((b) => pCorrect(t, b));
    const meanP = ps.reduce((s, p) => s + p, 0) / ps.length;
    const mean = examLength * meanP;
    const variance = Math.max(examLength * meanP * (1 - meanP), 1e-9);
    total += w * (1 - normalCdf((needed - 0.5 - mean) / Math.sqrt(variance)));
  }
  return Math.max(0, Math.min(1, total));
}

/**
 * Target success probability for adaptive draws: challenging but not
 * discouraging (the "desirable difficulty" zone).
 */
export const ADAPTIVE_TARGET_P = 0.65;
