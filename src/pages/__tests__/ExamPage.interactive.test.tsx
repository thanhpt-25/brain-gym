import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import ExamPage from "../ExamPage";
import * as attemptsService from "@/services/attempts";
import * as examsService from "@/services/exams";
import type {
  AttemptResult,
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
    provider: { id: "p1", name: "AWS", slug: "aws" },
    domains: [],
  }),
}));
vi.mock("@/services/questions", () => ({
  getQuestions: vi.fn().mockResolvedValue({ data: [], meta: { total: 2 } }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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

const startResponse = (
  feedbackMode: StartAttemptResponse["feedbackMode"],
): StartAttemptResponse => ({
  attemptId: "att-1",
  examId: "exam-1",
  title: "AWS-SAA Practice Exam",
  certification: { id: "cert-1", name: "Solutions Architect", code: "AWS-SAA" },
  timeLimit: 180,
  timerMode: "STRICT",
  feedbackMode,
  totalQuestions: 2,
  questions,
});

const result = (
  feedbackMode: AttemptResult["feedbackMode"],
): AttemptResult => ({
  attemptId: "att-1",
  examId: "exam-1",
  examTitle: "AWS-SAA Practice Exam",
  certification: { id: "cert-1", name: "Solutions Architect", code: "AWS-SAA" },
  status: "SUBMITTED",
  feedbackMode,
  score: 50,
  totalCorrect: 1,
  totalQuestions: 2,
  percentage: 50,
  domainScores: {},
  timeSpent: 60,
  startedAt: "2026-09-25T00:00:00.000Z",
  submittedAt: "2026-09-25T00:01:00.000Z",
  questionResults: [],
});

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

describe("ExamPage feedback modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(examsService.createExam).mockResolvedValue({
      id: "exam-1",
    } as never);
  });

  it("Exam mode (default) starts without Interactive and grades only on submit", async () => {
    vi.mocked(attemptsService.startAttempt).mockResolvedValue(
      startResponse("END_OF_EXAM"),
    );
    vi.mocked(attemptsService.submitAttempt).mockResolvedValue(
      result("END_OF_EXAM"),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: /start exam/i }),
    );
    expect(attemptsService.startAttempt).toHaveBeenCalledWith("exam-1", {
      feedbackMode: "END_OF_EXAM",
    });

    await screen.findByText("Which service stores objects?");
    expect(
      screen.queryByRole("button", { name: /check answer/i }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /S3/ }));
    await userEvent.click(screen.getByRole("button", { name: /^submit$/i }));

    expect(attemptsService.checkAnswer).not.toHaveBeenCalled();
    expect(attemptsService.submitAttempt).toHaveBeenCalledWith("att-1", {
      answers: [
        { questionId: "q1", selectedChoices: ["c2"], isMarked: false },
        { questionId: "q2", selectedChoices: [], isMarked: false },
      ],
    });
    expect(await screen.findByText("50%")).toBeInTheDocument();
    expect(screen.queryByText("Interactive")).not.toBeInTheDocument();
  });

  it("Interactive mode: check → explanation → locked → next → retry on error → finish", async () => {
    vi.mocked(attemptsService.startAttempt).mockResolvedValue(
      startResponse("INTERACTIVE"),
    );
    vi.mocked(attemptsService.checkAnswer)
      .mockResolvedValueOnce({
        questionId: "q1",
        isCorrect: false,
        selectedChoiceIds: ["c1"],
        correctChoiceIds: ["c2"],
        explanation: "S3 is object storage.",
        checkedAt: "2026-09-25T00:00:10.000Z",
      })
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce({
        questionId: "q2",
        isCorrect: true,
        selectedChoiceIds: ["d1"],
        correctChoiceIds: ["d1"],
        explanation: null,
        checkedAt: "2026-09-25T00:00:20.000Z",
      });
    vi.mocked(attemptsService.submitAttempt).mockResolvedValue(
      result("INTERACTIVE"),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole("radio", { name: /interactive/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /start exam/i }));
    expect(attemptsService.startAttempt).toHaveBeenCalledWith("exam-1", {
      feedbackMode: "INTERACTIVE",
    });
    // The choice is remembered for next time.
    expect(localStorage.getItem("exam.feedbackMode")).toBe("INTERACTIVE");

    // Q1: answer wrong and check.
    await screen.findByText("Which service stores objects?");
    await userEvent.click(screen.getByRole("button", { name: /EC2/ }));
    await userEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(attemptsService.checkAnswer).toHaveBeenCalledWith("att-1", {
      questionId: "q1",
      selectedChoices: ["c1"],
      isMarked: false,
    });
    const panel = await screen.findByTestId("answer-feedback");
    expect(within(panel).getByText("Incorrect")).toBeInTheDocument();
    expect(within(panel).getByText("S3 is object storage.")).toBeInTheDocument();

    // Locked: the answer cannot change any more.
    expect(screen.getByRole("button", { name: /S3/ })).toBeDisabled();

    // Q2: the first check fails, the learner can retry.
    await userEvent.click(
      screen.getByRole("button", { name: /next question/i }),
    );
    await screen.findByText("Pick the managed database");
    await userEvent.click(screen.getByRole("button", { name: /RDS/ }));
    await userEvent.click(screen.getByRole("button", { name: /check answer/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Could not check answer. Please try again.",
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(await screen.findByText("Correct!")).toBeInTheDocument();
    expect(
      screen.getByText("No explanation available for this question yet."),
    ).toBeInTheDocument();

    // Finish submits every question, as in Exam mode.
    await userEvent.click(screen.getByRole("button", { name: /finish exam/i }));
    expect(attemptsService.submitAttempt).toHaveBeenCalledWith("att-1", {
      answers: [
        { questionId: "q1", selectedChoices: ["c1"], isMarked: false },
        { questionId: "q2", selectedChoices: ["d1"], isMarked: false },
      ],
    });
    expect(await screen.findByText("Interactive")).toBeInTheDocument();
  });

  it("restores the stored verdict when the server says the question was already checked", async () => {
    vi.mocked(attemptsService.startAttempt).mockResolvedValue(
      startResponse("INTERACTIVE"),
    );
    // e.g. the page was reloaded after checking q1 with "EC2".
    vi.mocked(attemptsService.checkAnswer).mockRejectedValueOnce({
      response: {
        status: 409,
        data: {
          message: "Answer already checked",
          result: {
            questionId: "q1",
            isCorrect: false,
            selectedChoiceIds: ["c1"],
            correctChoiceIds: ["c2"],
            explanation: "S3 is object storage.",
            checkedAt: "2026-09-25T00:00:10.000Z",
          },
        },
      },
    });
    renderPage();

    await userEvent.click(
      await screen.findByRole("radio", { name: /interactive/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /start exam/i }));
    await screen.findByText("Which service stores objects?");
    await userEvent.click(screen.getByRole("button", { name: /S3/ }));
    await userEvent.click(screen.getByRole("button", { name: /check answer/i }));

    const panel = await screen.findByTestId("answer-feedback");
    expect(within(panel).getByText("Incorrect")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    // The locked answer (EC2) replaces the local selection.
    expect(screen.getByLabelText("Your answer")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /next question/i }),
    ).toBeInTheDocument();
  });

  it("Time Pressure always starts in Exam mode even if Interactive was remembered", async () => {
    localStorage.setItem("exam.feedbackMode", "INTERACTIVE");
    vi.mocked(attemptsService.startAttempt).mockResolvedValue(
      startResponse("END_OF_EXAM"),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: /^time pressure/i }),
    );
    expect(screen.getByRole("radio", { name: /interactive/i })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /exam/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: /start exam/i }));
    expect(attemptsService.startAttempt).toHaveBeenCalledWith("exam-1", {
      feedbackMode: "END_OF_EXAM",
    });
  });
});
