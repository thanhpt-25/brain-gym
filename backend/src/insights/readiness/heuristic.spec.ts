import { computeReadinessScore } from './heuristic';

describe('computeReadinessScore', () => {
  const allZero = {
    srsCoverage: 0,
    recentAccuracy14d: 0,
    domainSpread: 0,
    timePressure: 0,
  };

  const allOne = {
    srsCoverage: 1,
    recentAccuracy14d: 1,
    domainSpread: 1,
    timePressure: 1,
  };

  describe('score calculation', () => {
    it('returns score 0 when all signals are 0', () => {
      const result = computeReadinessScore(allZero, 0);
      expect(result.score).toBe(0);
    });

    it('returns score 100 when all signals are 1', () => {
      const result = computeReadinessScore(allOne, 100);
      expect(result.score).toBe(100);
    });

    it('applies correct weight for recentAccuracy14d=1 only → score 40', () => {
      const result = computeReadinessScore(
        {
          srsCoverage: 0,
          recentAccuracy14d: 1,
          domainSpread: 0,
          timePressure: 0,
        },
        50,
      );
      expect(result.score).toBe(40);
    });

    it('applies correct weight for srsCoverage=1 only → score 25', () => {
      const result = computeReadinessScore(
        {
          srsCoverage: 1,
          recentAccuracy14d: 0,
          domainSpread: 0,
          timePressure: 0,
        },
        50,
      );
      expect(result.score).toBe(25);
    });

    it('applies correct weight for domainSpread=1 only → score 20', () => {
      const result = computeReadinessScore(
        {
          srsCoverage: 0,
          recentAccuracy14d: 0,
          domainSpread: 1,
          timePressure: 0,
        },
        50,
      );
      expect(result.score).toBe(20);
    });

    it('applies correct weight for timePressure=1 only → score 15', () => {
      const result = computeReadinessScore(
        {
          srsCoverage: 0,
          recentAccuracy14d: 0,
          domainSpread: 0,
          timePressure: 1,
        },
        50,
      );
      expect(result.score).toBe(15);
    });

    it('computes mixed signals correctly', () => {
      // 0.5*0.25 + 0.8*0.40 + 0.6*0.20 + 0.4*0.15 = 0.125+0.32+0.12+0.06 = 0.625 → 63
      const result = computeReadinessScore(
        {
          srsCoverage: 0.5,
          recentAccuracy14d: 0.8,
          domainSpread: 0.6,
          timePressure: 0.4,
        },
        60,
      );
      expect(result.score).toBe(63);
    });
  });

  describe('confidence calculation', () => {
    it('returns confidence 0 when attempts is 0', () => {
      const result = computeReadinessScore(allZero, 0);
      expect(result.confidence).toBe(0);
    });

    it('returns confidence 0.5 at 50 attempts', () => {
      const result = computeReadinessScore(allZero, 50);
      expect(result.confidence).toBe(0.5);
    });

    it('caps confidence at 0.95 for attempts >= 95', () => {
      const result = computeReadinessScore(allZero, 95);
      expect(result.confidence).toBe(0.95);
    });

    it('caps confidence at 0.95 for attempts > 100', () => {
      const result = computeReadinessScore(allZero, 200);
      expect(result.confidence).toBe(0.95);
    });

    it('returns confidence proportional to attempts below 95', () => {
      const result = computeReadinessScore(allZero, 70);
      expect(result.confidence).toBeCloseTo(0.7);
    });
  });

  describe('clamp behavior', () => {
    it('clamps signal values above 1 down to 1', () => {
      const result = computeReadinessScore(
        {
          srsCoverage: 2,
          recentAccuracy14d: 1.5,
          domainSpread: 3,
          timePressure: 1.1,
        },
        100,
      );
      expect(result.score).toBe(100);
      expect(result.signals.srsCoverage).toBe(1);
      expect(result.signals.recentAccuracy14d).toBe(1);
      expect(result.signals.domainSpread).toBe(1);
      expect(result.signals.timePressure).toBe(1);
    });

    it('clamps signal values below 0 up to 0', () => {
      const result = computeReadinessScore(
        {
          srsCoverage: -1,
          recentAccuracy14d: -0.5,
          domainSpread: -2,
          timePressure: -0.1,
        },
        0,
      );
      expect(result.score).toBe(0);
      expect(result.signals.srsCoverage).toBe(0);
      expect(result.signals.recentAccuracy14d).toBe(0);
      expect(result.signals.domainSpread).toBe(0);
      expect(result.signals.timePressure).toBe(0);
    });

    it('handles NaN signal values by defaulting to 0', () => {
      const result = computeReadinessScore(
        {
          srsCoverage: NaN,
          recentAccuracy14d: NaN,
          domainSpread: NaN,
          timePressure: NaN,
        },
        0,
      );
      expect(result.score).toBe(0);
      expect(result.signals.srsCoverage).toBe(0);
    });

    it('handles Infinity signal values by defaulting to 0', () => {
      const result = computeReadinessScore(
        {
          srsCoverage: Infinity,
          recentAccuracy14d: Infinity,
          domainSpread: Infinity,
          timePressure: Infinity,
        },
        100,
      );
      expect(result.score).toBe(0);
    });
  });

  describe('returned signals reflect clamped values', () => {
    it('returns the original signal values unchanged when already in range', () => {
      const signals = {
        srsCoverage: 0.3,
        recentAccuracy14d: 0.7,
        domainSpread: 0.5,
        timePressure: 0.2,
      };
      const result = computeReadinessScore(signals, 30);
      expect(result.signals).toEqual(signals);
    });
  });
});
