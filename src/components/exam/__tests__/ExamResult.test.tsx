import { describe, it, expect, vi, beforeEach } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ExamResult } from "../ExamResult";
import * as attemptsService from "@/services/attempts";
import type { AttemptInsights, AttemptResult } from "@/types/api-types";

vi.mock("@/services/attempts");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function render(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return rtlRender(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

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
    expect(section).toHaveTextContent(
      "1 wrong answer was given in under 10 seconds",
    );
  });

  it("shows time and mistake hints next to each reviewed question", () => {
    render(<ExamResult result={result()} onRetry={vi.fn()} onHome={vi.fn()} />);
    expect(
      screen.getByText("Likely careless — answered very quickly"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Likely time pressure — well over the target pace"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pass mark 72%", { exact: false }),
    ).toBeInTheDocument();
  });

  it("hides the analysis when no per-question time was recorded", () => {
    const r = result();
    r.questionResults = r.questionResults.map((q) => ({
      ...q,
      timeSpent: undefined,
    }));
    render(<ExamResult result={r} onRetry={vi.fn()} onHome={vi.fn()} />);
    expect(
      screen.queryByRole("region", { name: /time analysis/i }),
    ).not.toBeInTheDocument();
  });
});

describe("ExamResult next steps", () => {
  const insights = (
    overrides: Partial<AttemptInsights> = {},
  ): AttemptInsights => ({
    attemptId: "att-1",
    certificationId: "cert-1",
    missedCount: 2,
    skippedCount: 0,
    flaggedCount: 1,
    domains: [],
    weakestDomain: { domainId: "d2", name: "Security", percentage: 25 },
    trend: [
      {
        attemptId: "att-0",
        submittedAt: "2026-09-20T00:00:00Z",
        score: 50,
        domainScores: { Security: { correct: 1, total: 2 } },
      },
      {
        attemptId: "att-1",
        submittedAt: "2026-09-28T00:00:00Z",
        score: 33,
        domainScores: { Security: { correct: 1, total: 4 } },
      },
    ],
    readiness: {
      ability: 0.4,
      standardError: 0.3,
      basedOnQuestions: 42,
      passLikelihood: 38,
      passingScore: 72,
      examLength: 65,
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the pass likelihood and the per-domain trend", async () => {
    vi.mocked(attemptsService.getAttemptInsights).mockResolvedValue(insights());
    render(<ExamResult result={result()} onRetry={vi.fn()} onHome={vi.fn()} />);

    const likelihood = await screen.findByTestId("pass-likelihood");
    expect(likelihood).toHaveTextContent("38%");
    expect(likelihood).toHaveTextContent(
      "A 65-question exam at a 72% pass mark, based on your latest answers to 42 questions",
    );
    const trend = screen.getByRole("table", { name: /domain trend/i });
    expect(trend).toHaveTextContent("Overall50%33%");
    expect(trend).toHaveTextContent("Security50%25%");
  });

  it("starts a review of the missed questions or a drill of the weakest domain", async () => {
    vi.mocked(attemptsService.getAttemptInsights).mockResolvedValue(insights());
    const onStartPractice = vi.fn();
    render(
      <ExamResult
        result={result()}
        onRetry={vi.fn()}
        onHome={vi.fn()}
        onStartPractice={onStartPractice}
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /retry missed \(2\)/i }),
    );
    expect(onStartPractice).toHaveBeenCalledWith({
      mode: "REVIEW",
      sessionSize: 10,
      sourceAttemptId: "att-1",
    });
    await userEvent.click(
      screen.getByRole("button", { name: /drill security \(25%\)/i }),
    );
    expect(onStartPractice).toHaveBeenLastCalledWith({
      mode: "QUICK_DRILL",
      sessionSize: 10,
      domainIds: ["d2"],
    });
  });

  it("adds the missed questions to the spaced-review queue", async () => {
    vi.mocked(attemptsService.getAttemptInsights).mockResolvedValue(insights());
    vi.mocked(attemptsService.addMissedToReview).mockResolvedValue({
      added: 2,
    });
    render(<ExamResult result={result()} onRetry={vi.fn()} onHome={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", {
        name: /add 2 missed to spaced review/i,
      }),
    );
    expect(attemptsService.addMissedToReview).toHaveBeenCalledWith("att-1");
    expect(
      await screen.findByRole("link", { name: /open review queue/i }),
    ).toHaveAttribute("href", "/training");
  });

  it("omits the likelihood without history and follow-ups without mistakes", async () => {
    vi.mocked(attemptsService.getAttemptInsights).mockResolvedValue(
      insights({
        missedCount: 0,
        weakestDomain: null,
        readiness: { ...insights().readiness, passLikelihood: null },
      }),
    );
    render(
      <ExamResult
        result={result()}
        onRetry={vi.fn()}
        onHome={vi.fn()}
        onStartPractice={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("region", { name: /next steps/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("pass-likelihood")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /retry missed/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /spaced review/i }),
    ).not.toBeInTheDocument();
  });
});

describe("ExamResult adaptive test", () => {
  it("leads with the measured ability, not the percentage", async () => {
    vi.mocked(attemptsService.getAttemptInsights).mockResolvedValue(
      undefined as never,
    );
    render(
      <ExamResult
        result={result({
          percentage: 55,
          passed: true,
          cat: {
            ability: 1.3,
            standardError: 0.29,
            itemsAdministered: 14,
            maxItems: 30,
            stoppedBy: "PRECISION",
            passLikelihood: 81,
          },
        })}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />,
    );
    const summary = screen.getByRole("region", {
      name: /adaptive test result/i,
    });
    expect(summary).toHaveTextContent("81%Chance to pass");
    expect(summary).toHaveTextContent("+1.30Ability (± 0.29)");
    expect(summary).toHaveTextContent("14/30Questions");
    expect(summary).toHaveTextContent(
      "Stopped early: your level was measured precisely enough.",
    );
    expect(screen.getByText(/PASSED/)).toBeInTheDocument();
  });
});
