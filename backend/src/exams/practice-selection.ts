/**
 * Question selection for auto-generated practice exams (POST /exams/practice).
 *
 * 1. Domain quotas follow the certification blueprint (Domain.weight), like
 *    the real exam. Without weights, quotas follow the pool size per domain.
 *    Quotas a domain can't fill are handed to the others.
 * 2. Inside a domain, questions the learner has never seen or last got wrong
 *    come first, then ones they got right a while ago, and questions from
 *    their most recent attempts come last.
 */

export interface PracticeCandidate {
  id: string;
  domainId: string | null;
}

export interface PracticeDomain {
  id: string;
  weight: number | null;
}

export interface QuestionHistory {
  /** Result of the learner's last answer to this question. */
  lastCorrect: boolean;
  /** Seen in one of the learner's most recent attempts for this cert. */
  recent: boolean;
}

type Rng = () => number;

const NO_DOMAIN = '__none__';

function shuffle<T>(items: T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 0 = unseen or last answered wrong, 1 = answered right before, 2 = recent. */
export function priorityTier(history: QuestionHistory | undefined): number {
  if (!history) return 0;
  if (history.recent) return 2;
  return history.lastCorrect ? 1 : 0;
}

/**
 * Split `count` across buckets proportionally to `shares` (largest remainder),
 * never exceeding a bucket's capacity; what a full bucket can't take goes to
 * the buckets that still have room, by share and then by capacity.
 */
export function allocateQuotas(
  buckets: { key: string; share: number; capacity: number }[],
  count: number,
): Map<string, number> {
  const quotas = new Map(buckets.map((b) => [b.key, 0]));
  let remaining = Math.min(
    count,
    buckets.reduce((sum, b) => sum + b.capacity, 0),
  );

  while (remaining > 0) {
    const open = buckets.filter((b) => quotas.get(b.key)! < b.capacity);
    const totalShare = open.reduce((sum, b) => sum + b.share, 0);
    // Buckets without a share only take what weighted buckets can't.
    const pool = totalShare > 0 ? open.filter((b) => b.share > 0) : open;
    const poolShare = totalShare > 0 ? totalShare : pool.length;

    const exact = pool.map((b) => ({
      b,
      value: (remaining * (totalShare > 0 ? b.share : 1)) / poolShare,
    }));
    let given = 0;
    for (const { b, value } of exact) {
      const room = b.capacity - quotas.get(b.key)!;
      const take = Math.min(room, Math.floor(value));
      quotas.set(b.key, quotas.get(b.key)! + take);
      given += take;
    }
    // Largest remainders get the leftover units, one each.
    const byRemainder = exact
      .filter(({ b }) => quotas.get(b.key)! < b.capacity)
      .sort(
        (x, y) =>
          y.value - Math.floor(y.value) - (x.value - Math.floor(x.value)) ||
          y.b.share - x.b.share ||
          y.b.capacity - x.b.capacity,
      );
    for (const { b } of byRemainder) {
      if (given >= remaining) break;
      quotas.set(b.key, quotas.get(b.key)! + 1);
      given++;
    }
    if (given === 0) break;
    remaining -= given;
  }
  return quotas;
}

export function selectPracticeQuestions(
  candidates: PracticeCandidate[],
  domains: PracticeDomain[],
  history: Map<string, QuestionHistory>,
  count: number,
  rng: Rng = Math.random,
  /**
   * Adaptive draws: distance of each question from the learner's target
   * difficulty (lower is better). When given it replaces the unseen/missed
   * preference; questions from recent attempts still go last.
   */
  adaptiveRank?: Map<string, number>,
): string[] {
  const byDomain = new Map<string, PracticeCandidate[]>();
  for (const c of candidates) {
    const key = c.domainId ?? NO_DOMAIN;
    if (!byDomain.has(key)) byDomain.set(key, []);
    byDomain.get(key)!.push(c);
  }

  const weights = new Map(
    domains.map((d) => [d.id, d.weight && d.weight > 0 ? d.weight : 0]),
  );
  const hasWeights = [...byDomain.keys()].some(
    (key) => (weights.get(key) ?? 0) > 0,
  );
  const quotas = allocateQuotas(
    [...byDomain.entries()].map(([key, items]) => ({
      key,
      share: hasWeights ? (weights.get(key) ?? 0) : items.length,
      capacity: items.length,
    })),
    count,
  );

  const picked: string[] = [];
  for (const [key, items] of byDomain) {
    const quota = quotas.get(key) ?? 0;
    const ordered = shuffle(items, rng).sort((a, b) => {
      if (adaptiveRank) {
        const recentA = history.get(a.id)?.recent ? 1 : 0;
        const recentB = history.get(b.id)?.recent ? 1 : 0;
        return (
          recentA - recentB ||
          (adaptiveRank.get(a.id) ?? Infinity) -
            (adaptiveRank.get(b.id) ?? Infinity)
        );
      }
      return priorityTier(history.get(a.id)) - priorityTier(history.get(b.id));
    });
    picked.push(...ordered.slice(0, quota).map((c) => c.id));
  }
  return shuffle(picked, rng);
}
