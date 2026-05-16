// RFC-008 (Sprint 5 US-503) — Behavioral Insights v0 thresholds & queue names.
//
// Tuning notes:
// - LONG_STEM_WORDS: heuristic split at 200 words (per US-503 spec).
// - MIN_EVIDENCE_*: every pattern function returns `null` below its minimum
//   evidence count so the FE banner never shows a low-confidence insight.
// - LOOKBACK_DAYS: matches the spec's "last 14 days" rolling window.

export const BEHAVIORAL_QUEUE = 'insights:behavioral';
export const BEHAVIORAL_NIGHTLY_JOB = 'insights:behavioral:nightly';

/** Words in `title + description` above which a question stem is considered "long". */
export const LONG_STEM_WORDS = 200;

/** Boundary between "early" and "late" session minutes for accuracy-decline. */
export const ACCURACY_WINDOW_MINUTES = 30;

/** Days a domain must be unseen before `domain_streak_break` is considered. */
export const STREAK_BREAK_GAP_DAYS = 7;

/** Rolling window the nightly job inspects. */
export const LOOKBACK_DAYS = 14;

/** Minimum answered questions required for each pattern to emit a row. */
export const MIN_EVIDENCE_LONG_STEMS = 20;
export const MIN_EVIDENCE_ACCURACY_DECLINE = 20;
export const MIN_EVIDENCE_STREAK_BREAK = 10;

/** Minimum delta required for the pattern to be "actionable" (not noise). */
export const MIN_DELTA_LONG_STEMS = 0.15; // 15% slower on long stems
export const MIN_DROP_ACCURACY_DECLINE = 0.1; // 10pp accuracy drop

/** Insight kind discriminator stored in `behavioral_insights.kind`. */
export const InsightKind = {
  SLOW_ON_LONG_STEMS: 'slow_on_long_stems',
  ACCURACY_DECLINE_AFTER_30MIN: 'accuracy_decline_after_30min',
  DOMAIN_STREAK_BREAK: 'domain_streak_break',
} as const;

export type InsightKind = (typeof InsightKind)[keyof typeof InsightKind];
