import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExamIntro } from "../ExamIntro";
import type { Certification, FeedbackMode, TimerMode } from "@/types/api-types";

const cert = {
  id: "cert-1",
  name: "Solutions Architect",
  code: "AWS-SAA",
  provider: { id: "p1", name: "AWS", slug: "aws" },
  domains: [],
} as unknown as Certification;

function renderIntro(timerMode: TimerMode, feedbackMode: FeedbackMode) {
  const onFeedbackModeChange = vi.fn();
  render(
    <ExamIntro
      cert={cert}
      questionCount={10}
      timerMode={timerMode}
      onTimerModeChange={vi.fn()}
      feedbackMode={feedbackMode}
      onFeedbackModeChange={onFeedbackModeChange}
      onBack={vi.fn()}
      onStart={vi.fn()}
    />,
  );
  return { onFeedbackModeChange };
}

describe("ExamIntro feedback mode", () => {
  it("shows Exam selected by default and lets the user pick Interactive", async () => {
    const { onFeedbackModeChange } = renderIntro("STRICT", "END_OF_EXAM");

    expect(screen.getByRole("radio", { name: /exam/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await userEvent.click(screen.getByRole("radio", { name: /interactive/i }));
    expect(onFeedbackModeChange).toHaveBeenCalledWith("INTERACTIVE");
  });

  it("disables Interactive for Time Pressure", async () => {
    const { onFeedbackModeChange } = renderIntro(
      "TIME_PRESSURE",
      "END_OF_EXAM",
    );
    const interactive = screen.getByRole("radio", { name: /interactive/i });
    expect(interactive).toBeDisabled();
    expect(
      screen.getByText("Not available with Time Pressure"),
    ).toBeInTheDocument();
    await userEvent.click(interactive);
    expect(onFeedbackModeChange).not.toHaveBeenCalled();
  });
});
