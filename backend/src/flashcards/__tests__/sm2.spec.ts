import { calculateSM2, FlashcardMastery } from '../sm2';

describe('calculateSM2', () => {
  // Default "fresh card" state
  const freshCard = {
    prevIntervalDays: 0,
    prevRepetitions: 0,
    prevEaseFactor: 2.5,
    prevLapses: 0,
  };

  // 1. quality=0 (complete blackout): reset, interval=1, lapses++
  it('q=0 complete blackout: resets repetitions to 0, interval=1, increments lapses', () => {
    const result = calculateSM2({ ...freshCard, quality: 0 });

    expect(result.repetitions).toBe(0);
    expect(result.intervalDays).toBe(1);
    expect(result.lapses).toBe(1);
    expect(result.mastery).toBe(FlashcardMastery.NEW);
  });

  // 2. quality=2 (incorrect, almost remembered): reset, interval=1
  it('q=2 incorrect but almost remembered: resets repetitions, interval=1', () => {
    const result = calculateSM2({
      prevIntervalDays: 6,
      prevRepetitions: 2,
      prevEaseFactor: 2.5,
      prevLapses: 0,
      quality: 2,
    });

    expect(result.repetitions).toBe(0);
    expect(result.intervalDays).toBe(1);
    expect(result.lapses).toBe(1);
  });

  // 3. quality=3 (correct with difficulty): advances reps, EF decreases
  it('q=3 correct with serious difficulty: progresses, EF decreases', () => {
    const result = calculateSM2({ ...freshCard, quality: 3 });

    expect(result.repetitions).toBe(1);
    expect(result.intervalDays).toBe(1);
    // EF delta for q=3: 0.1 - (5-3)*(0.08 + (5-3)*0.02) = 0.1 - 2*(0.08+0.04) = 0.1 - 0.24 = -0.14
    expect(result.easeFactor).toBeCloseTo(2.5 - 0.14, 5);
    expect(result.lapses).toBe(0);
  });

  // 4. quality=4 (correct after hesitation): standard progression
  it('q=4 correct after hesitation: standard progression, EF slightly decreases', () => {
    const result = calculateSM2({ ...freshCard, quality: 4 });

    expect(result.repetitions).toBe(1);
    expect(result.intervalDays).toBe(1);
    // EF delta for q=4: 0.1 - (5-4)*(0.08 + (5-4)*0.02) = 0.1 - 1*0.10 = 0
    expect(result.easeFactor).toBeCloseTo(2.5, 5);
    expect(result.lapses).toBe(0);
  });

  // 5. quality=5 (perfect): EF increases
  it('q=5 perfect response: EF increases', () => {
    const result = calculateSM2({ ...freshCard, quality: 5 });

    expect(result.repetitions).toBe(1);
    expect(result.intervalDays).toBe(1);
    // EF delta for q=5: 0.1 - 0*(0.08 + 0*0.02) = 0.1
    expect(result.easeFactor).toBeCloseTo(2.6, 5);
    expect(result.lapses).toBe(0);
  });

  // 6. reps=2, q=4: interval = prevInterval * EF
  it('reps=2 q=4: interval = round(prevIntervalDays * newEF)', () => {
    const result = calculateSM2({
      prevIntervalDays: 6,
      prevRepetitions: 2,
      prevEaseFactor: 2.5,
      prevLapses: 0,
      quality: 4,
    });

    expect(result.repetitions).toBe(3);
    // EF stays 2.5 for q=4, interval = round(6 * 2.5) = 15
    expect(result.intervalDays).toBe(15);
  });

  // 7. EF floor at 1.3: repeated hard answers should not go below 1.3
  it('EF floor at 1.3: ease factor never drops below 1.3', () => {
    // Start with EF already near floor
    const result = calculateSM2({
      prevIntervalDays: 1,
      prevRepetitions: 1,
      prevEaseFactor: 1.35,
      prevLapses: 0,
      quality: 3,
    });

    // EF delta for q=3 is -0.14; 1.35 - 0.14 = 1.21 < 1.3, should be clamped
    expect(result.easeFactor).toBeCloseTo(1.3, 5);
  });

  // 8. mastery transitions: NEW → LEARNING → REVIEW → MASTERED
  it('mastery transitions follow composite rule', () => {
    // NEW: repetitions=0
    const newCard = calculateSM2({ ...freshCard, quality: 0 });
    expect(newCard.mastery).toBe(FlashcardMastery.NEW);

    // LEARNING: after first correct answer (reps=1 < 3)
    const learning = calculateSM2({ ...freshCard, quality: 4 });
    expect(learning.mastery).toBe(FlashcardMastery.LEARNING);

    // REVIEW: reps=3, ef>=2.0, lapses<2
    const reviewCard = calculateSM2({
      prevIntervalDays: 6,
      prevRepetitions: 3,
      prevEaseFactor: 2.5,
      prevLapses: 0,
      quality: 4,
    });
    expect(reviewCard.mastery).toBe(FlashcardMastery.REVIEW);

    // MASTERED: reps>=6, ef>=2.5, lapses<3
    const masteredCard = calculateSM2({
      prevIntervalDays: 30,
      prevRepetitions: 6,
      prevEaseFactor: 2.5,
      prevLapses: 0,
      quality: 5,
    });
    expect(masteredCard.mastery).toBe(FlashcardMastery.MASTERED);
  });

  it('throws RangeError for quality outside 0-5', () => {
    expect(() => calculateSM2({ ...freshCard, quality: -1 })).toThrow(
      RangeError,
    );
    expect(() => calculateSM2({ ...freshCard, quality: 6 })).toThrow(
      RangeError,
    );
  });
});
