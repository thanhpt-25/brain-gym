import { useCallback, useEffect, useRef, useState } from "react";
import { saveAnswer } from "@/services/attempts";
import type { SubmitAnswerPayload } from "@/types/api-types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 600;
const RETRY_MS = 5000;

/**
 * Debounced, sequential autosave of answers/flags for an END_OF_EXAM attempt,
 * so a reload or dropped connection doesn't lose the learner's work. Only the
 * latest state per question is sent; network failures are retried, while a
 * request the server rejects (e.g. time is up) is dropped.
 */
export function useAutosave(attemptId: string | null, enabled: boolean) {
  const pending = useRef(new Map<string, SubmitAnswerPayload>());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const inFlight = useRef<Promise<void> | null>(null);
  const attemptRef = useRef(attemptId);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const run = useCallback(async () => {
    while (pending.current.size > 0 && attemptRef.current) {
      const [questionId, payload] = pending.current.entries().next().value as [
        string,
        SubmitAnswerPayload,
      ];
      pending.current.delete(questionId);
      setStatus("saving");
      try {
        await saveAnswer(attemptRef.current, payload);
      } catch (err: unknown) {
        const httpStatus = (err as { response?: { status?: number } })
          ?.response?.status;
        if (httpStatus && httpStatus >= 400 && httpStatus < 500) continue;
        // Keep the newest state if the learner changed it meanwhile.
        if (!pending.current.has(questionId)) {
          pending.current.set(questionId, payload);
        }
        setStatus("error");
        timer.current = setTimeout(() => void flush(), RETRY_MS);
        return;
      }
    }
    setStatus("saved");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = useCallback((): Promise<void> => {
    clearTimeout(timer.current);
    if (inFlight.current) {
      // The running loop picks up anything queued meanwhile.
      return inFlight.current;
    }
    if (pending.current.size === 0) return Promise.resolve();
    inFlight.current = run().finally(() => {
      inFlight.current = null;
    });
    return inFlight.current;
  }, [run]);

  const queue = useCallback(
    (payload: SubmitAnswerPayload) => {
      if (!enabled || !attemptRef.current) return;
      pending.current.set(payload.questionId, payload);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    },
    [enabled, flush],
  );

  /** Drop queued saves and wait for the one in flight (before submitting). */
  const cancel = useCallback(async () => {
    clearTimeout(timer.current);
    pending.current.clear();
    await inFlight.current?.catch(() => undefined);
  }, []);

  useEffect(() => {
    attemptRef.current = attemptId;
    clearTimeout(timer.current);
    pending.current.clear();
    setStatus("idle");
  }, [attemptId]);

  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      // Leaving the page: send what is still queued.
      void flush();
    };
  }, [flush]);

  return { status, queue, flush, cancel };
}
