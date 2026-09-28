import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ExamPage from "../ExamPage";
import * as attemptsService from "@/services/attempts";
import * as examsService from "@/services/exams";
import type {
  ActiveAttemptSummary,
  AttemptResult,
  AttemptState,
  StartAttemptResponse,
} from "@/types/api-types";

vi.mock("@/services/attempts");
vi.mock("@/services/exams");
vi.mock("@/services/flashcards");
vi.mock("@/services/certifications", () => ({
  getCertificationById: vi.fn().mockResolvedValue({
    id: "cert-1",
    name: "Solutions Architect",
    code: "AWS-SAA",
    passingScore: 72,
    provider: { id: "p1", name: "AWS", slug: "aws" },
    domains: [],
  }),
}));
vi.mock("@/services/questions", () => ({
  getQuestions: vi.fn().mockResolvedValue({ data: [], meta: { total: 2 } }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const questions = [
  {
    id: "q1",
    title: "Which service stores objects?",
    questionType: "SINGLE",
    difficulty: "EASY",
    tags: [],
    sortOrder: 0,
    choices: [
      { id: "c1", label: "a", content: "EC2" },
      { id: "c2", label: "b", content: "S3" },
    ],
  },
  {
    id: "q2",
    title: "Pick the managed database",
    questionType: "SINGLE",
    difficulty: "EASY",
    tags: [],
    sortOrder: 1,
    choices: [
      { id: "d1", label: "a", content: "RDS" },
      { id: "d2", label: "b", content: "Lambda" },
    ],
  },
];

function startResponse(
  overrides: Partial<StartAttemptResponse> = {},
): StartAttemptResponse {
  return {
    attemptId: "att-1",
    examId: "exam-1",
    title: "AWS-SAA Practice Exam",
    certification: {
      id: "cert-1",
      name: "Solutions Architect",
      code: "AWS-SAA",
    },
    timeLimit: 5,
    timerMode: "STRICT",
    feedbackMode: "END_OF_EXAM",
    totalQuestions: 2,
    questions,
    ...overrides,
  };
}

const result: AttemptResult = {
  attemptId: "att-1",
  examId: "exam-1",
  examTitle: "AWS-SAA Practice Exam",
  certification: { id: "cert-1", name: "Solutions Architect", code: "AWS-SAA" },
  status: "SUBMITTED",
  score: 50,
  totalCorrect: 1,
  totalQuestions: 2,
  percentage: 50,
  passingScore: 72,
  passed: false,
  domainScores: {},
  timeSpent: 60,
  startedAt: "2026-09-25T00:00:00.000Z",
  submittedAt: "2026-09-25T00:01:00.000Z",
  questionResults: [],
};

const active: ActiveAttemptSummary = {
  attemptId: "att-9",
  examId: "exam-9",
  certificationId: "cert-1",
  title: "AWS-SAA Practice Exam",
  timerMode: "STRICT",
  feedbackMode: "END_OF_EXAM",
  answeredCount: 1,
  totalQuestions: 2,
  startedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/exam/cert-1"]}>
        <Routes>
          <Route path="/exam/:certId" element={<ExamPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ExamPage — server timer, autosave and resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(examsService.createPracticeExam).mockResolvedValue({
      id: "exam-1",
    } as never);
    vi.mocked(attemptsService.getActiveAttempt).mockResolvedValue(null);
    vi.mocked(attemptsService.saveAnswer).mockResolvedValue({});
    vi.mocked(attemptsService.submitAttempt).mockResolvedValue(result);
  });

  it("creates the exam the intro advertises: pool-sized, same pace, real pass mark", async () => {
    vi.mocked(attemptsService.startAttempt).mockResolvedValue(startResponse());
    renderPage();

    // 2 questions at the full exam's pace, floored at 5 minutes.
    expect(await screen.findByText("5m")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /start exam/i }));

    expect(examsService.createPracticeExam).toHaveBeenCalledWith({
      certificationId: "cert-1",
      questionCount: 2,
      timeLimit: 5,
      timerMode: "STRICT",
    });
  });

  it("autosaves answers and flags while the exam is in progress", async () => {
    vi.mocked(attemptsService.startAttempt).mockResolvedValue(startResponse());
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /start exam/i }),
    );

    await userEvent.click(await screen.findByRole("button", { name: /S3/ }));
    await waitFor(() =>
      expect(attemptsService.saveAnswer).toHaveBeenCalledWith(
        "att-1",
        expect.objectContaining({
          questionId: "q1",
          selectedChoices: ["c2"],
          isMarked: false,
          timeSpent: expect.any(Number),
        }),
      ),
    );
    expect(await screen.findByTestId("save-status")).toHaveTextContent("Saved");
  });

  it("counts down to the server deadline regardless of the device clock", async () => {
    // Device clock is an hour behind the server.
    const serverNow = Date.now() + 3_600_000;
    vi.mocked(attemptsService.startAttempt).mockResolvedValue(
      startResponse({
        timeLimit: 180,
        serverNow: new Date(serverNow).toISOString(),
        expiresAt: new Date(serverNow + 90_000).toISOString(),
      }),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /start exam/i }),
    );

    await screen.findByText("Which service stores objects?");
    expect(screen.getByText(/^01:(30|29)$/)).toBeInTheDocument();
  });

  it("submits automatically once the deadline has passed", async () => {
    const serverNow = Date.now();
    vi.mocked(attemptsService.startAttempt).mockResolvedValue(
      startResponse({
        serverNow: new Date(serverNow).toISOString(),
        expiresAt: new Date(serverNow - 1_000).toISOString(),
      }),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /start exam/i }),
    );

    await waitFor(() =>
      expect(attemptsService.submitAttempt).toHaveBeenCalledWith(
        "att-1",
        expect.any(Object),
      ),
    );
    expect(await screen.findByText("50%")).toBeInTheDocument();
  });

  it("resumes an unfinished attempt with its saved answers and flags", async () => {
    vi.mocked(attemptsService.getActiveAttempt).mockResolvedValue(active);
    const state: AttemptState = {
      ...startResponse({ attemptId: "att-9", examId: "exam-9" }),
      status: "IN_PROGRESS",
      answers: [{ questionId: "q1", selectedChoices: ["c2"], isMarked: true }],
      checked: [],
    };
    vi.mocked(attemptsService.getAttemptState).mockResolvedValue(state);
    renderPage();

    expect(
      await screen.findByText("You have an unfinished exam"),
    ).toBeInTheDocument();
    expect(screen.getByText(/1\/2\s+answered/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /resume exam/i }));

    expect(attemptsService.getAttemptState).toHaveBeenCalledWith("att-9");
    // Continues at the first unanswered question.
    expect(
      await screen.findByText("Pick the managed database"),
    ).toBeInTheDocument();
    expect(examsService.createPracticeExam).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /^submit$/i }));
    await userEvent.click(
      await screen.findByRole("button", { name: /^submit exam$/i }),
    );
    expect(attemptsService.submitAttempt).toHaveBeenCalledWith("att-9", {
      answers: [
        expect.objectContaining({
          questionId: "q1",
          selectedChoices: ["c2"],
          isMarked: true,
          timeSpent: expect.any(Number),
        }),
        expect.objectContaining({
          questionId: "q2",
          selectedChoices: [],
          isMarked: false,
          timeSpent: expect.any(Number),
        }),
      ],
    });
  });

  it("shows the result when the unfinished attempt was graded after time ran out", async () => {
    vi.mocked(attemptsService.getActiveAttempt).mockResolvedValue(active);
    vi.mocked(attemptsService.getAttemptState).mockResolvedValue({
      attemptId: "att-9",
      status: "SUBMITTED",
    });
    vi.mocked(attemptsService.getAttemptResult).mockResolvedValue(result);
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: /resume exam/i }),
    );

    expect(await screen.findByText("50%")).toBeInTheDocument();
    expect(attemptsService.getAttemptResult).toHaveBeenCalledWith("att-9");
  });

  it("starting over abandons the unfinished attempt first", async () => {
    vi.mocked(attemptsService.getActiveAttempt).mockResolvedValue(active);
    vi.mocked(attemptsService.abandonAttempt).mockResolvedValue({});
    vi.mocked(attemptsService.startAttempt).mockResolvedValue(startResponse());
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: /start new exam/i }),
    );

    expect(attemptsService.abandonAttempt).toHaveBeenCalledWith("att-9");
    expect(
      await screen.findByText("Which service stores objects?"),
    ).toBeInTheDocument();
  });

  it("saves an answered question with its time when moving on", async () => {
    vi.mocked(attemptsService.startAttempt).mockResolvedValue(startResponse());
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /start exam/i }),
    );
    await userEvent.click(await screen.findByRole("button", { name: /S3/ }));
    await waitFor(() => expect(attemptsService.saveAnswer).toHaveBeenCalled());
    vi.mocked(attemptsService.saveAnswer).mockClear();

    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() =>
      expect(attemptsService.saveAnswer).toHaveBeenCalledWith(
        "att-1",
        expect.objectContaining({
          questionId: "q1",
          selectedChoices: ["c2"],
          timeSpent: expect.any(Number),
        }),
      ),
    );

    // Leaving an unanswered question writes nothing.
    vi.mocked(attemptsService.saveAnswer).mockClear();
    await userEvent.click(screen.getByRole("button", { name: /prev/i }));
    await new Promise((r) => setTimeout(r, 800));
    expect(attemptsService.saveAnswer).not.toHaveBeenCalled();
  });

  it("starts a quick drill with the chosen size and domains", async () => {
    vi.mocked(attemptsService.startAttempt).mockResolvedValue(startResponse());
    renderPage();

    await userEvent.click(
      await screen.findByRole("radio", { name: /quick drill/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: "20" }));
    await userEvent.click(screen.getByRole("button", { name: /start exam/i }));

    expect(examsService.createPracticeExam).toHaveBeenCalledWith({
      certificationId: "cert-1",
      // Only 2 questions in the pool.
      questionCount: 2,
      timeLimit: 5,
      timerMode: "STRICT",
      mode: "QUICK_DRILL",
    });
  });

  it("runs a full mock on a strict timer in Exam mode", async () => {
    localStorage.setItem("exam.feedbackMode", "INTERACTIVE");
    vi.mocked(attemptsService.startAttempt).mockResolvedValue(startResponse());
    renderPage();

    await userEvent.click(
      await screen.findByRole("radio", { name: /full mock/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /start exam/i }));

    expect(examsService.createPracticeExam).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "FULL_MOCK", timerMode: "STRICT" }),
    );
    expect(attemptsService.startAttempt).toHaveBeenCalledWith("exam-1", {
      feedbackMode: "END_OF_EXAM",
    });
  });

  it("explains an empty review instead of a generic error", async () => {
    const { toast } = await import("sonner");
    vi.mocked(examsService.createPracticeExam).mockRejectedValue({
      response: { status: 422 },
    });
    renderPage();

    await userEvent.click(
      await screen.findByRole("radio", { name: /review mistakes/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /start exam/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Nothing to review yet — no missed or flagged questions.",
      ),
    );
    expect(
      await screen.findByRole("button", { name: /start exam/i }),
    ).toBeInTheDocument();
  });

  it("retries the missed questions straight from the result screen", async () => {
    vi.mocked(attemptsService.startAttempt).mockResolvedValue(startResponse());
    vi.mocked(attemptsService.getAttemptInsights).mockResolvedValue({
      attemptId: "att-1",
      certificationId: "cert-1",
      missedCount: 1,
      skippedCount: 0,
      flaggedCount: 0,
      domains: [],
      weakestDomain: null,
      trend: [],
      readiness: {
        ability: 0,
        standardError: 1,
        basedOnQuestions: 0,
        passLikelihood: null,
        passingScore: 72,
        examLength: 65,
      },
    });
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /start exam/i }),
    );
    await screen.findByText("Which service stores objects?");
    await userEvent.click(screen.getByRole("button", { name: /^submit$/i }));
    await userEvent.click(
      await screen.findByRole("button", { name: /^submit exam$/i }),
    );

    vi.mocked(examsService.createPracticeExam).mockClear();
    await userEvent.click(
      await screen.findByRole("button", { name: /retry missed \(1\)/i }),
    );
    expect(examsService.createPracticeExam).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "REVIEW",
        sourceAttemptId: "att-1",
      }),
    );
  });
});
