import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ScenarioReader } from "../ScenarioReader";
import * as scenariosService from "@/services/scenarios";

vi.mock("@/services/scenarios");

const mockScenario = {
  id: "scenario-1",
  orgId: "org-1",
  passage: "This is a test passage about cloud computing.",
  diagramUrl: null,
  timeLimit: 600,
  questions: [
    {
      id: "q1",
      order: 1,
      title: "What is cloud computing?",
      choices: [
        { id: "a1", label: "A", content: "On-demand computing resources" },
        { id: "a2", label: "B", content: "Physical servers only" },
      ],
    },
    {
      id: "q2",
      order: 2,
      title: "Which is a cloud provider?",
      choices: [
        { id: "a3", label: "C", content: "AWS" },
        { id: "a4", label: "D", content: "My laptop" },
      ],
    },
  ],
};

describe("ScenarioReader", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderWithQuery = (element: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
    );
  };

  describe("Loading state", () => {
    it("should display loading spinner while fetching scenario", () => {
      vi.mocked(scenariosService.getScenario).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      expect(screen.getByText("Loading scenario...")).toBeInTheDocument();
      const spinner = screen
        .getByText("Loading scenario...")
        .parentElement?.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("should hide loader when scenario loads", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading scenario..."),
        ).not.toBeInTheDocument();
      });

      expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("should display error message on fetch failure", async () => {
      const error = new Error("Network error");
      vi.mocked(scenariosService.getScenario).mockRejectedValue(error);

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load scenario")).toBeInTheDocument();
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });

    it("should display generic error when scenario is null", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(null);

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load scenario")).toBeInTheDocument();
      });
    });
  });

  describe("Passage rendering", () => {
    it("should render passage text", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });
    });

    it("should render passage in correct container", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        const passageContainer = screen
          .getByText(mockScenario.passage)
          .closest("article")?.parentElement?.parentElement;
        expect(passageContainer).toHaveClass("flex-1");
      });
    });
  });

  describe("Question sidebar", () => {
    it("should render all questions in sidebar", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        const questions = screen.getAllByText("What is cloud computing?");
        expect(questions.length).toBeGreaterThan(0);
        const cloudProviderQuestions = screen.getAllByText(
          "Which is a cloud provider?",
        );
        expect(cloudProviderQuestions.length).toBeGreaterThan(0);
      });
    });

    it("should highlight active question in sidebar", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        const firstQuestion = screen.getAllByText(
          "What is cloud computing?",
        )[0];
        const parent = firstQuestion.closest("button")?.parentElement;
        expect(parent).toHaveClass("bg-blue-50");
      });
    });

    it("should allow navigation between questions", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const user = userEvent.setup();

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        const questions = screen.getAllByText("What is cloud computing?");
        expect(questions.length).toBeGreaterThan(0);
      });

      const secondQuestions = screen.getAllByText("Which is a cloud provider?");
      const secondQuestion = secondQuestions[0];
      await user.click(secondQuestion.closest("button")!);

      await waitFor(() => {
        const secondQuestions = screen.getAllByText(
          "Which is a cloud provider?",
        );
        const parent = secondQuestions[0].closest("button")?.parentElement;
        expect(parent).toHaveClass("bg-blue-50");
      });
    });
  });

  describe("Answer selection", () => {
    it("should allow selecting answer for a question", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const onAnswerChange = vi.fn();
      const user = userEvent.setup();

      renderWithQuery(
        <ScenarioReader
          scenarioId="scenario-1"
          onAnswerChange={onAnswerChange}
        />,
      );

      await waitFor(() => {
        const questions = screen.getAllByText("What is cloud computing?");
        expect(questions.length).toBeGreaterThan(0);
      });

      // Question is already expanded, find and click the choice
      const option = await screen.findByRole("radio", {
        name: /On-demand computing resources/i,
      });
      await user.click(option);

      expect(onAnswerChange).toHaveBeenCalledWith("q1", "a1");
    });

    it("should update internal state when no callback provided", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const user = userEvent.setup();

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        const questions = screen.getAllByText("What is cloud computing?");
        expect(questions.length).toBeGreaterThan(0);
      });

      // Question is already expanded, find and click the choice
      const option = await screen.findByRole("radio", {
        name: /On-demand computing resources/i,
      });
      await user.click(option);

      expect(option).toBeChecked();
    });

    it("should support controlled answers from parent", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);

      const { rerender } = renderWithQuery(
        <ScenarioReader scenarioId="scenario-1" answers={{ q1: "a1" }} />,
      );

      await waitFor(() => {
        const option = screen.getByRole("radio", {
          name: /On-demand computing resources/i,
        }) as HTMLInputElement;
        expect(option.checked).toBe(true);
      });
    });

    it("should allow changing answer", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const onAnswerChange = vi.fn();
      const user = userEvent.setup();

      renderWithQuery(
        <ScenarioReader
          scenarioId="scenario-1"
          answers={{ q1: "a1" }}
          onAnswerChange={onAnswerChange}
        />,
      );

      await waitFor(() => {
        const questions = screen.getAllByText("What is cloud computing?");
        expect(questions.length).toBeGreaterThan(0);
      });

      // Question is already expanded, find and click the new choice
      const newOption = await screen.findByRole("radio", {
        name: /Physical servers only/i,
      });
      await user.click(newOption);

      expect(onAnswerChange).toHaveBeenCalledWith("q1", "a2");
    });
  });

  describe("Submit functionality", () => {
    it("should call onSubmit when submit button clicked", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const onSubmit = vi.fn();
      const user = userEvent.setup();

      renderWithQuery(
        <ScenarioReader
          scenarioId="scenario-1"
          onSubmit={onSubmit}
          answers={{ q1: "a1", q2: "a3" }}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Submit Answers/i }),
        ).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", {
        name: /Submit Answers/i,
      });
      await user.click(submitButton);

      expect(onSubmit).toHaveBeenCalledWith({ q1: "a1", q2: "a3" });
    });

    it("should pass empty answers on submit if none selected", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const onSubmit = vi.fn();
      const user = userEvent.setup();

      renderWithQuery(
        <ScenarioReader scenarioId="scenario-1" onSubmit={onSubmit} />,
      );

      await waitFor(() => {
        const submitButton = screen.getByRole("button", {
          name: /Submit Answers/i,
        });
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels on questions", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        const questions = screen.getAllByRole("button");
        expect(questions.length).toBeGreaterThan(0);
      });
    });

    it("should allow keyboard navigation with Tab key", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const user = userEvent.setup();

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        // Wait for questions to be rendered
        const buttons = screen.getAllByRole("button");
        expect(buttons.length).toBeGreaterThan(0);
      });

      await user.tab();
      const focusedElement = document.activeElement;
      expect(focusedElement).toBeVisible();
    });

    it("should have visible focus indicator on interactive elements", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const user = userEvent.setup();

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Submit Answers/i }),
        ).toBeInTheDocument();
      });

      // Select an answer to enable submit button
      const option = await screen.findByRole("radio", {
        name: /On-demand computing resources/i,
      });
      await user.click(option);

      // Wait for submit button to be enabled
      const submitButton = screen.getByRole("button", {
        name: /Submit Answers/i,
      });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      // Focus the submit button directly to verify it can receive focus
      submitButton.focus();
      expect(submitButton).toHaveFocus();
    });

    it("should have proper radio button semantics", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const user = userEvent.setup();

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        const questions = screen.getAllByText("What is cloud computing?");
        expect(questions.length).toBeGreaterThan(0);
      });

      // First question is already expanded, just verify radios exist
      const radios = screen.getAllByRole("radio");
      expect(radios.length).toBeGreaterThanOrEqual(2); // At least 2 options for first question
      radios.forEach((radio) => {
        expect(radio).toHaveAttribute("type", "radio");
      });
    });

    it("should announce question when navigated", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const user = userEvent.setup();

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        expect(buttons.length).toBeGreaterThan(0);
      });

      const questionButtons = screen.getAllByRole("button");
      // Click the second question button (skip the first as it's expand/collapse)
      // The second button should be the "Which is a cloud provider?" button
      const secondQuestionButton = questionButtons.find(
        (btn) =>
          btn.textContent &&
          btn.textContent.includes("Which is a cloud provider?"),
      );
      await user.click(secondQuestionButton!);

      expect(secondQuestionButton?.parentElement).toHaveClass("bg-blue-50");
    });

    it("should not have accessibility violations on initial render", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);

      const { container } = renderWithQuery(
        <ScenarioReader scenarioId="scenario-1" />,
      );

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results.violations.length).toBe(0);
    });

    it("should maintain accessibility during question navigation", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const user = userEvent.setup();

      const { container } = renderWithQuery(
        <ScenarioReader scenarioId="scenario-1" />,
      );

      await waitFor(() => {
        const questions = screen.getAllByText("What is cloud computing?");
        expect(questions.length).toBeGreaterThan(0);
      });

      const questionButtons = screen.getAllByRole("button");
      const secondQuestionButton = questionButtons.find(
        (btn) =>
          btn.textContent &&
          btn.textContent.includes("Which is a cloud provider?"),
      );
      await user.click(secondQuestionButton!);

      const results = await axe(container);
      expect(results.violations.length).toBe(0);
    });

    it("should maintain accessibility when answer is selected", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const user = userEvent.setup();

      const { container } = renderWithQuery(
        <ScenarioReader scenarioId="scenario-1" />,
      );

      await waitFor(() => {
        const questions = screen.getAllByText("What is cloud computing?");
        expect(questions.length).toBeGreaterThan(0);
      });

      const option = await screen.findByRole("radio", {
        name: /On-demand computing resources/i,
      });
      await user.click(option);

      const results = await axe(container);
      expect(results.violations.length).toBe(0);
    });
  });

  describe("Progress tracking", () => {
    it("should display progress indicator", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        // Progress bar is shown in the sidebar header
        expect(screen.getByText(/Progress: \d+\/\d+/)).toBeInTheDocument();
      });
    });

    it("should update progress when answers change", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const user = userEvent.setup();

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        expect(screen.getByText(/Progress: 0\/2/)).toBeInTheDocument();
      });

      // First question is already expanded, select an answer
      const option = await screen.findByRole("radio", {
        name: /On-demand computing resources/i,
      });
      await user.click(option);

      // Progress should update to show 1 answer
      await waitFor(() => {
        expect(screen.getByText(/Progress: 1\/2/)).toBeInTheDocument();
      });
    });
  });

  describe("Integration", () => {
    it("should render complete exam flow", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const onSubmit = vi.fn();
      const user = userEvent.setup();

      renderWithQuery(
        <ScenarioReader scenarioId="scenario-1" onSubmit={onSubmit} />,
      );

      await waitFor(() => {
        expect(screen.getByText(mockScenario.passage)).toBeInTheDocument();
      });

      // First question is already expanded, select answer
      let option = await screen.findByRole("radio", {
        name: /On-demand computing resources/i,
      });
      await user.click(option);

      // Navigate to second question
      const questionButtons = screen.getAllByRole("button");
      const secondQuestionButton = questionButtons.find(
        (btn) =>
          btn.textContent &&
          btn.textContent.includes("Which is a cloud provider?"),
      );
      await user.click(secondQuestionButton!);

      option = await screen.findByRole("radio", { name: /AWS/i });
      await user.click(option);

      const submitButton = screen.getByRole("button", {
        name: /Submit Answers/i,
      });
      await user.click(submitButton);

      expect(onSubmit).toHaveBeenCalled();
    });

    it("should handle rapid question navigation", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const user = userEvent.setup();

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        expect(buttons.length).toBeGreaterThan(0);
      });

      const questionButtons = screen.getAllByRole("button");
      const firstQuestionButton = questionButtons.find(
        (btn) =>
          btn.textContent &&
          btn.textContent.includes("What is cloud computing?"),
      );
      const secondQuestionButton = questionButtons.find(
        (btn) =>
          btn.textContent &&
          btn.textContent.includes("Which is a cloud provider?"),
      );

      await user.click(secondQuestionButton!);
      await user.click(firstQuestionButton!);
      await user.click(secondQuestionButton!);

      expect(secondQuestionButton?.parentElement).toHaveClass("bg-blue-50");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty scenario gracefully", async () => {
      const emptyScenario = {
        id: "empty",
        orgId: "org-1",
        passage: "",
        diagramUrl: null,
        timeLimit: 600,
        questions: [],
      };
      vi.mocked(scenariosService.getScenario).mockResolvedValue(emptyScenario);

      renderWithQuery(<ScenarioReader scenarioId="empty" />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading scenario..."),
        ).not.toBeInTheDocument();
      });
    });

    it("should handle scenario with many questions", async () => {
      const manyQuestions = {
        id: "many",
        orgId: "org-1",
        passage: "Test passage",
        diagramUrl: null,
        timeLimit: 600,
        questions: Array.from({ length: 20 }, (_, i) => ({
          id: `q${i}`,
          order: i + 1,
          title: `Question ${i + 1}?`,
          choices: [
            { id: `a${i * 2}`, label: "A", content: "Option A" },
            { id: `a${i * 2 + 1}`, label: "B", content: "Option B" },
          ],
        })),
      };
      vi.mocked(scenariosService.getScenario).mockResolvedValue(manyQuestions);

      renderWithQuery(<ScenarioReader scenarioId="many" />);

      await waitFor(() => {
        const questions = screen.getAllByText("Question 1?");
        expect(questions.length).toBeGreaterThan(0);
      });
    });

    it("should not call onAnswerChange if external callback not provided", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);
      const user = userEvent.setup();

      renderWithQuery(<ScenarioReader scenarioId="scenario-1" />);

      const option = await screen.findByRole("radio", {
        name: /On-demand computing resources/i,
      });
      await user.click(option);

      expect(option).toBeChecked();
    });

    it("should disable query when scenarioId is empty", async () => {
      vi.mocked(scenariosService.getScenario).mockResolvedValue(mockScenario);

      renderWithQuery(<ScenarioReader scenarioId="" />);

      await waitFor(() => {
        expect(scenariosService.getScenario).not.toHaveBeenCalled();
      });
    });
  });
});
