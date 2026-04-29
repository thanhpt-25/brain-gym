/**
 * SM-2 Spaced Repetition Algorithm
 *
 * Based on the original SM-2 algorithm by Piotr Wozniak.
 * Quality scale: 0-5
 *   0 - complete blackout
 *   1 - incorrect, serious error
 *   2 - incorrect, remembered on hint
 *   3 - correct, with serious difficulty
 *   4 - correct, after hesitation
 *   5 - perfect response
 *
 * UI mapping: Again=2, Hard=3, Good=4, Easy=5
 */

export enum FlashcardMastery {
  NEW = 'NEW',
  LEARNING = 'LEARNING',
  REVIEW = 'REVIEW',
  MASTERED = 'MASTERED',
}

export interface SM2Input {
  quality: number;
  prevIntervalDays: number;
  prevRepetitions: number;
  prevEaseFactor: number;
  prevLapses: number;
}

export interface SM2Output {
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
  lapses: number;
  mastery: FlashcardMastery;
}

const MIN_EASE_FACTOR = 1.3;

/**
 * Compute mastery level based on composite rule (TD2):
 *   NEW      — repetitions === 0
 *   LEARNING — repetitions < 3 || easeFactor < 2.0
 *   REVIEW   — repetitions < 6 && lapses < 2
 *   MASTERED — repetitions >= 6 && easeFactor >= 2.5 && lapses < 3
 *
 * Note: MASTERED takes priority over REVIEW when all conditions are met.
 */
function computeMastery(
  repetitions: number,
  easeFactor: number,
  lapses: number,
): FlashcardMastery {
  if (repetitions === 0) {
    return FlashcardMastery.NEW;
  }
  if (repetitions >= 6 && easeFactor >= 2.5 && lapses < 3) {
    return FlashcardMastery.MASTERED;
  }
  if (repetitions < 3 || easeFactor < 2.0) {
    return FlashcardMastery.LEARNING;
  }
  return FlashcardMastery.REVIEW;
}

/**
 * Pure SM-2 calculation. No side effects.
 */
export function calculateSM2(input: SM2Input): SM2Output {
  const {
    quality,
    prevIntervalDays,
    prevRepetitions,
    prevEaseFactor,
    prevLapses,
  } = input;

  if (quality < 0 || quality > 5) {
    throw new RangeError(`quality must be 0-5, got ${quality}`);
  }

  let repetitions: number;
  let intervalDays: number;
  let easeFactor: number;
  let lapses: number;

  if (quality < 3) {
    // Incorrect response — reset repetitions, increment lapses, restart interval
    repetitions = 0;
    intervalDays = 1;
    lapses = prevLapses + 1;
    // EF is not updated on failure per original SM-2; keep previous value
    easeFactor = Math.max(MIN_EASE_FACTOR, prevEaseFactor);
  } else {
    // Correct response — advance repetitions and update EF
    lapses = prevLapses;

    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    const efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    easeFactor = Math.max(MIN_EASE_FACTOR, prevEaseFactor + efDelta);

    // Interval schedule
    if (prevRepetitions === 0) {
      repetitions = 1;
      intervalDays = 1;
    } else if (prevRepetitions === 1) {
      repetitions = 2;
      intervalDays = 6;
    } else {
      repetitions = prevRepetitions + 1;
      intervalDays = Math.round(prevIntervalDays * easeFactor);
    }
  }

  const mastery = computeMastery(repetitions, easeFactor, lapses);

  return { intervalDays, repetitions, easeFactor, lapses, mastery };
}
