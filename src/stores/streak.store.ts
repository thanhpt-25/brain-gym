import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  totalDaysActive: number;
  recordActivity: () => void;
  checkStreak: () => void;
}

const today = (): string => new Date().toISOString().slice(0, 10);

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: '',
      totalDaysActive: 0,

      checkStreak: () => {
        const { lastActiveDate, currentStreak } = get();
        if (!lastActiveDate) return;

        const t = today();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);

        if (lastActiveDate !== t && lastActiveDate < yesterdayStr) {
          // Streak broken
          if (currentStreak > 0) {
            set({ currentStreak: 0 });
          }
        }
      },

      recordActivity: () => {
        const state = get();
        const t = today();

        if (state.lastActiveDate === t) return; // already recorded today

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);

        const newStreak = state.lastActiveDate === yesterdayStr ? state.currentStreak + 1 : 1;

        set({
          currentStreak: newStreak,
          longestStreak: Math.max(state.longestStreak, newStreak),
          lastActiveDate: t,
          totalDaysActive: state.totalDaysActive + 1,
        });
      },
    }),
    {
      name: 'certgym-streak-storage',
    }
  )
);

// Backward compatible shims for existing code
export function recordActivity() {
  useStreakStore.getState().recordActivity();
  return getStreakData();
}

export function getStreakData() {
  useStreakStore.getState().checkStreak();
  const state = useStreakStore.getState();
  return {
    currentStreak: state.currentStreak,
    longestStreak: state.longestStreak,
    lastActiveDate: state.lastActiveDate,
    totalDaysActive: state.totalDaysActive,
  };
}
