// RFC-008 (Sprint 5 US-503) — pure pattern unit tests.
// Goal: 100% branch coverage on the three detectors.
import {
  AnswerRow,
  detectAccuracyDeclineAfter30Min,
  detectAllInsights,
  detectDomainStreakBreak,
  detectSlowOnLongStems,
} from './patterns';
import { InsightKind } from './behavioral.constants';

const BASE_START = new Date('2026-05-29T10:00:00.000Z');

function makeAnswer(overrides: Partial<AnswerRow> = {}): AnswerRow {
  return {
    timeSpentMs: 30_000,
    stemWordCount: 100,
    answeredAt: new Date(BASE_START.getTime() + 60_000),
    attemptStartedAt: BASE_START,
    isCorrect: true,
    domainId: 'd1',
    ...overrides,
  };
}

describe('detectSlowOnLongStems', () => {
  it('returns null when evidence is below floor', () => {
    const answers = Array.from({ length: 10 }, () => makeAnswer());
    expect(detectSlowOnLongStems(answers)).toBeNull();
  });

  it('returns null when only one bucket has data', () => {
    const answers = Array.from({ length: 25 }, () =>
      makeAnswer({ stemWordCount: 50 }),
    );
    expect(detectSlowOnLongStems(answers)).toBeNull();
  });

  it('returns null when slowdown is below MIN_DELTA_LONG_STEMS', () => {
    const answers: AnswerRow[] = [
      ...Array.from({ length: 15 }, () =>
        makeAnswer({ stemWordCount: 50, timeSpentMs: 30_000 }),
      ),
      ...Array.from({ length: 15 }, () =>
        makeAnswer({ stemWordCount: 300, timeSpentMs: 31_500 }),
      ),
    ];
    expect(detectSlowOnLongStems(answers)).toBeNull();
  });

  it('emits insight when delta exceeds floor', () => {
    const answers: AnswerRow[] = [
      ...Array.from({ length: 15 }, () =>
        makeAnswer({ stemWordCount: 50, timeSpentMs: 40_000 }),
      ),
      ...Array.from({ length: 15 }, () =>
        makeAnswer({ stemWordCount: 300, timeSpentMs: 80_000 }),
      ),
    ];
    const result = detectSlowOnLongStems(answers);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe(InsightKind.SLOW_ON_LONG_STEMS);
    expect(result!.payload.avgMsLong).toBe(80_000);
    expect(result!.payload.avgMsShort).toBe(40_000);
    expect(result!.payload.delta).toBeCloseTo(1.0, 3);
    expect(result!.evidenceCount).toBe(30);
  });

  it('ignores rows with non-positive or non-finite time', () => {
    const answers: AnswerRow[] = [
      ...Array.from({ length: 12 }, () =>
        makeAnswer({ stemWordCount: 50, timeSpentMs: 30_000 }),
      ),
      ...Array.from({ length: 12 }, () =>
        makeAnswer({ stemWordCount: 300, timeSpentMs: 60_000 }),
      ),
      makeAnswer({ stemWordCount: 300, timeSpentMs: 0 }),
      makeAnswer({ stemWordCount: 300, timeSpentMs: Number.NaN }),
    ];
    const result = detectSlowOnLongStems(answers);
    expect(result).not.toBeNull();
    expect(result!.evidenceCount).toBe(24);
  });
});

describe('detectAccuracyDeclineAfter30Min', () => {
  function answerAtMinutes(min: number, isCorrect: boolean): AnswerRow {
    return makeAnswer({
      answeredAt: new Date(BASE_START.getTime() + min * 60_000),
      isCorrect,
    });
  }

  it('returns null when evidence below floor', () => {
    const answers: AnswerRow[] = [
      ...Array.from({ length: 5 }, () => answerAtMinutes(5, true)),
      ...Array.from({ length: 5 }, () => answerAtMinutes(40, false)),
    ];
    expect(detectAccuracyDeclineAfter30Min(answers)).toBeNull();
  });

  it('returns null when one bucket has fewer than 10', () => {
    const answers: AnswerRow[] = [
      ...Array.from({ length: 25 }, () => answerAtMinutes(5, true)),
      ...Array.from({ length: 5 }, () => answerAtMinutes(40, false)),
    ];
    expect(detectAccuracyDeclineAfter30Min(answers)).toBeNull();
  });

  it('returns null when drop below MIN_DROP_ACCURACY_DECLINE', () => {
    const answers: AnswerRow[] = [
      ...Array.from({ length: 9 }, () => answerAtMinutes(5, true)),
      answerAtMinutes(5, false),
      ...Array.from({ length: 17 }, (_, i) => answerAtMinutes(35, i < 15)),
    ];
    expect(detectAccuracyDeclineAfter30Min(answers)).toBeNull();
  });

  it('emits insight when drop exceeds floor', () => {
    const answers: AnswerRow[] = [
      ...Array.from({ length: 18 }, () => answerAtMinutes(5, true)),
      ...Array.from({ length: 2 }, () => answerAtMinutes(5, false)),
      ...Array.from({ length: 10 }, () => answerAtMinutes(35, false)),
      ...Array.from({ length: 5 }, () => answerAtMinutes(45, true)),
    ];
    const result = detectAccuracyDeclineAfter30Min(answers);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe(InsightKind.ACCURACY_DECLINE_AFTER_30MIN);
    expect(result!.payload.firstWindow).toBeCloseTo(0.9, 3);
    expect(result!.payload.secondWindow).toBeCloseTo(5 / 15, 3);
    expect(result!.payload.earlyCount).toBe(20);
    expect(result!.payload.lateCount).toBe(15);
  });

  it('skips ungraded answers (isCorrect=null)', () => {
    const answers: AnswerRow[] = [
      ...Array.from({ length: 5 }, () => answerAtMinutes(5, true)),
      ...Array.from({ length: 5 }, () =>
        makeAnswer({ answeredAt: BASE_START, isCorrect: null }),
      ),
      ...Array.from({ length: 5 }, () => answerAtMinutes(40, false)),
    ];
    expect(detectAccuracyDeclineAfter30Min(answers)).toBeNull();
  });

  it('skips rows where answeredAt precedes attemptStartedAt', () => {
    const answers: AnswerRow[] = [
      ...Array.from({ length: 25 }, () => answerAtMinutes(-5, true)),
      ...Array.from({ length: 15 }, () => answerAtMinutes(40, false)),
    ];
    expect(detectAccuracyDeclineAfter30Min(answers)).toBeNull();
  });
});

describe('detectDomainStreakBreak', () => {
  const REF = new Date('2026-05-29T00:00:00.000Z');

  function answerOnDay(domain: string, daysAgo: number): AnswerRow {
    return makeAnswer({
      domainId: domain,
      answeredAt: new Date(REF.getTime() - daysAgo * 86_400_000),
    });
  }

  it('returns null below evidence floor', () => {
    const answers = Array.from({ length: 5 }, () => answerOnDay('a', 0));
    expect(detectDomainStreakBreak(answers, REF)).toBeNull();
  });

  it('returns null when no domain crosses the gap threshold', () => {
    const answers: AnswerRow[] = [
      ...Array.from({ length: 10 }, () => answerOnDay('a', 1)),
      ...Array.from({ length: 5 }, () => answerOnDay('b', 2)),
    ];
    expect(detectDomainStreakBreak(answers, REF)).toBeNull();
  });

  it('reports the stalest domain when one crosses the gap', () => {
    const answers: AnswerRow[] = [
      ...Array.from({ length: 5 }, () => answerOnDay('a', 12)),
      ...Array.from({ length: 8 }, () => answerOnDay('b', 1)),
    ];
    const result = detectDomainStreakBreak(answers, REF);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe(InsightKind.DOMAIN_STREAK_BREAK);
    expect(result!.payload.domainId).toBe('a');
    expect(result!.payload.gapDays).toBeCloseTo(12, 3);
    expect(result!.evidenceCount).toBe(13);
  });

  it('uses the latest answeredAt as reference when not given', () => {
    const answers: AnswerRow[] = [
      ...Array.from({ length: 5 }, () => answerOnDay('a', 12)),
      ...Array.from({ length: 8 }, () => answerOnDay('b', 2)),
    ];
    const result = detectDomainStreakBreak(answers);
    expect(result).not.toBeNull();
    expect(result!.payload.domainId).toBe('a');
    expect(result!.payload.gapDays).toBeCloseTo(10, 3);
  });

  it('skips null domainId rows from per-domain map but counts evidence', () => {
    const answers: AnswerRow[] = [
      ...Array.from({ length: 10 }, () => answerOnDay('a', 12)),
      ...Array.from({ length: 3 }, () =>
        makeAnswer({ domainId: null, answeredAt: REF }),
      ),
    ];
    const result = detectDomainStreakBreak(answers, REF);
    expect(result).not.toBeNull();
    expect(result!.evidenceCount).toBe(10);
  });
});

describe('detectAllInsights', () => {
  it('returns an empty array when no detector matches', () => {
    expect(detectAllInsights([])).toEqual([]);
  });

  it('preserves stable ordering across detectors', () => {
    const REF = new Date('2026-05-29T12:00:00.000Z');
    const oldDomainAnswers: AnswerRow[] = Array.from({ length: 12 }, () =>
      makeAnswer({
        domainId: 'a',
        answeredAt: new Date(REF.getTime() - 12 * 86_400_000),
      }),
    );
    const longStems: AnswerRow[] = [
      ...Array.from({ length: 15 }, (_, i) =>
        makeAnswer({
          stemWordCount: 50,
          timeSpentMs: 30_000,
          domainId: 'b',
          answeredAt: new Date(REF.getTime() - 60_000 * (i + 1)),
          attemptStartedAt: new Date(
            REF.getTime() - 60_000 * (i + 1) - 300_000,
          ),
        }),
      ),
      ...Array.from({ length: 15 }, (_, i) =>
        makeAnswer({
          stemWordCount: 300,
          timeSpentMs: 60_000,
          domainId: 'b',
          answeredAt: new Date(REF.getTime() - 60_000 * (i + 16)),
          attemptStartedAt: new Date(
            REF.getTime() - 60_000 * (i + 16) - 300_000,
          ),
        }),
      ),
    ];
    const decline: AnswerRow[] = [
      ...Array.from({ length: 15 }, () =>
        makeAnswer({
          isCorrect: true,
          answeredAt: new Date(REF.getTime() - 60_000),
          attemptStartedAt: new Date(REF.getTime() - 6 * 60_000),
        }),
      ),
      ...Array.from({ length: 15 }, () =>
        makeAnswer({
          isCorrect: false,
          answeredAt: new Date(REF.getTime() - 60_000),
          attemptStartedAt: new Date(REF.getTime() - 40 * 60_000),
        }),
      ),
    ];

    const result = detectAllInsights(
      [...oldDomainAnswers, ...longStems, ...decline],
      REF,
    );
    const kinds = result.map((r) => r.kind);
    expect(kinds).toEqual([
      InsightKind.SLOW_ON_LONG_STEMS,
      InsightKind.ACCURACY_DECLINE_AFTER_30MIN,
      InsightKind.DOMAIN_STREAK_BREAK,
    ]);
  });
});
