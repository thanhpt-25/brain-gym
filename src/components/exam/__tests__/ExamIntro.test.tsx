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
      timeLimitMinutes={14}
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

describe("ExamIntro exam details and resume", () => {
  it("shows the planned exam and the certification pass mark", () => {
    render(
      <ExamIntro
        cert={{ ...cert, passingScore: 65 } as Certification}
        questionCount={10}
        timeLimitMinutes={14}
        timerMode="STRICT"
        onTimerModeChange={vi.fn()}
        feedbackMode="END_OF_EXAM"
        onFeedbackModeChange={vi.fn()}
        onBack={vi.fn()}
        onStart={vi.fn()}
      />,
    );
    expect(screen.getByText("14m")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("offers to resume or discard an unfinished attempt", async () => {
    const onResume = vi.fn();
    const onDiscardActive = vi.fn();
    render(
      <ExamIntro
        cert={cert}
        questionCount={10}
        timeLimitMinutes={14}
        activeAttempt={{
          attemptId: "att-9",
          examId: "exam-9",
          certificationId: "cert-1",
          title: "Exam",
          timerMode: "STRICT",
          feedbackMode: "END_OF_EXAM",
          answeredCount: 3,
          totalQuestions: 10,
          startedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 12 * 60_000).toISOString(),
        }}
        onResume={onResume}
        onDiscardActive={onDiscardActive}
        timerMode="STRICT"
        onTimerModeChange={vi.fn()}
        feedbackMode="END_OF_EXAM"
        onFeedbackModeChange={vi.fn()}
        onBack={vi.fn()}
        onStart={vi.fn()}
      />,
    );
    const banner = screen.getByRole("region", { name: /unfinished exam/i });
    expect(banner).toHaveTextContent("3/10 answered · 12m left");
    await userEvent.click(screen.getByRole("button", { name: /resume exam/i }));
    await userEvent.click(screen.getByRole("button", { name: /discard/i }));
    expect(onResume).toHaveBeenCalled();
    expect(onDiscardActive).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /start new exam/i }),
    ).toBeInTheDocument();
  });
});


describe("ExamIntro practice modes and accessibility", () => {
  const baseSetup = {
    mode: "STANDARD" as const,
    sessionSize: 10,
    domainIds: [],
    difficulties: [],
    timeMultiplier: 1,
  };
  const certWithDomains = {
    ...cert,
    domains: [
      { id: "d1", name: "Networking" },
      { id: "d2", name: "Security" },
    ],
  } as unknown as Certification;

  function renderWithSetup(setup = baseSetup) {
    const onSetupChange = vi.fn();
    const onFontScaleChange = vi.fn();
    render(
      <ExamIntro
        cert={certWithDomains}
        questionCount={10}
        timeLimitMinutes={14}
        setup={setup}
        onSetupChange={onSetupChange}
        fontScale="md"
        onFontScaleChange={onFontScaleChange}
        timerMode="STRICT"
        onTimerModeChange={vi.fn()}
        feedbackMode="END_OF_EXAM"
        onFeedbackModeChange={vi.fn()}
        onBack={vi.fn()}
        onStart={vi.fn()}
      />,
    );
    return { onSetupChange, onFontScaleChange };
  }

  it("switches the practice mode", async () => {
    const { onSetupChange } = renderWithSetup();
    await userEvent.click(screen.getByRole("radio", { name: /quick drill/i }));
    expect(onSetupChange).toHaveBeenCalledWith({ ...baseSetup, mode: "QUICK_DRILL" });
  });

  it("offers size, domain and difficulty filters for a quick drill", async () => {
    const { onSetupChange } = renderWithSetup({ ...baseSetup, mode: "QUICK_DRILL" });
    await userEvent.click(screen.getByRole("button", { name: "20" }));
    expect(onSetupChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionSize: 20 }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Security" }));
    expect(onSetupChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ domainIds: ["d2"] }),
    );
    await userEvent.click(screen.getByRole("button", { name: "HARD" }));
    expect(onSetupChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ difficulties: ["HARD"] }),
    );
  });

  it("a full mock hides the timer choice and disables Interactive", () => {
    renderWithSetup({ ...baseSetup, mode: "FULL_MOCK" });
    expect(screen.queryByText("Timer Mode")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /interactive/i })).toBeDisabled();
    expect(screen.getByText("Not available with a full mock")).toBeInTheDocument();
  });

  it("sets extra time and text size", async () => {
    const { onSetupChange, onFontScaleChange } = renderWithSetup();
    await userEvent.click(screen.getByRole("button", { name: "×1.5" }));
    expect(onSetupChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ timeMultiplier: 1.5 }),
    );
    await userEvent.click(screen.getByRole("button", { name: /text size large/i }));
    expect(onFontScaleChange).toHaveBeenCalledWith("lg");
  });
});
