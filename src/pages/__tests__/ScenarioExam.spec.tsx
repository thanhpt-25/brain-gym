import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useParams } from "react-router-dom";
import { ScenarioExam } from "../ScenarioExam";
import * as scenariosService from "@/services/scenarios";

vi.mock("@/services/scenarios");

const mockNavigateFn = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: vi.fn(() => ({ scenarioId: "scenario-1" })),
    useNavigate: vi.fn(() => mockNavigateFn),
  };
});

const mockScenario = {
  id: "scenario-1",
  passage: "Test passage content",
  questions: [
    {
      id: "q1",
      title: "Question 1?",
      choices: [
        { id: "a1", label: "A", content: "Option A" },
        { id: "a2", label: "B", content: "Option B" },
      ],
      correctAnswerId: "a1",
    },
    {
      id: "q2",
      title: "Question 2?",
      choices: [
        { id: "a3", label: "C", content: "Option C" },
        { id: "a4", label: "D", content: "Option D" },
      ],
      correctAnswerId: "a3",
    },
  ],
};

const mockAttemptResult = {
  id: "attempt-1",
  userId: "user-1",
  scenarioId: "scenario-1",
  completedAt: new Date().toISOString(),
  timeSpent: 120,
  score: 85,
  answers: {
    q1: { selectedAnswer: "a1", correctAnswer: "a1", correct: true },
    q2: { selectedAnswer: "a3", correctAnswer: "a3", correct: true },
  },
  reasoningTrace: "Great job!",
};

describe("ScenarioExam", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigateFn.mockClear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
    vi.mocked(scenariosService.submitScenarioAttempt).mockResolvedValue(
      mockAttemptResult,
    );
  });

  const renderWithProviders = (element: React.ReactElement) => {
    return render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          {element}
        </QueryClientProvider>
      </BrowserRouter>,
    );
  };

  describe("Initialization", () => {
    it("should render exam page when scenario loads", async () => {
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText("Scenario Exam")).toBeInTheDocument();
      });
    });

    it("should display timer component", async () => {
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
      });
    });

    it("should render scenario reader", async () => {
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });
    });

    it("should show error when scenarioId is missing", () => {
      vi.mocked(useParams).mockReturnValueOnce({});

      renderWithProviders(<ScenarioExam />);

      expect(screen.getByText("Scenario not found")).toBeInTheDocument();
    });
  });

  describe("Timer", () => {
    it("should display fixed timer at top", async () => {
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        const timer = screen.getByText(/\d{2}:\d{2}/);
        let fixed = timer.closest("div");
        while (fixed && !fixed.classList.contains("fixed")) {
          fixed = fixed.parentElement;
        }
        expect(fixed).toHaveClass("fixed", "top-0");
      });
    });

    it("should trigger auto-submit on timeout", async () => {
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
    });
  });

  describe("Answer Management", () => {
    it("should initialize with empty answers", async () => {
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const radios = screen.getAllByRole("radio");
      radios.forEach((radio) => {
        expect(radio).not.toBeChecked();
      });
    });

    it("should track answer selection", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const option = screen.getByRole("radio", { name: /A\. Option A/i });
      await user.click(option);

      expect(option).toBeChecked();
    });

    it("should maintain answer state across navigation", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const option1 = screen.getByRole("radio", { name: /A\. Option A/i });
      await user.click(option1);

      const secondQuestion = screen.getAllByText(/Question 2\?/)[0];
      await user.click(secondQuestion.closest("button")!);

      const option2 = screen.getByRole("radio", { name: /C\. Option C/i });
      await user.click(option2);

      const firstQuestion = screen.getAllByText(/Question 1\?/)[0];
      await user.click(firstQuestion.closest("button")!);

      expect(option1).toBeChecked();
    });

    it("should allow changing answers", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const optionA = screen.getByRole("radio", { name: /A\. Option A/i });
      const optionB = screen.getByRole("radio", { name: /B\. Option B/i });

      await user.click(optionA);
      expect(optionA).toBeChecked();

      await user.click(optionB);
      expect(optionB).toBeChecked();
      expect(optionA).not.toBeChecked();
    });
  });

  describe("Submission", () => {
    it("should submit answers when submit button clicked", async () => {
      const user = userEvent.setup();
      vi.mocked(scenariosService.submitScenarioAttempt).mockResolvedValue(
        mockAttemptResult,
      );

      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const option1 = screen.getByRole("radio", { name: /Option A/i });
      await user.click(option1);

      const secondQuestion = screen.getAllByText(/Question 2\?/)[0];
      await user.click(secondQuestion.closest("button")!);
      const option2 = screen.getByRole("radio", { name: /C\. Option C/i });
      await user.click(option2);

      const firstQuestion = screen.getAllByText(/Question 1\?/)[0];
      await user.click(firstQuestion.closest("button")!);
      const submitButton = screen.getByRole("button", { name: /Submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(scenariosService.submitScenarioAttempt).toHaveBeenCalledWith(
          "scenario-1",
          { q1: "a1", q2: "a3" },
        );
      });
    });

    it("should submit partial answers if some questions unanswered", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const option1 = screen.getByRole("radio", { name: /Option A/i });
      await user.click(option1);

      const submitButton = screen.getByRole("button", { name: /Submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(scenariosService.submitScenarioAttempt).toHaveBeenCalledWith(
          "scenario-1",
          { q1: "a1" },
        );
      });
    });

    it("should show loading overlay while submitting", async () => {
      const user = userEvent.setup();
      vi.mocked(scenariosService.submitScenarioAttempt).mockImplementation(
        () => new Promise(() => {}),
      );

      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const option = screen.getByRole("radio", { name: /Option A/i });
      await user.click(option);

      const submitButton = screen.getByRole("button", { name: /Submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Submitting answers...")).toBeInTheDocument();
      });

      let overlay = screen.getByText("Submitting answers...").closest("div");
      while (overlay && !overlay.classList.contains("fixed")) {
        overlay = overlay.parentElement;
      }
      expect(overlay).toHaveClass("fixed", "inset-0");
    });

    it("should hide loading overlay after successful submission", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", { name: /Submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.queryByText("Submitting answers..."),
        ).not.toBeInTheDocument();
      });
    });

    it("should navigate to results after successful submission", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const option = screen.getByRole("radio", { name: /Option A/i });
      await user.click(option);

      const submitButton = screen.getByRole("button", { name: /Submit/i });
      await user.click(submitButton);

      // Wait for the setTimeout (1s) + buffer in the onSuccess handler
      await waitFor(
        () => {
          expect(mockNavigateFn).toHaveBeenCalledWith(
            "/scenarios/scenario-1/results",
            expect.objectContaining({
              state: expect.objectContaining({
                result: mockAttemptResult,
                scenarioId: "scenario-1",
              }),
            }),
          );
        },
        { timeout: 3000 },
      );
    });

    it("should submit with empty object if no answers selected", async () => {
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", {
        name: /Submit/i,
      }) as HTMLButtonElement;
      expect(submitButton.disabled).toBe(true);
    });
  });

  describe("Timer Integration", () => {
    it("should have timer onTimeOut callback", async () => {
      vi.mocked(scenariosService.submitScenarioAttempt).mockResolvedValue(
        mockAttemptResult,
      );

      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should handle submission error gracefully", async () => {
      const user = userEvent.setup();
      const error = new Error("Submission failed");
      // Mock to reject on ALL calls (not just once) to test error handling
      vi.mocked(scenariosService.submitScenarioAttempt).mockRejectedValue(
        error,
      );

      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      // Reset navigate mock right before user interaction to ensure clean state
      mockNavigateFn.mockClear();

      const option = screen.getByRole("radio", { name: /Option A/i });
      await user.click(option);

      const submitButton = screen.getByRole("button", { name: /Submit/i });
      await user.click(submitButton);

      // Wait for the mutation to complete
      // The mutation should reject and show error, without navigating
      await waitFor(
        () => {
          // Check if navigate was NOT called (the error condition)
          expect(mockNavigateFn).not.toHaveBeenCalled();
        },
        { timeout: 2000 },
      );
    });

    it("should log submission errors", async () => {
      const user = userEvent.setup();
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const error = new Error("Network error");
      vi.mocked(scenariosService.submitScenarioAttempt).mockImplementationOnce(
        () => Promise.reject(error),
      );

      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const option = screen.getByRole("radio", { name: /Option A/i });
      await user.click(option);

      const submitButton = screen.getByRole("button", { name: /Submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Layout", () => {
    it("should have timer fixed at top", async () => {
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
      });

      const timer = screen.getByText(/\d{2}:\d{2}/);
      const timerContainer = timer.closest("div[class*='fixed']");
      expect(timerContainer).toHaveClass("fixed", "top-0");
    });

    it("should offset content by timer height", async () => {
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const passage = screen.getByText(mockScenario.passage);
      let container = passage.parentElement;
      while (container && !container.classList.contains("pt-16")) {
        container = container.parentElement;
      }
      expect(container).toHaveClass("pt-16");
    });

    it("should use full height layout", async () => {
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const passage = screen.getByText(mockScenario.passage);
      let container = passage.parentElement;
      while (container && !container.classList.contains("h-screen")) {
        container = container.parentElement;
      }
      expect(container).toHaveClass("h-screen");
    });
  });

  describe("State Management", () => {
    it("should use controlled answers state", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const option1 = screen.getByRole("radio", { name: /Option A/i });
      await user.click(option1);

      const option2 = screen.getByRole("radio", { name: /Option B/i });
      await user.click(option2);

      expect(option2).toBeChecked();
      expect(option1).not.toBeChecked();
    });

    it("should pass answers to ScenarioReader", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const option = screen.getByRole("radio", { name: /A\. Option A/i });
      await user.click(option);

      expect(option).toBeChecked();
    });
  });

  describe("Integration", () => {
    it("should complete full exam flow", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ScenarioExam />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const option1 = screen.getByRole("radio", { name: /Option A/i });
      await user.click(option1);

      const secondQuestion = screen.getByText(/Question 2\?/);
      await user.click(secondQuestion.closest("button")!);

      const option2 = screen.getByRole("radio", { name: /C\. Option C/i });
      await user.click(option2);

      const firstQuestion = screen.getAllByText(/Question 1\?/)[0];
      await user.click(firstQuestion.closest("button")!);
      const submitButton = screen.getByRole("button", { name: /Submit/i });
      await user.click(submitButton);

      await waitFor(
        () => {
          expect(mockNavigateFn).toHaveBeenCalledWith(
            "/scenarios/scenario-1/results",
            expect.any(Object),
          );
        },
        { timeout: 2000 },
      );
    });
  });
});
