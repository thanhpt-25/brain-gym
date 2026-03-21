import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useStreakStore } from '../stores/streak.store';

describe('Streak Store', () => {
  beforeEach(() => {
    useStreakStore.setState({
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: '',
      totalDaysActive: 0,
    });
    vi.useFakeTimers();
  });

  it('should start with 0 streak', () => {
    const state = useStreakStore.getState();
    expect(state.currentStreak).toBe(0);
  });

  it('should increment streak on recordActivity', () => {
    const date = new Date(Date.UTC(2026, 2, 21)); // March 21 UTC
    vi.setSystemTime(date);

    useStreakStore.getState().recordActivity();
    expect(useStreakStore.getState().currentStreak).toBe(1);
    expect(useStreakStore.getState().lastActiveDate).toBe('2026-03-21');
  });

  it('should increment streak on consecutive days', () => {
    // Record for Day 1
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 21)));
    useStreakStore.getState().recordActivity();

    // Move to Day 2
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 22)));
    useStreakStore.getState().recordActivity();

    expect(useStreakStore.getState().currentStreak).toBe(2);
    expect(useStreakStore.getState().longestStreak).toBe(2);
  });

  it('should break streak on non-consecutive days', () => {
    // Record for Day 1
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 21)));
    useStreakStore.getState().recordActivity();

    // Skip to Day 3
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 23)));
    useStreakStore.getState().checkStreak(); // manually check
    useStreakStore.getState().recordActivity();

    expect(useStreakStore.getState().currentStreak).toBe(1); // Reset and incremented
  });
});
