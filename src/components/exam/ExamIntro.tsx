import { motion } from "framer-motion";
import {
  ChevronLeft,
  Brain,
  Zap,
  Clock,
  Coffee,
  Flame,
  History,
  BookOpen,
  Target,
  GraduationCap,
  RotateCcw,
  Sparkles,
  Crosshair,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ActiveAttemptSummary,
  Certification,
  FeedbackMode,
  TimerMode,
} from "@/types/api-types";
import MarkdownContent from "@/components/ui/MarkdownContent";
import { FeedbackModeSelector } from "@/components/exam/FeedbackModeSelector";
import { supportsInteractive } from "@/lib/exam-feedback-mode";
import {
  FontScale,
  PracticeSetup,
  SHORT_SESSION_SIZES,
  TIME_MULTIPLIERS,
} from "@/lib/exam-plan";
import type { PracticeMode } from "@/types/api-types";

interface ExamIntroProps {
  cert: Certification;
  /** Questions in the exam that Start creates for the selected timer mode. */
  questionCount: number;
  /** Minutes the learner gets for the selected timer mode. */
  timeLimitMinutes: number;
  /** An unfinished attempt for this certification, if any. */
  activeAttempt?: ActiveAttemptSummary | null;
  onResume?: () => void;
  onDiscardActive?: () => void;
  /** What kind of practice to start; defaults to a standard practice exam. */
  setup?: PracticeSetup;
  onSetupChange?: (setup: PracticeSetup) => void;
  fontScale?: FontScale;
  onFontScaleChange?: (scale: FontScale) => void;
  timerMode: TimerMode;
  onTimerModeChange: (mode: TimerMode) => void;
  feedbackMode: FeedbackMode;
  onFeedbackModeChange: (mode: FeedbackMode) => void;
  onBack: () => void;
  onStart: () => void;
}

const PRACTICE_MODES: {
  value: PracticeMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "STANDARD",
    label: "Practice",
    description: "Blueprint-weighted, favours new & missed questions",
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    value: "QUICK_DRILL",
    label: "Quick Drill",
    description: "10–30 questions, pick domains & difficulty",
    icon: <Target className="h-4 w-4" />,
  },
  {
    value: "FULL_MOCK",
    label: "Full Mock",
    description: "Real exam conditions: no labels, no hints",
    icon: <GraduationCap className="h-4 w-4" />,
  },
  {
    value: "REVIEW",
    label: "Review Mistakes",
    description: "Only questions you missed or flagged",
    icon: <RotateCcw className="h-4 w-4" />,
  },
  {
    value: "ADAPTIVE",
    label: "Adaptive Practice",
    description: "Questions matched to your current level",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    value: "CAT",
    label: "Adaptive Test (CAT)",
    description:
      "Each question adapts to your answers; ends once your level is measured",
    icon: <Crosshair className="h-4 w-4" />,
  },
];

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

const FONT_SCALES: { value: FontScale; label: string }[] = [
  { value: "sm", label: "A−" },
  { value: "md", label: "A" },
  { value: "lg", label: "A+" },
];

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

const TIMER_MODES: {
  value: TimerMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    value: "RELAXED",
    label: "Relaxed",
    description: "No time pressure indicators",
    icon: <Coffee className="h-4 w-4" />,
    color: "text-accent border-accent/30 bg-accent/5",
  },
  {
    value: "STRICT",
    label: "Standard",
    description: "Red timer at 5 min remaining",
    icon: <Clock className="h-4 w-4" />,
    color: "text-primary border-primary/30 bg-primary/5",
  },
  {
    value: "ACCELERATED",
    label: "Accelerated",
    description: "0.75× time budget, pressure warnings",
    icon: <Zap className="h-4 w-4" />,
    color: "text-orange-400 border-orange-400/30 bg-orange-400/5",
  },
  {
    value: "TIME_PRESSURE",
    label: "Time Pressure",
    description: "65 questions / 90 minutes — exam simulation",
    icon: <Flame className="h-4 w-4" />,
    color: "text-red-500 border-red-500/30 bg-red-500/5",
  },
];

export function ExamIntro({
  cert,
  questionCount,
  timeLimitMinutes,
  activeAttempt,
  onResume,
  onDiscardActive,
  setup,
  onSetupChange,
  fontScale = "md",
  onFontScaleChange,
  timerMode,
  onTimerModeChange,
  feedbackMode,
  onFeedbackModeChange,
  onBack,
  onStart,
}: ExamIntroProps) {
  const passingScore = cert.passingScore ?? 70;
  const mode = setup?.mode ?? "STANDARD";
  const isFullMock = mode === "FULL_MOCK";
  const update = (patch: Partial<PracticeSetup>) =>
    setup && onSetupChange?.({ ...setup, ...patch });
  const minutesLeft = activeAttempt?.expiresAt
    ? Math.max(
        0,
        Math.round((Date.parse(activeAttempt.expiresAt) - Date.now()) / 60_000),
      )
    : null;

  return (
    <div className="min-h-screen bg-background bg-grid">
      <div className="container max-w-2xl py-20">
        <Button
          variant="ghost"
          className="mb-8 text-muted-foreground"
          onClick={onBack}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8"
        >
          <div className="text-sm font-mono text-muted-foreground mb-1">
            {typeof cert.provider === "object" && cert.provider
              ? cert.provider.name
              : "Provider"}{" "}
            · {cert.code}
          </div>
          <h1 className="text-2xl font-mono font-bold mb-2">{cert.name}</h1>
          {cert.description && (
            <div className="text-muted-foreground mb-6">
              <MarkdownContent size="text-base">
                {cert.description}
              </MarkdownContent>
            </div>
          )}

          {activeAttempt && (
            <div
              role="region"
              aria-label="Unfinished exam"
              className="mb-6 p-4 rounded-lg border border-primary/30 bg-primary/5"
            >
              <div className="flex items-center gap-2 text-sm font-mono font-semibold text-primary mb-1">
                <History className="h-4 w-4" aria-hidden="true" />
                You have an unfinished exam
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {activeAttempt.answeredCount}/{activeAttempt.totalQuestions}{" "}
                answered
                {minutesLeft !== null && ` · ${minutesLeft}m left`} — your
                answers are saved and the timer keeps running.
              </p>
              <div className="flex gap-2">
                <Button size="sm" className="font-mono" onClick={onResume}>
                  Resume exam
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="font-mono text-muted-foreground"
                  onClick={onDiscardActive}
                >
                  Discard
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 rounded-lg bg-secondary">
              <div className="text-xl font-mono font-bold text-foreground">
                {questionCount}
              </div>
              <div className="text-xs text-muted-foreground">Questions</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary">
              <div className="text-xl font-mono font-bold text-foreground">
                {timeLimitMinutes}m
              </div>
              <div className="text-xs text-muted-foreground">Time Limit</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary">
              <div className="text-xl font-mono font-bold text-foreground">
                {passingScore}%
              </div>
              <div className="text-xs text-muted-foreground">Pass Score</div>
            </div>
          </div>

          {setup && onSetupChange && (
            <div className="mb-6">
              <div
                className="text-sm font-mono font-semibold mb-2"
                id="practice-mode-label"
              >
                Mode
              </div>
              <div
                role="radiogroup"
                aria-labelledby="practice-mode-label"
                className="grid grid-cols-2 sm:grid-cols-3 gap-2"
              >
                {PRACTICE_MODES.map((m) => (
                  <button
                    key={m.value}
                    role="radio"
                    aria-checked={mode === m.value}
                    onClick={() => update({ mode: m.value })}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      mode === m.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 font-mono text-xs font-semibold">
                      {m.icon}
                      {m.label}
                    </div>
                    <div className="text-xs opacity-70 leading-tight">
                      {m.description}
                    </div>
                  </button>
                ))}
              </div>

              {(mode === "QUICK_DRILL" ||
                mode === "REVIEW" ||
                mode === "ADAPTIVE" ||
                mode === "CAT") && (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground font-mono w-20">
                    {mode === "CAT" ? "Up to" : "Questions"}
                  </span>
                  {SHORT_SESSION_SIZES.map((n) => (
                    <Button
                      key={n}
                      size="sm"
                      variant={setup.sessionSize === n ? "secondary" : "ghost"}
                      aria-pressed={setup.sessionSize === n}
                      className="font-mono h-7"
                      onClick={() => update({ sessionSize: n })}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              )}

              {mode === "QUICK_DRILL" && (
                <>
                  {cert.domains && cert.domains.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-foreground font-mono w-20">
                        Domains
                      </span>
                      {cert.domains.map((d) => (
                        <button
                          key={d.id}
                          aria-pressed={setup.domainIds.includes(d.id)}
                          onClick={() =>
                            update({ domainIds: toggle(setup.domainIds, d.id) })
                          }
                          className={`px-2 py-1 rounded-full border ${
                            setup.domainIds.includes(d.id)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {d.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground font-mono w-20">
                      Difficulty
                    </span>
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d}
                        aria-pressed={setup.difficulties.includes(d)}
                        onClick={() =>
                          update({
                            difficulties: toggle(setup.difficulties, d),
                          })
                        }
                        className={`px-2 py-1 rounded-full border font-mono ${
                          setup.difficulties.includes(d)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                    <span className="text-muted-foreground">
                      (none selected = all)
                    </span>
                  </div>
                </>
              )}

              {mode === "CAT" && (
                <p className="mt-3 text-xs text-muted-foreground">
                  One question at a time, picked from your previous answers. No
                  going back; the test stops early once your level is measured
                  precisely (at least 10 questions).
                </p>
              )}

              {isFullMock && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Strict timer, no difficulty or domain labels and no
                  per-question feedback — just like exam day.
                </p>
              )}
            </div>
          )}

          {/* Timer Mode Selector */}
          {!isFullMock && (
            <div className="mb-6">
              <div className="text-sm font-mono font-semibold mb-2">
                Timer Mode
              </div>
              <div className="grid grid-cols-4 gap-2">
                {TIMER_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => onTimerModeChange(mode.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      timerMode === mode.value
                        ? `${mode.color} border-opacity-100`
                        : "border-border text-muted-foreground hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 font-mono text-xs font-semibold">
                      {mode.icon}
                      {mode.label}
                    </div>
                    <div className="text-xs opacity-70 leading-tight">
                      {mode.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <FeedbackModeSelector
            value={feedbackMode}
            onChange={onFeedbackModeChange}
            interactiveDisabled={
              isFullMock || mode === "CAT" || !supportsInteractive(timerMode)
            }
            disabledReason={
              isFullMock
                ? "a full mock"
                : mode === "CAT"
                  ? "an adaptive test"
                  : "Time Pressure"
            }
          />

          {setup && onSetupChange && (
            <div className="mb-6">
              <div className="text-sm font-mono font-semibold mb-2">
                Accessibility
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div
                  className="flex items-center gap-1"
                  role="group"
                  aria-label="Extra time"
                >
                  <span className="text-muted-foreground font-mono mr-1">
                    Extra time
                  </span>
                  {TIME_MULTIPLIERS.map((m) => (
                    <Button
                      key={m}
                      size="sm"
                      variant={
                        setup.timeMultiplier === m ? "secondary" : "ghost"
                      }
                      aria-pressed={setup.timeMultiplier === m}
                      className="font-mono h-7"
                      onClick={() => update({ timeMultiplier: m })}
                    >
                      {m === 1 ? "None" : `×${m}`}
                    </Button>
                  ))}
                </div>
                {onFontScaleChange && (
                  <div
                    className="flex items-center gap-1"
                    role="group"
                    aria-label="Text size"
                  >
                    <span className="text-muted-foreground font-mono mr-1">
                      Text size
                    </span>
                    {FONT_SCALES.map((f) => (
                      <Button
                        key={f.value}
                        size="sm"
                        variant={fontScale === f.value ? "secondary" : "ghost"}
                        aria-pressed={fontScale === f.value}
                        aria-label={`Text size ${f.value === "sm" ? "small" : f.value === "lg" ? "large" : "normal"}`}
                        className="font-mono h-7"
                        onClick={() => onFontScaleChange(f.value)}
                      >
                        {f.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {cert.domains && cert.domains.length > 0 && (
            <div className="mb-6">
              <div className="text-sm font-mono font-semibold mb-2">
                Domains
              </div>
              <div className="flex flex-wrap gap-2">
                {cert.domains.map((d) => (
                  <span
                    key={d.id}
                    className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
                  >
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {questionCount === 0 ? (
            <p className="text-sm text-destructive font-mono text-center py-4">
              No approved questions available for this certification yet.
            </p>
          ) : (
            <Button
              className="w-full glow-cyan font-mono"
              size="lg"
              onClick={onStart}
            >
              <Brain className="h-4 w-4 mr-2" />{" "}
              {activeAttempt ? "Start New Exam" : "Start Exam"}
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
