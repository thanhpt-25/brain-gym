import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Loader2, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import MarkdownContent from "@/components/ui/MarkdownContent";
import { formatTime } from "@/lib/time";
import type { FontScale } from "@/lib/exam-plan";
import type {
  AttemptQuestion,
  CatProgress,
  StartAttemptResponse,
} from "@/types/api-types";

const TEXT_SIZES: Record<
  FontScale,
  { title: string; body: "text-xs" | "text-sm" | "text-base"; choice: string }
> = {
  sm: { title: "text-base", body: "text-xs", choice: "text-xs" },
  md: { title: "text-lg", body: "text-sm", choice: "text-sm" },
  lg: { title: "text-xl", body: "text-base", choice: "text-base" },
};

interface CatSessionProps {
  attemptData: StartAttemptResponse;
  /** The question on screen (the latest one the test gave). */
  question: AttemptQuestion;
  progress: CatProgress;
  timeLeft: number;
  totalSeconds: number;
  submitting: boolean;
  /** Confirm the answer: it is locked and the next question is chosen. */
  onAnswer: (questionId: string, selectedChoices: string[]) => void;
  /** End the test now; it is scored on the questions answered so far. */
  onEndEarly: () => void;
  fontScale?: FontScale;
}

/**
 * A computerized adaptive test: one question at a time, chosen from the
 * previous answers. There is no going back or skipping; the test ends by
 * itself once the ability estimate is precise enough.
 */
export function CatSession({
  attemptData,
  question,
  progress,
  timeLeft,
  totalSeconds,
  submitting,
  onAnswer,
  onEndEarly,
  fontScale = "md",
}: CatSessionProps) {
  const sizes = TEXT_SIZES[fontScale];
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const isMultiple = question.questionType === "MULTIPLE";
  const selectCount = isMultiple ? question.selectCount : undefined;
  const atLimit = !!selectCount && selected.length >= selectCount;
  const canConfirm =
    selected.length > 0 && (!selectCount || selected.length === selectCount);

  // A new question starts with nothing selected.
  useEffect(() => setSelected([]), [question.id]);

  const toggle = (choiceId: string) => {
    if (submitting) return;
    if (!isMultiple) return setSelected([choiceId]);
    setSelected((prev) =>
      prev.includes(choiceId)
        ? prev.filter((id) => id !== choiceId)
        : atLimit
          ? prev
          : [...prev, choiceId],
    );
  };

  // Keyboard: 1-9 / A-I choose, Enter confirms.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (confirmEnd || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        return;
      let index = -1;
      if (/^[1-9]$/.test(e.key)) index = Number(e.key) - 1;
      else if (/^[a-i]$/i.test(e.key))
        index = e.key.toLowerCase().charCodeAt(0) - 97;
      const choice = question.choices[index];
      if (choice) {
        e.preventDefault();
        toggle(choice.id);
      } else if (
        e.key === "Enter" &&
        canConfirm &&
        !submitting &&
        target?.tagName !== "BUTTON"
      ) {
        e.preventDefault();
        onAnswer(question.id, selected);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const position = progress.answered + 1;
  // Precision so far: 0% at the prior (SE 1) → 100% at the target SE.
  const precision = Math.round(
    Math.max(
      0,
      Math.min(
        1,
        (1 - progress.standardError) / (1 - progress.targetStandardError),
      ),
    ) * 100,
  );
  const lowTime =
    totalSeconds > 0 && timeLeft < Math.min(300, totalSeconds * 0.1);

  return (
    <div className="flex-1 flex flex-col">
      <div className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-14 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-mono text-muted-foreground">
              {attemptData.certification?.code}
            </span>
            <span className="text-sm font-mono text-foreground">
              Question {position}
              <span className="text-muted-foreground">
                {" "}
                · up to {progress.maxItems}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-1.5 font-mono text-sm ${
                lowTime ? "text-destructive motion-safe:animate-pulse" : ""
              }`}
            >
              <Clock className="h-4 w-4" />
              {formatTime(timeLeft)}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="font-mono"
              disabled={submitting}
              onClick={() => setConfirmEnd(true)}
            >
              End test
            </Button>
          </div>
        </div>
        <div className="container pb-2">
          <div
            className="flex items-center gap-2 text-xs font-mono text-muted-foreground"
            role="progressbar"
            aria-label="Measurement precision"
            aria-valuenow={precision}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Precision</span>
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${precision}%` }}
              />
            </div>
            <span>{precision}%</span>
          </div>
        </div>
      </div>

      <div className="flex-1 container py-6 max-w-3xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="glass-card p-6">
              <h2 className={`${sizes.title} font-medium mb-2`}>
                {question.title}
              </h2>
              {question.description && (
                <div className="text-muted-foreground mb-4">
                  <MarkdownContent size={sizes.body}>
                    {question.description}
                  </MarkdownContent>
                </div>
              )}
              {question.codeSnippet && (
                <pre className="p-4 rounded-lg bg-secondary/80 text-sm font-mono overflow-x-auto mb-4">
                  <code>{question.codeSnippet}</code>
                </pre>
              )}
              {question.imageUrl && (
                <img
                  src={question.imageUrl}
                  alt="Question illustration"
                  loading="lazy"
                  className="max-w-full max-h-96 rounded-lg border border-border mb-4"
                />
              )}
              {isMultiple && (
                <p
                  className="text-xs font-mono text-primary mt-4"
                  aria-live="polite"
                >
                  {selectCount
                    ? `Choose ${selectCount} · ${selected.length}/${selectCount} selected`
                    : "Select all that apply"}
                </p>
              )}

              <div className="space-y-3 mt-6">
                {question.choices.map((choice) => {
                  const isSelected = selected.includes(choice.id);
                  const isBlocked = atLimit && !isSelected;
                  return (
                    <button
                      key={choice.id}
                      onClick={() => toggle(choice.id)}
                      role={isMultiple ? "checkbox" : undefined}
                      aria-checked={isMultiple ? isSelected : undefined}
                      aria-pressed={isMultiple ? undefined : isSelected}
                      aria-disabled={isBlocked || submitting || undefined}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${sizes.choice} ${
                        isSelected
                          ? "border-primary bg-primary/10 text-foreground"
                          : isBlocked
                            ? "border-border bg-secondary/30 text-muted-foreground cursor-not-allowed"
                            : "border-border bg-secondary/50 text-foreground hover:border-primary/30"
                      }`}
                    >
                      <span className="font-mono font-semibold mr-3 text-muted-foreground">
                        {choice.label.toUpperCase()}
                      </span>
                      {choice.content}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Answers are final — the next question adapts to them.
              </p>
              <Button
                className="font-mono"
                disabled={!canConfirm || submitting}
                onClick={() => onAnswer(question.id, selected)}
              >
                {submitting && (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                )}
                Confirm answer
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End the test now?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be scored on the {progress.answered} question
              {progress.answered === 1 ? "" : "s"} answered so far; the current
              question is not counted. The estimate is less precise the fewer
              questions you answer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction onClick={onEndEarly}>End test</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
