import type { AttemptQuestion, CheckAnswerResponse } from "@/types/api-types";

interface QuestionNavigatorProps {
  questions: AttemptQuestion[];
  currentIndex: number;
  answers: Record<string, string[]>;
  marked: Set<string>;
  feedback?: Record<string, CheckAnswerResponse>;
  showVerdicts?: boolean;
  onSelect: (index: number) => void;
}

/** Numbered question grid with status colours; used on desktop and in the mobile sheet. */
export function QuestionNavigator({
  questions,
  currentIndex,
  answers,
  marked,
  feedback = {},
  showVerdicts = false,
  onSelect,
}: QuestionNavigatorProps) {
  return (
    <>
      <div className="grid grid-cols-5 gap-2">
        {questions.map((q, i) => {
          const isAnswered = !!answers[q.id]?.length;
          const isMarkedQ = marked.has(q.id);
          const isCurrent = i === currentIndex;
          const checked = feedback[q.id];
          const status = checked
            ? checked.isCorrect
              ? "correct"
              : "incorrect"
            : isAnswered
              ? "answered"
              : "unanswered";
          return (
            <button
              key={q.id}
              onClick={() => onSelect(i)}
              aria-label={`Question ${i + 1}, ${status}${isMarkedQ ? ", flagged" : ""}`}
              aria-current={isCurrent ? "step" : undefined}
              data-state={
                checked ? (checked.isCorrect ? "correct" : "incorrect") : undefined
              }
              className={`w-8 h-8 rounded text-xs font-mono font-semibold transition-all ${
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isMarkedQ
                    ? "bg-warning/20 text-warning border border-warning/30"
                    : checked
                      ? checked.isCorrect
                        ? "bg-accent text-accent-foreground"
                        : "bg-destructive/20 text-destructive border border-destructive/30"
                      : isAnswered
                        ? "bg-accent/20 text-accent"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        {showVerdicts && (
          <>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-accent" /> Correct
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-destructive/20 border border-destructive/30" />{" "}
              Incorrect
            </div>
          </>
        )}
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-accent/20" /> Answered
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-warning/20 border border-warning/30" />{" "}
          Flagged
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-secondary" /> Unanswered
        </div>
      </div>
    </>
  );
}
