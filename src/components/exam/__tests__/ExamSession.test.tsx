import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExamSession } from "../ExamSession";
import type {
  AttemptQuestion,
  CheckAnswerResponse,
  StartAttemptResponse,
} from "@/types/api-types";

const questions: AttemptQuestion[] = [
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
      { id: "c3", label: "c", content: "RDS" },
    ],
  },
  {
    id: "q2",
    title: "Second question",
    questionType: "SINGLE",
    difficulty: "MEDIUM",
    tags: [],
    sortOrder: 1,
    choices: [
      { id: "d1", label: "a", content: "Yes" },
      { id: "d2", label: "b", content: "No" },
    ],
  },
];

const attempt = (
  feedbackMode?: StartAttemptResponse["feedbackMode"],
): StartAttemptResponse => ({
  attemptId: "att-1",
  examId: "exam-1",
  title: "Exam",
  certification: { id: "cert-1", name: "Cert", code: "AWS-SAA" },
  timeLimit: 30,
  timerMode: "STRICT",
  feedbackMode,
  totalQuestions: questions.length,
  questions,
});

const wrongFeedback: CheckAnswerResponse = {
  questionId: "q1",
  isCorrect: false,
  selectedChoiceIds: ["c1"],
  correctChoiceIds: ["c2"],
  explanation: "**S3** is object storage.",
  checkedAt: "2026-09-25T00:00:00.000Z",
};

function renderSession(
  overrides: Partial<React.ComponentProps<typeof ExamSession>> = {},
) {
  const props: React.ComponentProps<typeof ExamSession> = {
    attemptData: attempt("INTERACTIVE"),
    questions,
    currentIndex: 0,
    setCurrentIndex: vi.fn(),
    answers: {},
    selectAnswer: vi.fn(),
    marked: new Set(),
    toggleMark: vi.fn(),
    timeLeft: 600,
    totalSeconds: 1800,
    onSubmit: vi.fn(),
    feedback: {},
    checkingId: null,
    onCheck: vi.fn(),
    ...overrides,
  };
  render(<ExamSession {...props} />);
  return props;
}

describe("ExamSession — Exam mode (unchanged behaviour)", () => {
  it.each([["END_OF_EXAM" as const], [undefined]])(
    "feedbackMode=%s shows no Check button, feedback panel or interactive score",
    (mode) => {
      renderSession({
        attemptData: attempt(mode),
        answers: { q1: ["c1"] },
      });

      expect(
        screen.queryByRole("button", { name: /check answer/i }),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("answer-feedback")).not.toBeInTheDocument();
      expect(screen.queryByTestId("interactive-score")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^next/i })).toBeEnabled();
      expect(
        screen.queryByRole("button", { name: /^skip$/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^submit$/i })).toBeEnabled();
      expect(screen.queryByText("Correct")).not.toBeInTheDocument();
    },
  );
});

describe("ExamSession — Interactive mode", () => {
  it("disables Check answer until a choice is selected", () => {
    renderSession();
    expect(
      screen.getByRole("button", { name: /check answer/i }),
    ).toBeDisabled();
  });

  it("calls onCheck for the current question", async () => {
    const props = renderSession({ answers: { q1: ["c2"] } });
    await userEvent.click(
      screen.getByRole("button", { name: /check answer/i }),
    );
    expect(props.onCheck).toHaveBeenCalledWith("q1");
  });

  it("disables Check answer and Submit while a check is in flight", () => {
    renderSession({ answers: { q1: ["c2"] }, checkingId: "q1" });
    expect(
      screen.getByRole("button", { name: /check answer/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /^submit$/i })).toBeDisabled();
  });

  it("lets the learner skip an unchecked question without locking it", async () => {
    const props = renderSession();
    await userEvent.click(screen.getByRole("button", { name: /^skip$/i }));
    expect(props.setCurrentIndex).toHaveBeenCalled();
    expect(props.onCheck).not.toHaveBeenCalled();
  });

  it("has no Skip on the last question", () => {
    renderSession({ currentIndex: 1 });
    expect(
      screen.queryByRole("button", { name: /^skip$/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the verdict, correct answer and explanation after checking", () => {
    renderSession({
      answers: { q1: ["c1"] },
      feedback: { q1: wrongFeedback },
    });

    const panel = screen.getByTestId("answer-feedback");
    expect(panel).toHaveAttribute("role", "status");
    expect(panel).toHaveAttribute("aria-live", "polite");
    expect(within(panel).getByText("Incorrect")).toBeInTheDocument();
    expect(within(panel).getByText("B")).toBeInTheDocument();
    // Explanation is rendered as markdown.
    expect(within(panel).getByText("S3").tagName).toBe("STRONG");
    // The verdict heading receives focus for keyboard/screen-reader users.
    expect(screen.getByRole("heading", { name: /incorrect/i })).toHaveFocus();
  });

  it("shows a correct verdict without the 'Correct answer' line", () => {
    renderSession({
      answers: { q1: ["c2"] },
      feedback: {
        q1: { ...wrongFeedback, isCorrect: true, selectedChoiceIds: ["c2"] },
      },
    });
    const panel = screen.getByTestId("answer-feedback");
    expect(within(panel).getByText("Correct!")).toBeInTheDocument();
    expect(within(panel).queryByText(/correct answer:/i)).toBeNull();
  });

  it("falls back to a message when the question has no explanation", () => {
    renderSession({
      answers: { q1: ["c1"] },
      feedback: { q1: { ...wrongFeedback, explanation: null } },
    });
    expect(
      screen.getByText("No explanation available for this question yet."),
    ).toBeInTheDocument();
  });

  it("locks the choices and marks the right and wrong ones", async () => {
    const props = renderSession({
      answers: { q1: ["c1"] },
      feedback: { q1: wrongFeedback },
    });

    const ec2 = screen.getByRole("button", { name: /EC2/ });
    const s3 = screen.getByRole("button", { name: /S3/ });
    expect(ec2).toBeDisabled();
    expect(s3).toBeDisabled();
    expect(screen.getByLabelText("Correct answer")).toBeInTheDocument();
    expect(screen.getByLabelText("Your answer")).toBeInTheDocument();

    await userEvent.click(ec2);
    expect(props.selectAnswer).not.toHaveBeenCalled();
  });

  it("turns Check answer into Next question once checked", async () => {
    const props = renderSession({
      answers: { q1: ["c1"] },
      feedback: { q1: wrongFeedback },
    });
    expect(
      screen.queryByRole("button", { name: /check answer/i }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /next question/i }),
    );
    expect(props.setCurrentIndex).toHaveBeenCalled();
  });

  it("offers Finish exam on the last checked question", async () => {
    const props = renderSession({
      currentIndex: 1,
      answers: { q2: ["d1"] },
      feedback: {
        q2: {
          ...wrongFeedback,
          questionId: "q2",
          selectedChoiceIds: ["d1"],
          correctChoiceIds: ["d1"],
          isCorrect: true,
        },
      },
    });
    await userEvent.click(screen.getByRole("button", { name: /finish exam/i }));
    // Finishing goes through the review screen first.
    expect(props.onSubmit).not.toHaveBeenCalled();
    await userEvent.click(
      await screen.findByRole("button", { name: /^submit exam$/i }),
    );
    expect(props.onSubmit).toHaveBeenCalled();
  });

  it("shows correct/incorrect state in the navigator and the live score", () => {
    renderSession({
      currentIndex: 1,
      answers: { q1: ["c1"] },
      feedback: { q1: wrongFeedback },
    });

    const navQ1 = screen.getByRole("button", { name: /^Question 1,/ });
    expect(navQ1).toHaveAttribute("data-state", "incorrect");
    expect(screen.getByTestId("interactive-score")).toHaveAccessibleName(
      "0 correct, 1 incorrect",
    );
    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
  });

  it("keeps the Flagged colour ahead of the checked colour", () => {
    renderSession({
      currentIndex: 1,
      answers: { q1: ["c1"] },
      feedback: { q1: wrongFeedback },
      marked: new Set(["q1"]),
    });
    expect(screen.getByRole("button", { name: /^Question 1,/ }).className).toContain(
      "bg-warning/20",
    );
  });
});

describe("ExamSession question content", () => {
  const rich: AttemptQuestion = {
    id: "q9",
    title: "What does this print?",
    description: "Given the **snippet** below:",
    questionType: "MULTIPLE",
    selectCount: 2,
    codeSnippet: "print(1 + 1)",
    imageUrl: "https://example.com/diagram.png",
    difficulty: "HARD",
    tags: [],
    sortOrder: 0,
    choices: [
      { id: "m1", label: "a", content: "2" },
      { id: "m2", label: "b", content: "Two" },
      { id: "m3", label: "c", content: "11" },
    ],
  };

  it("renders markdown, the code snippet and the image", () => {
    renderSession({
      attemptData: attempt("END_OF_EXAM"),
      questions: [rich],
    });
    expect(screen.getByText("snippet").tagName).toBe("STRONG");
    expect(screen.getByTestId("question-code")).toHaveTextContent(
      "print(1 + 1)",
    );
    expect(screen.getByRole("img", { name: /question illustration/i })).toHaveAttribute(
      "src",
      "https://example.com/diagram.png",
    );
  });

  it('shows "Choose N" and blocks extra picks once N are selected', async () => {
    const selectAnswer = vi.fn();
    renderSession({
      attemptData: attempt("END_OF_EXAM"),
      questions: [rich],
      answers: { q9: ["m1", "m2"] },
      selectAnswer,
    });
    expect(screen.getByText("Choose 2 · 2/2 selected")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /11/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("checkbox", { name: /Two/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("shows the autosave status", () => {
    renderSession({ attemptData: attempt("END_OF_EXAM"), saveStatus: "error" });
    expect(screen.getByTestId("save-status")).toHaveTextContent(
      "Offline — retrying",
    );
  });
});


describe("ExamSession — review, navigation and shortcuts", () => {
  it("asks for a review before submitting, listing what is still open", async () => {
    const props = renderSession({
      attemptData: attempt("END_OF_EXAM"),
      answers: { q1: ["c2"] },
      marked: new Set(["q1"]),
    });
    await userEvent.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(props.onSubmit).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("1/2 answered · 1 unanswered");
    expect(dialog).toHaveTextContent("1 flagged");
    // Opens on the unanswered questions; jumping there closes the review.
    await userEvent.click(within(dialog).getByRole("button", { name: /Q2/ }));
    expect(props.setCurrentIndex).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^submit$/i }));
    await userEvent.click(
      await screen.findByRole("button", { name: /^submit exam$/i }),
    );
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("supports keyboard shortcuts for choices, navigation and flags", async () => {
    const props = renderSession({ attemptData: attempt("END_OF_EXAM") });
    await userEvent.keyboard("2");
    expect(props.selectAnswer).toHaveBeenCalledWith("q1", "c2");
    await userEvent.keyboard("c");
    expect(props.selectAnswer).toHaveBeenCalledWith("q1", "c3");
    await userEvent.keyboard("f");
    expect(props.toggleMark).toHaveBeenCalledWith("q1");
    await userEvent.keyboard("{ArrowRight}");
    expect(props.setCurrentIndex).toHaveBeenCalled();
  });

  it("checks with Enter in Interactive mode", async () => {
    const props = renderSession({ answers: { q1: ["c2"] } });
    await userEvent.keyboard("{Enter}");
    expect(props.onCheck).toHaveBeenCalledWith("q1");
  });

  it("does not change a checked answer from the keyboard", async () => {
    const props = renderSession({
      answers: { q1: ["c1"] },
      feedback: { q1: wrongFeedback },
    });
    await userEvent.keyboard("2");
    expect(props.selectAnswer).not.toHaveBeenCalled();
  });

  it("lets the learner cross out a choice", async () => {
    renderSession({ attemptData: attempt("END_OF_EXAM") });
    await userEvent.click(
      screen.getByRole("button", { name: "Cross out choice A" }),
    );
    expect(screen.getByRole("button", { name: /EC2/ })).toHaveAttribute(
      "data-eliminated",
      "true",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Restore choice A" }),
    );
    expect(screen.getByRole("button", { name: /EC2/ })).not.toHaveAttribute(
      "data-eliminated",
    );
  });

  it("opens the question grid in a sheet on small screens", async () => {
    const props = renderSession({ attemptData: attempt("END_OF_EXAM") });
    await userEvent.click(
      screen.getByRole("button", { name: /show all questions/i }),
    );
    const sheet = await screen.findByRole("dialog");
    await userEvent.click(
      within(sheet).getByRole("button", { name: /^Question 2,/ }),
    );
    expect(props.setCurrentIndex).toHaveBeenCalledWith(1);
  });
});
