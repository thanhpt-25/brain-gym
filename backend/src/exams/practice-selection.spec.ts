import {
  allocateQuotas,
  priorityTier,
  QuestionHistory,
  selectPracticeQuestions,
} from './practice-selection';

/** Deterministic RNG so shuffles are reproducible. */
function seeded(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const pool = (domainId: string | null, n: number, prefix = domainId ?? 'x') =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}`, domainId }));

describe('allocateQuotas', () => {
  it('splits proportionally to shares with largest remainders', () => {
    const q = allocateQuotas(
      [
        { key: 'a', share: 50, capacity: 100 },
        { key: 'b', share: 30, capacity: 100 },
        { key: 'c', share: 20, capacity: 100 },
      ],
      10,
    );
    expect(Object.fromEntries(q)).toEqual({ a: 5, b: 3, c: 2 });
  });

  it('hands quota a full bucket cannot take to the others', () => {
    const q = allocateQuotas(
      [
        { key: 'a', share: 80, capacity: 2 },
        { key: 'b', share: 20, capacity: 100 },
      ],
      10,
    );
    expect(Object.fromEntries(q)).toEqual({ a: 2, b: 8 });
  });

  it('only uses unweighted buckets once weighted ones are full', () => {
    const q = allocateQuotas(
      [
        { key: 'a', share: 1, capacity: 3 },
        { key: 'none', share: 0, capacity: 10 },
      ],
      5,
    );
    expect(Object.fromEntries(q)).toEqual({ a: 3, none: 2 });
  });

  it('never exceeds the total capacity', () => {
    const q = allocateQuotas([{ key: 'a', share: 1, capacity: 3 }], 10);
    expect(q.get('a')).toBe(3);
  });
});

describe('priorityTier', () => {
  it('orders unseen/missed before answered-right before recent', () => {
    expect(priorityTier(undefined)).toBe(0);
    expect(priorityTier({ lastCorrect: false, recent: false })).toBe(0);
    expect(priorityTier({ lastCorrect: true, recent: false })).toBe(1);
    expect(priorityTier({ lastCorrect: false, recent: true })).toBe(2);
  });
});

describe('selectPracticeQuestions', () => {
  it('follows the domain weights of the certification blueprint', () => {
    const candidates = [
      ...pool('d1', 50),
      ...pool('d2', 50),
      ...pool('d3', 50),
    ];
    const picked = selectPracticeQuestions(
      candidates,
      [
        { id: 'd1', weight: 50 },
        { id: 'd2', weight: 30 },
        { id: 'd3', weight: 20 },
      ],
      new Map(),
      20,
      seeded(),
    );
    const count = (d: string) => picked.filter((id) => id.startsWith(d)).length;
    expect(picked).toHaveLength(20);
    expect(new Set(picked).size).toBe(20);
    expect([count('d1'), count('d2'), count('d3')]).toEqual([10, 6, 4]);
  });

  it('without weights, follows the pool size per domain', () => {
    const picked = selectPracticeQuestions(
      [...pool('d1', 30), ...pool('d2', 10)],
      [
        { id: 'd1', weight: null },
        { id: 'd2', weight: null },
      ],
      new Map(),
      8,
      seeded(),
    );
    expect(picked.filter((id) => id.startsWith('d1'))).toHaveLength(6);
    expect(picked.filter((id) => id.startsWith('d2'))).toHaveLength(2);
  });

  it('prefers unseen and missed questions, and avoids recent ones', () => {
    const candidates = pool('d1', 6);
    const history = new Map<string, QuestionHistory>([
      ['d1-0', { lastCorrect: true, recent: true }],
      ['d1-1', { lastCorrect: false, recent: true }],
      ['d1-2', { lastCorrect: true, recent: false }],
      ['d1-3', { lastCorrect: false, recent: false }],
      // d1-4, d1-5 unseen
    ]);
    const picked = selectPracticeQuestions(
      candidates,
      [{ id: 'd1', weight: 1 }],
      history,
      3,
      seeded(),
    );
    expect(new Set(picked)).toEqual(new Set(['d1-3', 'd1-4', 'd1-5']));

    const four = selectPracticeQuestions(
      candidates,
      [{ id: 'd1', weight: 1 }],
      history,
      4,
      seeded(),
    );
    expect(four).toContain('d1-2');
    expect(four).not.toContain('d1-0');
    expect(four).not.toContain('d1-1');
  });

  it('includes questions without a domain and caps at the pool size', () => {
    const picked = selectPracticeQuestions(
      [...pool('d1', 2), ...pool(null, 2)],
      [{ id: 'd1', weight: 100 }],
      new Map(),
      10,
      seeded(),
    );
    expect(picked).toHaveLength(4);
  });
});
