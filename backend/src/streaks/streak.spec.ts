import {
  toLocalDateString,
  isConsecutiveDay,
  shouldExtendStreak,
  shouldBreakStreak,
} from './streak';

describe('streak pure-function date calculations', () => {
  // ── toLocalDateString ──────────────────────────────────────────────────────

  describe('toLocalDateString', () => {
    it('returns YYYY-MM-DD in the given timezone', () => {
      // 2024-03-10T10:00:00Z = 2024-03-10T03:00:00 PDT (UTC-7 after spring-forward)
      const utc = new Date('2024-03-10T10:00:00.000Z');
      expect(toLocalDateString(utc, 'America/Los_Angeles')).toBe('2024-03-10');
    });

    it('returns previous calendar day when UTC is ahead of local midnight', () => {
      // 2024-03-10T00:30:00Z = 2024-03-09T16:30:00 PST (UTC-8, before spring-forward)
      const utc = new Date('2024-03-10T00:30:00.000Z');
      expect(toLocalDateString(utc, 'America/Los_Angeles')).toBe('2024-03-09');
    });

    it('handles UTC+9 (Asia/Tokyo) crossing to next day', () => {
      // 2026-05-01T15:00:00Z = 2026-05-02T00:00:00+09:00
      const utc = new Date('2026-05-01T15:00:00.000Z');
      expect(toLocalDateString(utc, 'Asia/Tokyo')).toBe('2026-05-02');
    });

    it('handles UTC timezone', () => {
      const utc = new Date('2026-04-30T23:55:00.000Z');
      expect(toLocalDateString(utc, 'UTC')).toBe('2026-04-30');
    });
  });

  // ── isConsecutiveDay ───────────────────────────────────────────────────────

  describe('isConsecutiveDay', () => {
    it('returns true when today is exactly one day after yesterday', () => {
      expect(isConsecutiveDay('2026-04-30', '2026-05-01')).toBe(true);
    });

    it('returns true across month boundary', () => {
      expect(isConsecutiveDay('2026-03-31', '2026-04-01')).toBe(true);
    });

    it('returns true across year boundary', () => {
      expect(isConsecutiveDay('2025-12-31', '2026-01-01')).toBe(true);
    });

    it('returns false when same day', () => {
      expect(isConsecutiveDay('2026-05-01', '2026-05-01')).toBe(false);
    });

    it('returns false when gap is 2 days', () => {
      expect(isConsecutiveDay('2026-04-29', '2026-05-01')).toBe(false);
    });

    it('returns false when new date is before last date', () => {
      expect(isConsecutiveDay('2026-05-01', '2026-04-30')).toBe(false);
    });
  });

  // ── DST spring-forward edge case ───────────────────────────────────────────

  describe('DST spring-forward (America/Los_Angeles 2024-03-10)', () => {
    it('activity at 01:59 local on spring-forward day yields correct date', () => {
      // 2024-03-10T09:59:00Z = 2024-03-10T01:59:00 PST (1 minute before clocks jump)
      const ts = new Date('2024-03-10T09:59:00.000Z');
      expect(toLocalDateString(ts, 'America/Los_Angeles')).toBe('2024-03-10');
    });

    it('activity at 03:01 local (after spring-forward) yields same date', () => {
      // 2024-03-10T10:01:00Z = 2024-03-10T03:01:00 PDT (UTC-7)
      const ts = new Date('2024-03-10T10:01:00.000Z');
      expect(toLocalDateString(ts, 'America/Los_Angeles')).toBe('2024-03-10');
    });

    it('consecutive-day streak across spring-forward is not broken', () => {
      const prevTs = new Date('2024-03-09T20:00:00.000Z'); // 2024-03-09 12:00 PST
      const newTs = new Date('2024-03-10T20:00:00.000Z'); // 2024-03-10 13:00 PDT

      const prevDate = toLocalDateString(prevTs, 'America/Los_Angeles');
      const newDate = toLocalDateString(newTs, 'America/Los_Angeles');

      expect(prevDate).toBe('2024-03-09');
      expect(newDate).toBe('2024-03-10');
      expect(isConsecutiveDay(prevDate, newDate)).toBe(true);
    });
  });

  // ── Activity at 23:55 local that is next day in UTC ───────────────────────

  describe('activity at 23:55 local (next day in UTC) — streak must NOT break', () => {
    it('23:55 PDT is rendered as correct local date, not UTC date', () => {
      // UTC-7 (PDT, May 2026): 2026-04-30T23:55 local = 2026-05-01T06:55Z
      const ts = new Date('2026-05-01T06:55:00.000Z');
      expect(toLocalDateString(ts, 'America/Los_Angeles')).toBe('2026-04-30');
    });

    it('streak continues: prev=2026-04-29 local, new=2026-04-30 23:55 local', () => {
      // prev: 2026-04-29T20:00Z = 2026-04-29T13:00 PDT
      // new:  2026-05-01T06:55Z = 2026-04-30T23:55 PDT
      const prevTs = new Date('2026-04-29T20:00:00.000Z');
      const newTs = new Date('2026-05-01T06:55:00.000Z');

      const prevDate = toLocalDateString(prevTs, 'America/Los_Angeles');
      const newDate = toLocalDateString(newTs, 'America/Los_Angeles');

      expect(prevDate).toBe('2026-04-29');
      expect(newDate).toBe('2026-04-30');
      expect(isConsecutiveDay(prevDate, newDate)).toBe(true);
    });
  });

  // ── Activity at 00:05 local (previous day in UTC) — streak extends ────────

  describe('activity at 00:05 local (previous day in UTC) — streak extends', () => {
    it('00:05 JST on 2026-05-02 is 2026-05-01 UTC but local date is 2026-05-02', () => {
      // UTC+9: 2026-05-02T00:05 local = 2026-05-01T15:05Z
      const ts = new Date('2026-05-01T15:05:00.000Z');
      expect(toLocalDateString(ts, 'Asia/Tokyo')).toBe('2026-05-02');
    });

    it('streak extends: prev=2026-05-01 JST, new=2026-05-02 00:05 JST', () => {
      // prev: 2026-05-01T10:00Z = 2026-05-01T19:00 JST
      // new:  2026-05-01T15:05Z = 2026-05-02T00:05 JST
      const prevTs = new Date('2026-05-01T10:00:00.000Z');
      const newTs = new Date('2026-05-01T15:05:00.000Z');

      const prevDate = toLocalDateString(prevTs, 'Asia/Tokyo');
      const newDate = toLocalDateString(newTs, 'Asia/Tokyo');

      expect(prevDate).toBe('2026-05-01');
      expect(newDate).toBe('2026-05-02');
      expect(isConsecutiveDay(prevDate, newDate)).toBe(true);
    });
  });

  // ── shouldExtendStreak ────────────────────────────────────────────────────

  describe('shouldExtendStreak', () => {
    it('returns true for consecutive day', () => {
      expect(shouldExtendStreak('2026-04-30', '2026-05-01')).toBe(true);
    });

    it('returns false for same day (already active today)', () => {
      expect(shouldExtendStreak('2026-05-01', '2026-05-01')).toBe(false);
    });

    it('returns false when gap is greater than 1 day', () => {
      expect(shouldExtendStreak('2026-04-28', '2026-05-01')).toBe(false);
    });
  });

  // ── shouldBreakStreak ─────────────────────────────────────────────────────

  describe('shouldBreakStreak', () => {
    it('returns true when gap is more than 1 day', () => {
      expect(shouldBreakStreak('2026-04-28', '2026-05-01')).toBe(true);
    });

    it('returns false for consecutive days', () => {
      expect(shouldBreakStreak('2026-04-30', '2026-05-01')).toBe(false);
    });

    it('returns false for same day', () => {
      expect(shouldBreakStreak('2026-05-01', '2026-05-01')).toBe(false);
    });
  });
});
