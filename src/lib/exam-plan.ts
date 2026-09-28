import type { TimerMode } from "@/types/api-types";

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

/**
 * Single source of truth for the practice exam the intro advertises and the
 * exam ExamPage creates. When the question pool is smaller than a full exam,
 * the time keeps the full exam's pace (minutes per question).
 */
export function getPracticeExamPlan(
  poolSize: number,
  timerMode: TimerMode,
): ExamPlan {
  const full =
    timerMode === "TIME_PRESSURE" ? FULL_EXAM.TIME_PRESSURE : FULL_EXAM.STANDARD;
  const questionCount = Math.max(0, Math.min(poolSize, full.questions));
  const timeLimit =
    questionCount >= full.questions
      ? full.minutes
      : Math.max(
          MIN_EXAM_MINUTES,
          Math.ceil((full.minutes * questionCount) / full.questions),
        );
  const effectiveMinutes =
    timerMode === "ACCELERATED"
      ? Math.max(1, Math.round(timeLimit * ACCELERATED_TIME_FACTOR))
      : timeLimit;
  return { questionCount, timeLimit, effectiveMinutes };
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
