import { ClipboardCheck, Lightbulb } from "lucide-react";
import type { FeedbackMode } from "@/types/api-types";

interface FeedbackModeSelectorProps {
  value: FeedbackMode;
  onChange: (mode: FeedbackMode) => void;
  /** Interactive is unavailable (e.g. Time Pressure timer). */
  interactiveDisabled?: boolean;
}

const OPTIONS: {
  value: FeedbackMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "END_OF_EXAM",
    label: "Exam",
    description: "See results when you submit",
    icon: <ClipboardCheck className="h-4 w-4" />,
  },
  {
    value: "INTERACTIVE",
    label: "Interactive",
    description: "Check each answer and read the explanation",
    icon: <Lightbulb className="h-4 w-4" />,
  },
];

export function FeedbackModeSelector({
  value,
  onChange,
  interactiveDisabled = false,
}: FeedbackModeSelectorProps) {
  return (
    <div className="mb-6">
      <div className="text-sm font-mono font-semibold mb-2" id="feedback-mode-label">
        Feedback
      </div>
      <div
        className="grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-labelledby="feedback-mode-label"
      >
        {OPTIONS.map((opt) => {
          const disabled = opt.value === "INTERACTIVE" && interactiveDisabled;
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              title={
                disabled
                  ? "Interactive mode is not available for Time Pressure exams"
                  : undefined
              }
              onClick={() => onChange(opt.value)}
              className={`p-3 rounded-lg border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                selected
                  ? "text-primary border-primary/30 bg-primary/5"
                  : "border-border text-muted-foreground hover:border-border/80"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 font-mono text-xs font-semibold">
                {opt.icon}
                {opt.label}
              </div>
              <div className="text-xs opacity-70 leading-tight">
                {disabled
                  ? "Not available with Time Pressure"
                  : opt.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
