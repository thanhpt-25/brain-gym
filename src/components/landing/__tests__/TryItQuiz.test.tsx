import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TryItQuiz } from "../TryItQuiz";
import * as questionsService from "@/services/questions";
import { QuestionType, Difficulty } from "@/types/api-types";

vi.mock("@/services/questions");

const mockGetQuestions = vi.spyOn(questionsService, "getQuestions");

const certifications = [
  {
    id: "cert-1",
    code: "SAA-C03",
    name: "AWS Solutions Architect Associate",
    provider: "AWS",
    description: "desc",
    icon: "☁️",
    questionCount: 10,
    timeMinutes: 130,
    passingScore: 72,
  },
];

function makeQuestion(id: string, explanation: string) {
  return {
    id,
    title: `Question ${id}`,
    questionType: QuestionType.SINGLE,
    choices: [
      { label: "a", content: "Right answer", isCorrect: true },
      { label: "b", content: "Wrong answer", isCorrect: false },
    ],
    explanation,
    difficulty: Difficulty.EASY,
    certificationId: "cert-1",
  };
}

function renderQuiz() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TryItQuiz certifications={certifications as never} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TryItQuiz", () => {
  it("scores an answer and offers sign-up instead of the redacted explanation", async () => {
    mockGetQuestions.mockResolvedValue({
      data: [makeQuestion("q1", "Log in to view the detailed explanation.")],
      meta: { total: 1, page: 1, lastPage: 1 },
    });

    renderQuiz();
    fireEvent.click(screen.getByRole("button", { name: /start free quiz/i }));

    await waitFor(() => expect(screen.getByText("Question q1")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Right answer"));

    expect(
      screen.getByRole("button", { name: /sign up free to see the full explanation/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /see results/i }));

    expect(screen.getByText("1/1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create free account/i })).toBeInTheDocument();
  });

  it("shows the real explanation when it isn't redacted", async () => {
    mockGetQuestions.mockResolvedValue({
      data: [makeQuestion("q1", "Because IAM roles avoid long-lived credentials.")],
      meta: { total: 1, page: 1, lastPage: 1 },
    });

    renderQuiz();
    fireEvent.click(screen.getByRole("button", { name: /start free quiz/i }));

    await waitFor(() => expect(screen.getByText("Question q1")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Wrong answer"));

    expect(
      screen.getByText(/because iam roles avoid long-lived credentials/i),
    ).toBeInTheDocument();
  });
});
