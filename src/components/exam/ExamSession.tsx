import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  Zap,
  BookOpen,
  Check,
  X,
  Loader2,
  CloudOff,
  CloudUpload,
  Cloud,
  LayoutGrid,
  Strikethrough,
  Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AttemptQuestion,
  CheckAnswerResponse,
  StartAttemptResponse,
  TimerMode,
} from "@/types/api-types";
import { formatTime } from "@/lib/time";
import { AnswerFeedbackPanel } from "@/components/exam/AnswerFeedbackPanel";
import MarkdownContent from "@/components/ui/MarkdownContent";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { QuestionNavigator } from "@/components/exam/QuestionNavigator";
import { ExamReviewDialog } from "@/components/exam/ExamReviewDialog";
import type { SaveStatus } from "@/hooks/useAutosave";

interface ExamSessionProps {
  attemptData: StartAttemptResponse;
  questions: AttemptQuestion[];
  currentIndex: number;
  setCurrentIndex: (val: number | ((prev: number) => number)) => void;
  answers: Record<string, string[]>;
  selectAnswer: (qId: string, cId: string) => void;
  marked: Set<string>;
  toggleMark: (qId: string) => void;
  timeLeft: number;
  totalSeconds: number;
  onSubmit: () => void;
  /** Autosave state (END_OF_EXAM attempts); hidden when undefined. */
  saveStatus?: SaveStatus;
  /** INTERACTIVE mode only: revealed answers keyed by questionId. */
  feedback?: Record<string, CheckAnswerResponse>;
  checkingId?: string | null;
  onCheck?: (qId: string) => void;
}

function getTimerClass(
  timeLeft: number,
  totalSeconds: number,
  timerMode?: TimerMode,
): string {
  if (timerMode === "RELAXED") return "text-muted-foreground";

  const ratio = totalSeconds > 0 ? timeLeft / totalSeconds : 1;

  if (timerMode === "TIME_PRESSURE") {
    if (ratio <= 0.05)
      return "text-destructive motion-safe:animate-pulse font-bold";
    if (ratio <= 0.1) return "text-destructive font-semibold";
    if (ratio <= 0.25) return "text-orange-500 font-semibold";
    return "text-foreground";
  }

  if (timerMode === "ACCELERATED") {
    if (ratio <= 0.25) return "text-destructive motion-safe:animate-pulse";
    if (ratio <= 0.5) return "text-orange-400";
    return "text-foreground";
  }
  // STRICT (default)
  return timeLeft < 300
    ? "text-destructive motion-safe:animate-pulse"
    : "text-foreground";
}

import { useState, useEffect, useRef } from "react";

export function ExamSession({
  attemptData,
  questions,
  currentIndex,
  setCurrentIndex,
  answers,
  selectAnswer,
  marked,
  toggleMark,
  timeLeft,
  totalSeconds,
  onSubmit,
  saveStatus,
  feedback = {},
  checkingId = null,
  onCheck,
}: ExamSessionProps) {
  const currentQuestion = questions[currentIndex];
  const timerMode = attemptData?.timerMode;
  const isInteractive = attemptData?.feedbackMode === "INTERACTIVE";
  const currentFeedback = currentQuestion
    ? feedback[currentQuestion.id]
    : undefined;

  const [announcement, setAnnouncement] = useState("");
  const feedbackHeadingRef = useRef<HTMLHeadingElement>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  // Choices the learner crossed out, per question (a thinking aid only).
  const [eliminated, setEliminated] = useState<Record<string, string[]>>({});

  const toggleEliminated = (questionId: string, choiceId: string) =>
    setEliminated((prev) => {
      const current = prev[questionId] ?? [];
      return {
        ...prev,
        [questionId]: current.includes(choiceId)
          ? current.filter((id) => id !== choiceId)
          : [...current, choiceId],
      };
    });

  // Keyboard: 1-9 / A-I pick a choice, ←/→ move, F flags, Enter checks
  // (Interactive). Ignored while typing or when a dialog is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const q = questions[currentIndex];
      if (!q || reviewOpen || navOpen) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      const key = e.key;
      const locked = !!feedback[q.id];
      let choiceIndex = -1;
      if (/^[1-9]$/.test(key)) choiceIndex = Number(key) - 1;
      else if (/^[a-i]$/i.test(key) && key.toLowerCase() !== "f")
        choiceIndex = key.toLowerCase().charCodeAt(0) - 97;

      if (choiceIndex >= 0) {
        const choice = q.choices[choiceIndex];
        if (choice && !locked) {
          e.preventDefault();
          selectAnswer(q.id, choice.id);
        }
      } else if (key === "ArrowRight" && currentIndex < questions.length - 1) {
        e.preventDefault();
        setCurrentIndex((i) => i + 1);
      } else if (key === "ArrowLeft" && currentIndex > 0) {
        e.preventDefault();
        setCurrentIndex((i) => i - 1);
      } else if (key.toLowerCase() === "f") {
        e.preventDefault();
        toggleMark(q.id);
      } else if (
        key === "Enter" &&
        isInteractive &&
        !locked &&
        answers[q.id]?.length &&
        !checkingId &&
        target?.tagName !== "BUTTON"
      ) {
        e.preventDefault();
        onCheck?.(q.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    questions,
    currentIndex,
    reviewOpen,
    navOpen,
    feedback,
    answers,
    isInteractive,
    checkingId,
    selectAnswer,
    setCurrentIndex,
    toggleMark,
    onCheck,
  ]);

  // Move focus to the verdict once an answer is revealed.
  const currentCheckedAt = currentFeedback?.checkedAt;
  useEffect(() => {
    if (currentCheckedAt) feedbackHeadingRef.current?.focus();
  }, [currentCheckedAt]);

  useEffect(() => {
    if (timerMode !== "TIME_PRESSURE" || totalSeconds <= 0) return;
    const ratio = timeLeft / totalSeconds;

    // Determine the current threshold bracket
    let bracket = "";
    if (ratio <= 0.05)
      bracket = "5% time remaining. Please finalize your answers.";
    else if (ratio <= 0.1) bracket = "10% time remaining.";
    else if (ratio <= 0.25) bracket = "25% time remaining.";

    if (bracket && bracket !== announcement) {
      setAnnouncement(bracket);
    }
  }, [timeLeft, totalSeconds, timerMode, announcement]);

  if (!currentQuestion) return null;

  const timerClass = getTimerClass(timeLeft, totalSeconds, timerMode);
  const isAccelerated = timerMode === "ACCELERATED";
  const showOrangeWarning =
    isAccelerated &&
    totalSeconds > 0 &&
    timeLeft / totalSeconds <= 0.5 &&
    timeLeft / totalSeconds > 0.25;

  const checkedResults = Object.values(feedback);
  const checkedCorrect = checkedResults.filter((f) => f.isCorrect).length;
  const checkedIncorrect = checkedResults.length - checkedCorrect;
  const isLastQuestion = currentIndex === questions.length - 1;
  const hasSelection = !!answers[currentQuestion.id]?.length;
  const isMultiple = currentQuestion.questionType === "MULTIPLE";
  const selectCount = isMultiple ? currentQuestion.selectCount : undefined;
  const selectedCount = answers[currentQuestion.id]?.length ?? 0;
  const atSelectLimit = !!selectCount && selectedCount >= selectCount;

  return (
    <div className="flex-1 flex flex-col">
      {/* Accessibility live region for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Accelerated mode banner */}
      {isAccelerated && (
        <div className="bg-orange-500/10 border-b border-orange-500/30 px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-mono text-orange-400">
          <Zap className="h-3 w-3" />
          Accelerated Mode — Time pressure active
          {showOrangeWarning && (
            <span className="ml-2 text-orange-300 font-semibold">
              · Halfway through your time!
            </span>
          )}
        </div>
      )}

      {/* Top Bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-muted-foreground">
              {attemptData?.certification?.code}
            </span>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm font-mono text-foreground">
              Q{currentIndex + 1}/{questions.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden px-2"
              aria-label="Show all questions"
              onClick={() => setNavOpen(true)}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            {isInteractive && (
              <span
                className="text-xs font-mono text-muted-foreground"
                data-testid="interactive-score"
                aria-label={`${checkedCorrect} correct, ${checkedIncorrect} incorrect`}
              >
                <span className="text-accent">✓ {checkedCorrect}</span> ·{" "}
                <span className="text-destructive">✗ {checkedIncorrect}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <SaveIndicator status={saveStatus} />
            <div
              className={`flex items-center gap-1.5 font-mono text-sm ${timerClass}`}
            >
              <Clock className="h-4 w-4" />
              {formatTime(timeLeft)}
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setReviewOpen(true)}
              disabled={!!checkingId}
              className="font-mono"
            >
              Submit
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 container py-6 flex gap-6">
        {/* Question */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                        currentQuestion.difficulty === "EASY"
                          ? "bg-accent/10 text-accent"
                          : currentQuestion.difficulty === "MEDIUM"
                            ? "bg-warning/10 text-warning"
                            : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {currentQuestion.difficulty}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {currentQuestion.domain?.name || "Unknown"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMark(currentQuestion.id)}
                    className={
                      marked.has(currentQuestion.id)
                        ? "text-warning"
                        : "text-muted-foreground"
                    }
                  >
                    <Flag className="h-4 w-4" />
                  </Button>
                </div>

                <h2 className="text-lg font-medium mb-2">
                  {currentQuestion.title}
                </h2>
                {currentQuestion.isScenario && currentQuestion.description ? (
                  <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 mb-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                      <BookOpen className="h-12 w-12" aria-hidden="true" />
                    </div>
                    <div className="flex items-center gap-2 text-accent font-mono text-[10px] uppercase tracking-widest mb-2">
                      <BookOpen className="h-3 w-3" aria-hidden="true" />{" "}
                      Technical Context / Scenario
                    </div>
                    <div className="text-foreground/90 relative z-10">
                      <MarkdownContent>{currentQuestion.description}</MarkdownContent>
                    </div>
                  </div>
                ) : currentQuestion.description ? (
                  <div className="text-muted-foreground mb-4">
                    <MarkdownContent>{currentQuestion.description}</MarkdownContent>
                  </div>
                ) : null}

                {currentQuestion.codeSnippet && (
                  <pre
                    className="p-4 rounded-lg bg-secondary/80 text-sm font-mono overflow-x-auto mb-4"
                    data-testid="question-code"
                  >
                    <code>{currentQuestion.codeSnippet}</code>
                  </pre>
                )}

                {currentQuestion.imageUrl && (
                  <img
                    src={currentQuestion.imageUrl}
                    alt="Question illustration"
                    loading="lazy"
                    className="max-w-full max-h-96 rounded-lg border border-border mb-4"
                  />
                )}

                {isMultiple && !currentFeedback && (
                  <p
                    className="text-xs font-mono text-primary mt-4"
                    aria-live="polite"
                  >
                    {selectCount
                      ? `Choose ${selectCount} · ${selectedCount}/${selectCount} selected`
                      : "Select all that apply"}
                  </p>
                )}

                <div className="space-y-3 mt-6">
                  {currentQuestion.choices.map((choice) => {
                    const isSelected = (
                      answers[currentQuestion.id] || []
                    ).includes(choice.id);
                    if (currentFeedback) {
                      const isRight =
                        currentFeedback.correctChoiceIds.includes(choice.id);
                      const isWrongPick =
                        !isRight &&
                        currentFeedback.selectedChoiceIds.includes(choice.id);
                      return (
                        <button
                          key={choice.id}
                          disabled
                          aria-pressed={isSelected}
                          className={`w-full text-left p-4 rounded-lg border text-sm flex items-start cursor-default ${
                            isRight
                              ? "border-accent bg-accent/10 text-foreground"
                              : isWrongPick
                                ? "border-destructive bg-destructive/10 text-foreground"
                                : "border-border bg-secondary/30 text-muted-foreground"
                          }`}
                        >
                          <span className="font-mono font-semibold mr-3 text-muted-foreground">
                            {choice.label.toUpperCase()}
                          </span>
                          <span className="flex-1">{choice.content}</span>
                          {isRight && (
                            <Check
                              className="h-4 w-4 text-accent shrink-0 ml-2"
                              aria-label="Correct answer"
                            />
                          )}
                          {isWrongPick && (
                            <X
                              className="h-4 w-4 text-destructive shrink-0 ml-2"
                              aria-label="Your answer"
                            />
                          )}
                        </button>
                      );
                    }
                    // "Choose N" reached: other choices wait for a deselect.
                    const isBlocked = atSelectLimit && !isSelected;
                    const isEliminated = (
                      eliminated[currentQuestion.id] ?? []
                    ).includes(choice.id);
                    const letter = choice.label.toUpperCase();
                    return (
                      <div key={choice.id} className="flex items-stretch gap-2">
                        <button
                          onClick={() =>
                            selectAnswer(currentQuestion.id, choice.id)
                          }
                          // Right-click crosses a choice out, as in Pearson VUE.
                          onContextMenu={(e) => {
                            e.preventDefault();
                            toggleEliminated(currentQuestion.id, choice.id);
                          }}
                          role={isMultiple ? "checkbox" : undefined}
                          aria-checked={isMultiple ? isSelected : undefined}
                          aria-pressed={isMultiple ? undefined : isSelected}
                          aria-disabled={isBlocked || undefined}
                          data-eliminated={isEliminated || undefined}
                          className={`flex-1 text-left p-4 rounded-lg border transition-all text-sm ${
                            isSelected
                              ? "border-primary bg-primary/10 text-foreground"
                              : isBlocked
                                ? "border-border bg-secondary/30 text-muted-foreground cursor-not-allowed"
                                : "border-border bg-secondary/50 text-foreground hover:border-primary/30"
                          } ${isEliminated && !isSelected ? "opacity-50" : ""}`}
                        >
                          <span className="font-mono font-semibold mr-3 text-muted-foreground">
                            {letter}
                          </span>
                          <span className={isEliminated ? "line-through" : ""}>
                            {choice.content}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            toggleEliminated(currentQuestion.id, choice.id)
                          }
                          aria-pressed={isEliminated}
                          aria-label={`${isEliminated ? "Restore" : "Cross out"} choice ${letter}`}
                          title="Cross out (or right-click the choice)"
                          className={`px-2 rounded-lg border border-transparent hover:border-border transition-colors ${
                            isEliminated
                              ? "text-foreground"
                              : "text-muted-foreground/60 hover:text-muted-foreground"
                          }`}
                        >
                          <Strikethrough className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {currentFeedback && (
                  <AnswerFeedbackPanel
                    ref={feedbackHeadingRef}
                    feedback={currentFeedback}
                    choices={currentQuestion.choices}
                  />
                )}

                {currentQuestion.tags && currentQuestion.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-6">
                    {currentQuestion.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => i - 1)}
                  className="font-mono"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                {isInteractive && !currentFeedback ? (
                  <div className="flex items-center gap-2">
                    {/* Move past a question without locking it. */}
                    {!isLastQuestion && (
                      <Button
                        variant="ghost"
                        onClick={() => setCurrentIndex((i) => i + 1)}
                        className="font-mono text-muted-foreground"
                      >
                        Skip
                      </Button>
                    )}
                    <Button
                      disabled={!hasSelection || !!checkingId}
                      onClick={() => onCheck?.(currentQuestion.id)}
                      className="font-mono"
                    >
                      {checkingId === currentQuestion.id && (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      )}
                      Check answer
                    </Button>
                  </div>
                ) : isInteractive && isLastQuestion ? (
                  <Button
                    onClick={() => setReviewOpen(true)}
                    className="font-mono"
                  >
                    Finish exam
                  </Button>
                ) : isInteractive ? (
                  <Button
                    onClick={() => setCurrentIndex((i) => i + 1)}
                    className="font-mono"
                  >
                    Next question <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={currentIndex === questions.length - 1}
                    onClick={() => setCurrentIndex((i) => i + 1)}
                    className="font-mono"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Question Navigator */}
        <div className="hidden lg:block w-56 shrink-0">
          <div className="glass-card p-4 sticky top-20">
            <div className="text-sm font-mono font-semibold mb-3">
              Questions
            </div>
            <QuestionNavigator
              questions={questions}
              currentIndex={currentIndex}
              answers={answers}
              marked={marked}
              feedback={feedback}
              showVerdicts={isInteractive}
              onSelect={setCurrentIndex}
            />
            <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
              <Keyboard className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                1–9 / A–I choose · ←/→ move · F flag
                {isInteractive ? " · Enter check" : ""}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Question navigator on small screens */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-mono">Questions</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <QuestionNavigator
              questions={questions}
              currentIndex={currentIndex}
              answers={answers}
              marked={marked}
              feedback={feedback}
              showVerdicts={isInteractive}
              onSelect={(i) => {
                setCurrentIndex(i);
                setNavOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ExamReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        questions={questions}
        answers={answers}
        marked={marked}
        onGoTo={setCurrentIndex}
        submitting={!!checkingId}
        onSubmit={() => {
          setReviewOpen(false);
          onSubmit();
        }}
      />
    </div>
  );
}

function SaveIndicator({ status }: { status?: SaveStatus }) {
  if (!status || status === "idle") return null;
  const content =
    status === "saving" ? (
      <>
        <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" /> Saving…
      </>
    ) : status === "error" ? (
      <>
        <CloudOff className="h-3.5 w-3.5" aria-hidden="true" /> Offline —
        retrying
      </>
    ) : (
      <>
        <Cloud className="h-3.5 w-3.5" aria-hidden="true" /> Saved
      </>
    );
  return (
    <span
      role="status"
      data-testid="save-status"
      className={`hidden sm:flex items-center gap-1 text-xs font-mono ${
        status === "error" ? "text-warning" : "text-muted-foreground"
      }`}
    >
      {content}
    </span>
  );
}
