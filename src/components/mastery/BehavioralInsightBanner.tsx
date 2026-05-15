import { useState, useEffect } from "react";
import { Brain, Clock, Lightbulb, TrendingDown } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { BehavioralInsight } from "@/services/insights";

interface BehavioralInsightBannerProps {
  insight: BehavioralInsight;
}

export function BehavioralInsightBanner({
  insight,
}: BehavioralInsightBannerProps) {
  const [dismissed, setDismissed] = useState(
    localStorage.getItem(`dismissed_insight_${insight.id}`) === "true",
  );

  // Update dismissed state when insight changes
  useEffect(() => {
    setDismissed(
      localStorage.getItem(`dismissed_insight_${insight.id}`) === "true",
    );
  }, [insight.id]);

  if (dismissed) return null;

  const { title, description, icon: Icon } = getInsightDisplay(insight.kind);
  const bgColor = getSeverityColor(insight.severity);

  const handleDismiss = () => {
    localStorage.setItem(`dismissed_insight_${insight.id}`, "true");
    setDismissed(true);
  };

  return (
    <Alert
      className={`mb-6 border-yellow-200 ${bgColor} dark:border-yellow-900`}
    >
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{description}</span>
        <button
          onClick={handleDismiss}
          className="whitespace-nowrap text-xs underline hover:no-underline"
        >
          Dismiss
        </button>
      </AlertDescription>
    </Alert>
  );
}

interface InsightDisplay {
  title: string;
  description: string;
  icon: typeof Lightbulb;
}

function getInsightDisplay(kind: BehavioralInsight["kind"]): InsightDisplay {
  switch (kind) {
    case "slow_on_long_stems":
      return {
        title: "Reading Speed Pattern Detected",
        description:
          "You tend to take longer on questions with longer text. Practice skimming key details.",
        icon: Clock,
      };
    case "accuracy_decline_after_30min":
      return {
        title: "Fatigue Pattern Detected",
        description:
          "Your accuracy drops after 30 minutes of studying. Take breaks more frequently.",
        icon: Brain,
      };
    case "domain_streak_break":
      return {
        title: "Domain Review Needed",
        description:
          "You haven't reviewed this domain in over a week. Spaced repetition works best with consistency.",
        icon: TrendingDown,
      };
  }
}

function getSeverityColor(severity: BehavioralInsight["severity"]): string {
  switch (severity) {
    case "high":
      return "bg-red-50 dark:bg-red-950";
    case "medium":
      return "bg-orange-50 dark:bg-orange-950";
    case "low":
      return "bg-amber-50 dark:bg-amber-950";
  }
}
