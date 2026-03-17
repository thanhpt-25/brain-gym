/**
 * Lightweight daily streak tracker using localStorage.
 * Streak increments when user completes at least 1 training session per day.
 */

const STREAK_KEY = 'certgym_streak';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  totalDaysActive: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { currentStreak: 0, longestStreak: 0, lastActiveDate: '', totalDaysActive: 0 };
}

function save(data: StreakData) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

/** Call when user completes a training session. Returns updated streak data. */
export function recordActivity(): StreakData {
  const data = load();
  const t = today();

  if (data.lastActiveDate === t) return data; // already recorded today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (data.lastActiveDate === yesterdayStr) {
    data.currentStreak += 1;
  } else {
    data.currentStreak = 1;
  }

  data.lastActiveDate = t;
  data.totalDaysActive += 1;
  data.longestStreak = Math.max(data.longestStreak, data.currentStreak);

  save(data);
  return data;
}

/** Get current streak data without modifying it. */
export function getStreakData(): StreakData {
  const data = load();
  const t = today();

  // If last active was before yesterday, streak is broken
  if (data.lastActiveDate && data.lastActiveDate !== t) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (data.lastActiveDate < yesterday.toISOString().slice(0, 10)) {
      data.currentStreak = 0;
      save(data);
    }
  }

  return data;
}
