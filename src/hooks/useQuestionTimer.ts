import { useCallback, useEffect, useRef } from "react";

/**
 * Tracks how long the learner actually looks at each question: time counts
 * for the question on screen while the exam is active and the tab is visible.
 * Values are cumulative across visits and can be seeded from a resumed attempt.
 */
export function useQuestionTimer(
  currentQuestionId: string | null,
  isActive: boolean,
) {
  const totals = useRef(new Map<string, number>());
  const running = useRef<{ id: string; since: number } | null>(null);

  const stop = useCallback(() => {
    const r = running.current;
    if (!r) return;
    totals.current.set(
      r.id,
      (totals.current.get(r.id) ?? 0) + (Date.now() - r.since),
    );
    running.current = null;
  }, []);

  useEffect(() => {
    const start = () => {
      stop();
      if (
        isActive &&
        currentQuestionId &&
        document.visibilityState !== "hidden"
      ) {
        running.current = { id: currentQuestionId, since: Date.now() };
      }
    };
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      document.removeEventListener("visibilitychange", start);
      stop();
    };
  }, [currentQuestionId, isActive, stop]);

  /** Whole seconds spent on a question so far, including the running visit. */
  const secondsOn = useCallback((questionId: string): number => {
    let ms = totals.current.get(questionId) ?? 0;
    const r = running.current;
    if (r && r.id === questionId) ms += Date.now() - r.since;
    return Math.floor(ms / 1000);
  }, []);

  /** Replace all totals (seconds per question), e.g. from a resumed attempt. */
  const seed = useCallback((seconds: Record<string, number>) => {
    totals.current = new Map(
      Object.entries(seconds).map(([id, s]) => [id, s * 1000]),
    );
    if (running.current) running.current.since = Date.now();
  }, []);

  return { secondsOn, seed };
}
