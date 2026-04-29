export type MasteryLevel = 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED';

export interface SM2Input {
  quality: number; // 0-5
  prevInterval: number;
  prevRepetitions: number;
  prevEaseFactor: number;
  prevLapses: number;
}

export interface SM2Output {
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
  lapses: number;
  mastery: MasteryLevel;
}

/**
 * Pure SM-2 algorithm implementation.
 * quality: 0-5 (0=blackout, 3=correct with difficulty, 5=perfect)
 */
export function calculateSM2(input: SM2Input): SM2Output {
  const { quality, prevInterval, prevRepetitions, prevEaseFactor, prevLapses } =
    input;

  let intervalDays: number;
  let repetitions: number;
  let easeFactor: number;
  let lapses: number;

  if (quality >= 3) {
    // Correct response
    if (prevRepetitions === 0) {
      intervalDays = 1;
    } else if (prevRepetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(prevInterval * prevEaseFactor);
    }
    repetitions = prevRepetitions + 1;
    easeFactor =
      prevEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    lapses = prevLapses;
  } else {
    // Failed response — lapse
    repetitions = 0;
    intervalDays = 1;
    easeFactor = prevEaseFactor;
    lapses = prevLapses + 1;
  }

  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  const mastery = computeMastery(repetitions, intervalDays);

  return { intervalDays, repetitions, easeFactor, lapses, mastery };
}

export function computeMastery(
  repetitions: number,
  intervalDays: number,
): MasteryLevel {
  if (repetitions === 0) return 'NEW';
  if (repetitions < 3) return 'LEARNING';
  if (intervalDays < 21) return 'REVIEW';
  return 'MASTERED';
}
