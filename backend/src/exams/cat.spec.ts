import {
  catConfig,
  CatItem,
  domainShares,
  estimate,
  nextItem,
  stopReason,
} from './cat';
import { pCorrect } from './ability';

const item = (
  id: string,
  b: number,
  domainId: string | null = 'd1',
): CatItem => ({
  id,
  b,
  domainId,
});

describe('CAT', () => {
  it('config: minimum length is 10, or the whole test when shorter', () => {
    expect(catConfig(30)).toEqual({
      maxItems: 30,
      minItems: 10,
      targetSe: 0.4,
    });
    expect(catConfig(5).minItems).toBe(5);
  });

  describe('domainShares', () => {
    const pool = [item('a', 0, 'd1'), item('b', 0, 'd1'), item('c', 0, 'd2')];

    it('follows blueprint weights when set', () => {
      expect(
        domainShares(
          pool,
          new Map([
            ['d1', 25],
            ['d2', 75],
          ]),
        ),
      ).toEqual({ d1: 0.25, d2: 0.75 });
    });

    it('falls back to the pool share', () => {
      const shares = domainShares(pool, new Map());
      expect(shares.d1).toBeCloseTo(2 / 3);
      expect(shares.d2).toBeCloseTo(1 / 3);
    });
  });

  describe('nextItem', () => {
    const first = () => 0; // deterministic randomesque: best candidate

    it('picks the most informative question at the current ability', () => {
      const state = {
        pool: [item('easy', -2), item('mid', 0.9), item('hard', 3)],
        domainShares: { d1: 1 },
        theta: 1,
      };
      expect(nextItem(state, [], first)!.id).toBe('mid');
      expect(nextItem({ ...state, theta: 3 }, [], first)!.id).toBe('hard');
    });

    it('never repeats a question and returns null when the pool is used up', () => {
      const state = {
        pool: [item('a', 0), item('b', 0)],
        domainShares: { d1: 1 },
        theta: 0,
      };
      expect(nextItem(state, ['a'], first)!.id).toBe('b');
      expect(nextItem(state, ['a', 'b'], first)).toBeNull();
    });

    it('balances content across domains by blueprint share', () => {
      const state = {
        pool: [
          item('n1', 0, 'net'),
          item('n2', 0, 'net'),
          item('s1', 0, 'sec'),
          item('s2', 0, 'sec'),
        ],
        domainShares: { net: 0.5, sec: 0.5 },
        theta: 0,
      };
      // After one networking question, security is behind.
      expect(nextItem(state, ['n1'], first)!.domainId).toBe('sec');
    });

    it('chooses randomly among the few best to limit exposure', () => {
      const state = {
        pool: [item('a', 0), item('b', 0.05), item('c', 0.1), item('d', 3)],
        domainShares: { d1: 1 },
        theta: 0,
      };
      const picks = new Set(
        [0, 0.34, 0.67, 0.99].map((r) => nextItem(state, [], () => r)!.id),
      );
      expect(picks).toEqual(new Set(['a', 'b', 'c']));
    });
  });

  describe('stopReason', () => {
    const cfg = { maxItems: 20, minItems: 10, targetSe: 0.3 };

    it('stops at the maximum length', () => {
      expect(stopReason({ ...cfg, se: 0.5 }, 20, 50)).toBe('MAX_ITEMS');
    });

    it('stops once precise enough, but not before the minimum', () => {
      expect(stopReason({ ...cfg, se: 0.29 }, 9, 50)).toBeNull();
      expect(stopReason({ ...cfg, se: 0.29 }, 10, 50)).toBe('PRECISION');
      expect(stopReason({ ...cfg, se: 0.31 }, 12, 50)).toBeNull();
    });

    it('stops when the pool runs out', () => {
      expect(stopReason({ ...cfg, se: 0.5 }, 3, 0)).toBe('POOL_EXHAUSTED');
    });
  });

  it('converges on a simulated learner and gets more precise', () => {
    // 200 questions spread over [-3, 3]; a learner of true ability 1.2.
    const pool = Array.from({ length: 200 }, (_, i) =>
      item(`q${i}`, -3 + (6 * i) / 199),
    );
    let seed = 7;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const trueTheta = 1.2;
    const state = { pool, domainShares: { d1: 1 }, theta: 0 };
    const given: string[] = [];
    const responses: { questionId: string; correct: boolean }[] = [];
    let se = 1;
    for (let n = 0; n < 40; n++) {
      const q = nextItem(state, given, rng)!;
      given.push(q.id);
      responses.push({
        questionId: q.id,
        correct: rng() < pCorrect(trueTheta, q.b),
      });
      ({ theta: state.theta, se } = estimate(pool, responses, 0));
    }
    expect(Math.abs(state.theta - trueTheta)).toBeLessThan(0.6);
    expect(se).toBeLessThan(0.35);
  });
});
