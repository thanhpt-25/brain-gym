import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useQuestionTimer } from "../useQuestionTimer";

describe("useQuestionTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("accumulates time per question across visits", () => {
    const { result, rerender } = renderHook(
      ({ id }) => useQuestionTimer(id, true),
      { initialProps: { id: "q1" } },
    );
    act(() => vi.advanceTimersByTime(30_000));
    rerender({ id: "q2" });
    act(() => vi.advanceTimersByTime(10_000));
    rerender({ id: "q1" });
    act(() => vi.advanceTimersByTime(5_000));

    expect(result.current.secondsOn("q1")).toBe(35);
    expect(result.current.secondsOn("q2")).toBe(10);
  });

  it("stops counting while the exam is inactive", () => {
    const { result, rerender } = renderHook(
      ({ active }) => useQuestionTimer("q1", active),
      { initialProps: { active: true } },
    );
    act(() => vi.advanceTimersByTime(10_000));
    rerender({ active: false });
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.secondsOn("q1")).toBe(10);
  });

  it("continues from times restored from a resumed attempt", () => {
    const { result } = renderHook(() => useQuestionTimer("q1", true));
    act(() => result.current.seed({ q1: 100, q2: 7 }));
    act(() => vi.advanceTimersByTime(3_000));
    expect(result.current.secondsOn("q1")).toBe(103);
    expect(result.current.secondsOn("q2")).toBe(7);
  });
});
