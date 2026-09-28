import { describe, it, expect, vi, afterEach } from "vitest";
import { attemptDeadline, getPracticeExamPlan } from "../exam-plan";

describe("getPracticeExamPlan", () => {
  it("uses the full exam when the pool is large enough", () => {
    expect(getPracticeExamPlan(500, "STRICT")).toEqual({
      questionCount: 130,
      timeLimit: 180,
      effectiveMinutes: 180,
    });
    expect(getPracticeExamPlan(500, "TIME_PRESSURE")).toEqual({
      questionCount: 65,
      timeLimit: 90,
      effectiveMinutes: 90,
    });
  });

  it("keeps the full exam's pace for a smaller pool", () => {
    // 180 min / 130 q → 65 q ≈ 90 min
    expect(getPracticeExamPlan(65, "RELAXED").timeLimit).toBe(90);
    // floored at 5 minutes
    expect(getPracticeExamPlan(2, "STRICT").timeLimit).toBe(5);
  });

  it("gives ACCELERATED 0.75x of the time, as the backend does", () => {
    expect(getPracticeExamPlan(500, "ACCELERATED")).toEqual({
      questionCount: 130,
      timeLimit: 180,
      effectiveMinutes: 135,
    });
  });
});

describe("attemptDeadline", () => {
  afterEach(() => vi.useRealTimers());

  it("corrects for client clock skew using serverNow", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T10:00:00Z"));
    // Server is 10 minutes ahead; 30 minutes left on the server.
    expect(
      attemptDeadline({
        serverNow: "2026-09-28T10:10:00Z",
        expiresAt: "2026-09-28T10:40:00Z",
      }),
    ).toBe(Date.parse("2026-09-28T10:30:00Z"));
  });

  it("falls back to the time limit without a server deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T10:00:00Z"));
    expect(attemptDeadline({ timeLimit: 20 })).toBe(
      Date.parse("2026-09-28T10:20:00Z"),
    );
  });
});
