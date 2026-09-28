import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatSession } from "../CatSession";
import type {
  AttemptQuestion,
  CatProgress,
  StartAttemptResponse,
} from "@/types/api-types";

const single: AttemptQuestion = {
  id: "q1",
  title: "Which service stores objects?",
  questionType: "SINGLE",
  difficulty: null,
  domain: null,
  tags: [],
  sortOrder: 0,
  choices: [
    { id: "c1", label: "a", content: "EC2" },
    { id: "c2", label: "b", content: "S3" },
  ],
};

const multi: AttemptQuestion = {
  ...single,
  id: "q2",
  title: "Pick two",
  questionType: "MULTIPLE",
  selectCount: 2,
  choices: [
    { id: "m1", label: "a", content: "One" },
    { id: "m2", label: "b", content: "Two" },
    { id: "m3", label: "c", content: "Three" },
  ],
};

const progress: CatProgress = {
  answered: 4,
  minItems: 10,
  maxItems: 20,
  standardError: 0.65,
  targetStandardError: 0.3,
  done: false,
  stoppedBy: null,
};

function renderCat(
  overrides: Partial<React.ComponentProps<typeof CatSession>> = {},
) {
  const props: React.ComponentProps<typeof CatSession> = {
    attemptData: {
      attemptId: "att-1",
      certification: { id: "cert-1", name: "Cert", code: "AWS-SAA" },
    } as StartAttemptResponse,
    question: single,
    progress,
    timeLeft: 600,
    totalSeconds: 1200,
    submitting: false,
    onAnswer: vi.fn(),
    onEndEarly: vi.fn(),
    ...overrides,
  };
  render(<CatSession {...props} />);
  return props;
}

describe("CatSession", () => {
  it("shows one question, its position and the measurement precision", () => {
    renderCat();
    expect(screen.getByText("Question 5")).toBeInTheDocument();
    expect(screen.getByText(/up to 20/)).toBeInTheDocument();
    // SE 0.65 → halfway from 1.0 to the 0.3 target.
    expect(
      screen.getByRole("progressbar", { name: /measurement precision/i }),
    ).toHaveAttribute("aria-valuenow", "50");
    expect(
      screen.queryByRole("button", { name: /prev/i }),
    ).not.toBeInTheDocument();
  });

  it("confirms the chosen answer", async () => {
    const props = renderCat();
    const confirm = screen.getByRole("button", { name: /confirm answer/i });
    expect(confirm).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /S3/ }));
    await userEvent.click(confirm);
    expect(props.onAnswer).toHaveBeenCalledWith("q1", ["c2"]);
  });

  it("answers from the keyboard", async () => {
    const props = renderCat();
    await userEvent.keyboard("1");
    await userEvent.keyboard("{Enter}");
    expect(props.onAnswer).toHaveBeenCalledWith("q1", ["c1"]);
  });

  it("needs exactly N choices for a choose-N question", async () => {
    const props = renderCat({ question: multi });
    const confirm = screen.getByRole("button", { name: /confirm answer/i });
    await userEvent.click(screen.getByRole("checkbox", { name: /One/ }));
    expect(confirm).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /Two/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Three/ }));
    expect(screen.getByRole("checkbox", { name: /Three/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await userEvent.click(confirm);
    expect(props.onAnswer).toHaveBeenCalledWith("q2", ["m1", "m2"]);
  });

  it("asks before ending the test early", async () => {
    const props = renderCat();
    await userEvent.click(screen.getByRole("button", { name: /end test/i }));
    expect(
      await screen.findByText(/scored on the 4 questions answered so far/),
    ).toBeInTheDocument();
    const dialog = screen.getByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /^end test$/i }),
    );
    expect(props.onEndEarly).toHaveBeenCalled();
  });
});
