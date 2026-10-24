import type { FeedbackMode, TimerMode } from "@/types/api-types";

const STORAGE_KEY = "exam.feedbackMode";

/** Time Pressure simulates the real exam, so answers stay hidden until submit. */
export function supportsInteractive(timerMode?: TimerMode): boolean {
  return timerMode !== "TIME_PRESSURE";
}

/** The learner's last choice; storage can be unavailable (private mode etc.). */
export function loadFeedbackModePreference(): FeedbackMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "INTERACTIVE"
      ? "INTERACTIVE"
      : "END_OF_EXAM";
  } catch {
    return "END_OF_EXAM";
  }
}

export function saveFeedbackModePreference(mode: FeedbackMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Preference is a convenience only.
  }
}
