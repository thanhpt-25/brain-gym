import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExamResult } from "../ExamResult";
import type { AttemptResult } from "@/types/api-types";

const choices = [
  { id: "c1", label: "a", content: "Right", isCorrect: true },
  { id: "c2", label: "b", content: "Wrong", isCorrect: false },
];

const result = (overrides: Partial<AttemptResult> = {}): AttemptResult => ({
  attemptId: "att-1",
  examId: "exam-1",
  examTitle: "Exam",
  certification: { id: "cert-1", name: "Cert", code: "C" },
  status: "SUBMITTED",
  score: 33,
  totalCorrect: 1,
  totalQuestions: 3,
  percentage: 33,
  passingScore: 72,
  passed: false,
  targetSecondsPerQuestion: 60,
  domainScores: {},
  timeSpent: 300,
  startedAt: "2026-09-28T00:00:00Z",
  submittedAt: "2026-09-28T00:05:00Z",
  questionResults: [
    {
      questionId: "q1",
      title: "Fast and wrong",
      domain: "A",
      correct: false,
      timeSpent: 4,
      suggestedMistakeType: "CARELESS",
      selectedAnswers: ["c2"],
      correctAnswers: ["c1"],
      choices,
    },
    {
      questionId: "q2",
      title: "Slow and wrong",
      domain: "A",
      correct: false,
      timeSpent: 200,
      suggestedMistakeType: "TIME_PRESSURE",
      selectedAnswers: ["c2"],
      correctAnswers: ["c1"],
      choices,
    },
    {
      questionId: "q3",
      title: "Fine",
      domain: "A",
      correct: true,
      timeSpent: 36,
      selectedAnswers: ["c1"],
      correctAnswers: ["c1"],
      choices,
    },
  ] as AttemptResult["questionResults"],
  ...overrides,
});

describe("ExamResult time analysis", () => {
  it("compares the average pace to the target and lists the slowest questions", () => {
    render(<ExamResult result={result()} onRetry={vi.fn()} onHome={vi.fn()} />);
    const section = screen.getByRole("region", { name: /time analysis/i });
    expect(section).toHaveTextContent("1m 20sAvg per question");
    expect(section).toHaveTextContent("1m 00sTarget pace");
    expect(section).toHaveTextContent("1Over target pace");
    expect(section).toHaveTextContent("Took longest:");
    expect(section).toHaveTextContent("Q2Slow and wrong3m 20s");
    expect(section).toHaveTextContent("1 wrong answer was given in under 10 seconds");
  });

  it("shows time and mistake hints next to each reviewed question", () => {
    render(<ExamResult result={result()} onRetry={vi.fn()} onHome={vi.fn()} />);
    expect(screen.getByText("Likely careless — answered very quickly")).toBeInTheDocument();
    expect(
      screen.getByText("Likely time pressure — well over the target pace"),
    ).toBeInTheDocument();
    expect(screen.getByText("Pass mark 72%", { exact: false })).toBeInTheDocument();
  });

  it("hides the analysis when no per-question time was recorded", () => {
    const r = result();
    r.questionResults = r.questionResults.map((q) => ({ ...q, timeSpent: undefined }));
    render(<ExamResult result={r} onRetry={vi.fn()} onHome={vi.fn()} />);
    expect(screen.queryByRole("region", { name: /time analysis/i })).not.toBeInTheDocument();
  });
});
