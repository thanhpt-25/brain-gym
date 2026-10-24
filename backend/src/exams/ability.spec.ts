import {
  estimateAbility,
  passProbability,
  pCorrect,
  questionDifficulty,
} from './ability';

describe('ability (Rasch)', () => {
  it('P(correct) is 0.5 when ability equals difficulty and grows with ability', () => {
    expect(pCorrect(0, 0)).toBeCloseTo(0.5);
    expect(pCorrect(1, 0)).toBeGreaterThan(0.7);
    expect(pCorrect(-1, 0)).toBeLessThan(0.3);
  });

  describe('questionDifficulty', () => {
    it('uses the label prior without statistics', () => {
      expect(questionDifficulty('EASY')).toBe(-1);
      expect(questionDifficulty('MEDIUM')).toBe(0);
      expect(questionDifficulty('HARD')).toBe(1);
      expect(questionDifficulty(null)).toBe(0);
    });

    it('moves towards the observed accuracy as answers accumulate', () => {
      // A "HARD" question almost everybody gets right is really easy.
      const few = questionDifficulty('HARD', 4, 4);
      const many = questionDifficulty('HARD', 200, 196);
      expect(few).toBeLessThan(1);
      expect(many).toBeLessThan(few);
      expect(many).toBeLessThan(-2);
    });
  });

  describe('estimateAbility', () => {
    it('stays at the prior mean with no answers', () => {
      expect(estimateAbility([])).toEqual({ theta: 0, se: 1 });
    });

    it('rises with correct answers, falls with wrong ones, and gets surer', () => {
      const good = estimateAbility(
        Array.from({ length: 30 }, (_, i) => ({ b: 0, correct: i % 5 !== 0 })),
      );
      const weak = estimateAbility(
        Array.from({ length: 30 }, (_, i) => ({ b: 0, correct: i % 5 === 0 })),
      );
      expect(good.theta).toBeGreaterThan(0.8);
      expect(weak.theta).toBeLessThan(-0.8);
      expect(good.se).toBeLessThan(0.5);
    });

    it('stays finite when every answer is correct', () => {
      const { theta } = estimateAbility(
        Array.from({ length: 20 }, () => ({ b: 0, correct: true })),
      );
      expect(Number.isFinite(theta)).toBe(true);
      expect(theta).toBeGreaterThan(1);
    });
  });

  describe('passProbability', () => {
    const pool = Array.from({ length: 100 }, (_, i) => (i - 50) / 25);

    it('is high for strong learners and low for weak ones', () => {
      expect(passProbability(2, 0.2, pool, 65, 70)).toBeGreaterThan(0.9);
      expect(passProbability(-1, 0.2, pool, 65, 70)).toBeLessThan(0.05);
    });

    it('increases with ability and decreases with the pass mark', () => {
      const lo = passProbability(0.5, 0.3, pool, 65, 70);
      const hi = passProbability(1, 0.3, pool, 65, 70);
      expect(hi).toBeGreaterThan(lo);
      expect(passProbability(1, 0.3, pool, 65, 80)).toBeLessThan(hi);
    });

    it('is 0 for an empty pool', () => {
      expect(passProbability(1, 0.3, [], 65, 70)).toBe(0);
    });
  });
});
