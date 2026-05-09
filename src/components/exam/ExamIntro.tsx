import { motion } from "framer-motion";
import { ChevronLeft, Brain, Zap, Clock, Coffee, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Certification, TimerMode } from "@/types/api-types";

interface ExamIntroProps {
  cert: Certification;
  questionCount: number;
  timerMode: TimerMode;
  onTimerModeChange: (mode: TimerMode) => void;
  onBack: () => void;
  onStart: () => void;
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
  timerMode,
  onTimerModeChange,
  onBack,
  onStart,
}: ExamIntroProps) {
  const effectiveTimeLimit =
    timerMode === "ACCELERATED" ? Math.round(130 * 0.75) : 130;

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
            {typeof cert.provider === "object"
              ? cert.provider?.name
              : cert.provider}{" "}
            · {cert.code}
          </div>
          <h1 className="text-2xl font-mono font-bold mb-2">{cert.name}</h1>
          <p className="text-muted-foreground mb-6">{cert.description}</p>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 rounded-lg bg-secondary">
              <div className="text-xl font-mono font-bold text-foreground">
                {questionCount}
              </div>
              <div className="text-xs text-muted-foreground">Questions</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary">
              <div className="text-xl font-mono font-bold text-foreground">
                {effectiveTimeLimit}m
              </div>
              <div className="text-xs text-muted-foreground">Time Limit</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary">
              <div className="text-xl font-mono font-bold text-foreground">
                70%
              </div>
              <div className="text-xs text-muted-foreground">Pass Score</div>
            </div>
          </div>

          {/* Timer Mode Selector */}
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
              <Brain className="h-4 w-4 mr-2" /> Start Exam
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
