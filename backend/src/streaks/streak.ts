/**
 * Pure, timezone-aware streak calculation helpers.
 *
 * All functions operate on YYYY-MM-DD date strings derived from the user's
 * local timezone so that "23:55 PST" and "00:05 JST" are both treated as
 * their respective calendar days rather than the UTC date.
 */

/**
 * Convert a UTC Date to a YYYY-MM-DD string in the given IANA timezone.
 *
 * Uses Intl.DateTimeFormat so it correctly handles DST transitions and
 * UTC-offset timezones (e.g. Asia/Tokyo UTC+9, America/Los_Angeles UTC-8/7).
 */
export function toLocalDateString(utcDate: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(utcDate);

  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';

  return `${year}-${month}-${day}`;
}

/**
 * Return the number of whole calendar days between two YYYY-MM-DD strings.
 * Result is positive when `newDate` is after `lastDate`, negative otherwise.
 */
function dayDiff(lastDate: string, newDate: string): number {
  const msPerDay = 86_400_000;
  return (Date.parse(newDate) - Date.parse(lastDate)) / msPerDay;
}

/**
 * Returns true when `newDate` is exactly one calendar day after `lastDate`.
 */
export function isConsecutiveDay(lastDate: string, newDate: string): boolean {
  return dayDiff(lastDate, newDate) === 1;
}

/**
 * Returns true when activity on `newDate` should extend the streak that last
 * fired on `lastDate` (i.e. they are consecutive calendar days).
 */
export function shouldExtendStreak(lastDate: string, newDate: string): boolean {
  return isConsecutiveDay(lastDate, newDate);
}

/**
 * Returns true when the streak should be broken because the gap between
 * `lastDate` and `newDate` is greater than one calendar day.
 */
export function shouldBreakStreak(lastDate: string, newDate: string): boolean {
  return dayDiff(lastDate, newDate) > 1;
}
