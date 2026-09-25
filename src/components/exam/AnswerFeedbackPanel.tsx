import { forwardRef } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import MarkdownContent from "@/components/ui/MarkdownContent";
import type { AttemptQuestion, CheckAnswerResponse } from "@/types/api-types";

interface AnswerFeedbackPanelProps {
  feedback: CheckAnswerResponse;
  /** Choices in the order (and with the labels) the learner is seeing them. */
  choices: AttemptQuestion["choices"];
}

/** INTERACTIVE mode: correct/incorrect verdict + explanation for one question. */
export const AnswerFeedbackPanel = forwardRef<
  HTMLHeadingElement,
  AnswerFeedbackPanelProps
>(({ feedback, choices }, headingRef) => {
  const correctLabels = choices
    .filter((c) => feedback.correctChoiceIds.includes(c.id))
    .map((c) => c.label.toUpperCase())
    .join(", ");

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="answer-feedback"
      className={`mt-6 p-4 rounded-lg border ${
        feedback.isCorrect
          ? "border-accent/30 bg-accent/5"
          : "border-destructive/30 bg-destructive/5"
      }`}
    >
      <h3
        ref={headingRef}
        tabIndex={-1}
        className={`flex items-center gap-2 font-mono font-semibold outline-none ${
          feedback.isCorrect ? "text-accent" : "text-destructive"
        }`}
      >
        {feedback.isCorrect ? (
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        ) : (
          <XCircle className="h-5 w-5" aria-hidden="true" />
        )}
        {feedback.isCorrect ? "Correct!" : "Incorrect"}
      </h3>
      {!feedback.isCorrect && correctLabels && (
        <p className="mt-1 text-sm text-foreground">
          Correct answer: <span className="font-mono">{correctLabels}</span>
        </p>
      )}
      <div className="mt-3 text-muted-foreground">
        {feedback.explanation ? (
          <MarkdownContent>{feedback.explanation}</MarkdownContent>
        ) : (
          <p className="text-sm italic">
            No explanation available for this question yet.
          </p>
        )}
      </div>
    </div>
  );
});

AnswerFeedbackPanel.displayName = "AnswerFeedbackPanel";
