import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ExamShare from "../ExamShare";
import * as attemptsService from "@/services/attempts";
import * as examsService from "@/services/exams";
import { useAuthStore } from "@/stores/auth.store";

vi.mock("@/services/attempts");
vi.mock("@/services/exams");
vi.mock("@/components/SEO", () => ({ default: () => null }));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderShare() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/exams/exam-1"]}>
        <Routes>
          <Route path="/exams/:id" element={<ExamShare />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ExamShare feedback mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({ isAuthenticated: true });
    vi.mocked(attemptsService.startAttempt).mockResolvedValue({
      attemptId: "att-1",
      certification: { id: "cert-1" },
    } as never);
  });

  it("starts the shared exam in the selected mode", async () => {
    vi.mocked(examsService.getExamById).mockResolvedValue({
      id: "exam-1",
      title: "Shared exam",
      questionCount: 10,
      timeLimit: 20,
      timerMode: "STRICT",
    });
    renderShare();

    await userEvent.click(
      await screen.findByRole("radio", { name: /interactive/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /start exam/i }));

    await waitFor(() =>
      expect(attemptsService.startAttempt).toHaveBeenCalledWith("exam-1", {
        feedbackMode: "INTERACTIVE",
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/exam/cert-1", {
      state: { attemptData: expect.objectContaining({ attemptId: "att-1" }) },
    });
  });

  it("keeps Time Pressure exams in Exam mode", async () => {
    localStorage.setItem("exam.feedbackMode", "INTERACTIVE");
    vi.mocked(examsService.getExamById).mockResolvedValue({
      id: "exam-1",
      title: "Timed exam",
      questionCount: 65,
      timeLimit: 90,
      timerMode: "TIME_PRESSURE",
    });
    renderShare();

    expect(
      await screen.findByRole("radio", { name: /interactive/i }),
    ).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /start exam/i }));
    await waitFor(() =>
      expect(attemptsService.startAttempt).toHaveBeenCalledWith("exam-1", {
        feedbackMode: "END_OF_EXAM",
      }),
    );
  });
});
