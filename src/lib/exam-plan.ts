import type { PracticeMode, TimerMode } from "@/types/api-types";

/** Full-length practice exams: question count and minutes. */
export const FULL_EXAM = {
  STANDARD: { questions: 130, minutes: 180 },
  TIME_PRESSURE: { questions: 65, minutes: 90 },
} as const;

/** ACCELERATED shrinks the time budget; the backend applies the same factor. */
export const ACCELERATED_TIME_FACTOR = 0.75;
export const MIN_EXAM_MINUTES = 5;

export interface ExamPlan {
  questionCount: number;
  /** Minutes sent to the backend when creating the exam. */
  timeLimit: number;
  /** Minutes the learner actually gets (after the ACCELERATED factor). */
  effectiveMinutes: number;
}

/** Question counts offered for short sessions (drill, review, adaptive). */
export const SHORT_SESSION_SIZES = [10, 20, 30] as const;
/** Extra-time accommodations. */
export const TIME_MULTIPLIERS = [1, 1.25, 1.5] as const;

export interface PracticeSetup {
  mode: PracticeMode;
  /** QUICK_DRILL / REVIEW / ADAPTIVE: number of questions. */
  sessionSize: number;
  /** QUICK_DRILL: only these domains (empty = all). */
  domainIds: string[];
  /** QUICK_DRILL: only these difficulties (empty = all). */
  difficulties: ("EASY" | "MEDIUM" | "HARD")[];
  /** Extra-time accommodation (1 = none). */
  timeMultiplier: number;
}

export const DEFAULT_SETUP: PracticeSetup = {
  mode: "STANDARD",
  sessionSize: 10,
  domainIds: [],
  difficulties: [],
  timeMultiplier: 1,
};

/** A full mock always runs under real-exam conditions. */
export function effectiveTimerMode(
  setup: Pick<PracticeSetup, "mode">,
  timerMode: TimerMode,
): TimerMode {
  return setup.mode === "FULL_MOCK" ? "STRICT" : timerMode;
}

/**
 * Single source of truth for the practice exam the intro advertises and the
 * exam ExamPage creates. When the question pool is smaller than a full exam,
 * the time keeps the full exam's pace (minutes per question).
 *
 * - STANDARD: 130 q / 180 min (65 / 90 with Time Pressure).
 * - FULL_MOCK: the certification's real format when known, else 65 / 90.
 * - QUICK_DRILL, REVIEW, ADAPTIVE: `sessionSize` questions at the same pace.
 * The extra-time accommodation multiplies the time.
 */
export function getPracticeExamPlan(
  poolSize: number,
  timerMode: TimerMode,
  setup: Partial<PracticeSetup> = {},
  examFormat?: { questionCount?: number; durationMinutes?: number } | null,
): ExamPlan {
  const mode = setup.mode ?? "STANDARD";
  const pace = FULL_EXAM.STANDARD.minutes / FULL_EXAM.STANDARD.questions;
  let full: { questions: number; minutes: number };
  if (mode === "FULL_MOCK") {
    full =
      examFormat?.questionCount && examFormat?.durationMinutes
        ? {
            questions: examFormat.questionCount,
            minutes: examFormat.durationMinutes,
          }
        : FULL_EXAM.TIME_PRESSURE;
  } else if (mode === "STANDARD") {
    full =
      timerMode === "TIME_PRESSURE"
        ? FULL_EXAM.TIME_PRESSURE
        : FULL_EXAM.STANDARD;
  } else {
    const size = setup.sessionSize ?? DEFAULT_SETUP.sessionSize;
    full = { questions: size, minutes: Math.ceil(size * pace) };
  }

  const questionCount = Math.max(0, Math.min(poolSize, full.questions));
  const baseMinutes =
    questionCount >= full.questions
      ? full.minutes
      : Math.max(
          MIN_EXAM_MINUTES,
          Math.ceil((full.minutes * questionCount) / full.questions),
        );
  const timeLimit = Math.ceil(baseMinutes * (setup.timeMultiplier ?? 1));
  const effectiveMinutes =
    effectiveTimerMode({ mode }, timerMode) === "ACCELERATED"
      ? Math.max(1, Math.round(timeLimit * ACCELERATED_TIME_FACTOR))
      : timeLimit;
  return { questionCount, timeLimit, effectiveMinutes };
}

/** Reading size of the question text during an exam. */
export type FontScale = "sm" | "md" | "lg";
const FONT_SCALE_KEY = "exam.fontScale";

export function loadFontScale(): FontScale {
  try {
    const v = localStorage.getItem(FONT_SCALE_KEY);
    return v === "sm" || v === "lg" ? v : "md";
  } catch {
    return "md";
  }
}

export function saveFontScale(scale: FontScale): void {
  try {
    localStorage.setItem(FONT_SCALE_KEY, scale);
  } catch {
    // Preference is a convenience only.
  }
}

/**
 * Client-clock deadline (ms) for an attempt. Uses the server deadline shifted
 * by the server/client clock offset, so a wrong device clock doesn't change
 * the time left; older responses without one fall back to the time limit.
 */
export function attemptDeadline(attempt: {
  timeLimit?: number;
  expiresAt?: string | null;
  serverNow?: string;
}): number {
  const expiresAt = attempt.expiresAt ? Date.parse(attempt.expiresAt) : NaN;
  if (!Number.isNaN(expiresAt)) {
    const serverNow = attempt.serverNow ? Date.parse(attempt.serverNow) : NaN;
    const offset = Number.isNaN(serverNow) ? 0 : Date.now() - serverNow;
    return expiresAt + offset;
  }
  return Date.now() + (attempt.timeLimit ?? 0) * 60_000;
}
