import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle, Activity, TrendingDown, Clock, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "@/services/api";

interface BurnoutStatus {
  hasBurnout: boolean;
  signal: {
    id: string;
    severity: "low" | "medium" | "high" | "critical";
    signals: Array<{
      signal: string;
      score: number;
      weight: number;
      contribution: number;
      metadata: Record<string, any>;
    }>;
    recommendedAction: string;
    detectedAt: string;
  } | null;
}

const severityColors = {
  low: "bg-blue-500/10 text-blue-600 border-blue-200",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  high: "bg-orange-500/10 text-orange-600 border-orange-200",
  critical: "bg-red-500/10 text-red-600 border-red-200",
};

const actionLabels: Record<string, string> = {
  NO_ACTION: "Continue learning",
  MONITOR_CLOSELY: "Keep monitoring your progress",
  SUGGEST_BREAK: "Consider taking a break",
  SUGGEST_COACH_CONVERSATION: "Chat with your AI Coach",
  ESCALATE_TO_COACH_INTERVENTION: "Priority: Coach intervention recommended",
};

export const BurnoutIndicator = () => {
  const navigate = useNavigate();

  const { data: burnoutStatus } = useQuery<BurnoutStatus>({
    queryKey: ["burnout-status"],
    queryFn: async () => {
      const response = await api.get("/training/burnout/current");
      return response.data;
    },
    refetchInterval: 5 * 60 * 1000, // Recheck every 5 minutes
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (signalId: string) => {
      return api.post(`/training/burnout/${signalId}/acknowledge`);
    },
  });

  if (!burnoutStatus?.hasBurnout || !burnoutStatus.signal) {
    return null;
  }

  const signal = burnoutStatus.signal;
  const severity = signal.severity as keyof typeof severityColors;
  const colorClass = severityColors[severity] || severityColors.low;
  const actionLabel = actionLabels[signal.recommendedAction] || "Keep learning";

  const getIcon = () => {
    switch (severity) {
      case "critical":
      case "high":
        return <AlertCircle className="h-5 w-5" />;
      case "medium":
        return <Activity className="h-5 w-5" />;
      default:
        return <TrendingDown className="h-5 w-5" />;
    }
  };

  const signalSummary = signal.signals
    .slice(0, 2)
    .map((s) => {
      const icons: Record<string, React.ReactNode> = {
        scoreDecline: "📉 Score declining",
        timeAllocation: "⏱️ Long study hours",
        attemptFrequency: "⚡ Many attempts",
        errorRate: "❌ More mistakes",
      };
      return icons[s.signal] || s.signal;
    })
    .join(" • ");

  const severityTooltips: Record<string, string> = {
    critical:
      "Your study pattern shows signs of exhaustion. We strongly recommend taking a break. Your AI Coach is ready to help you develop a healthier study plan.",
    high: "You're showing significant burnout signals. A brief study break is recommended. Your coach can help identify patterns and suggest optimizations.",
    medium:
      "Monitor your study pace closely. Consider spacing out your study sessions to avoid fatigue and maintain long-term progress.",
    low: "All looks good! You're maintaining a healthy study pace. Keep up your current rhythm while staying mindful of balance.",
  };

  return (
    <Card className={`border ${colorClass} bg-opacity-50`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {getIcon()}
            <CardTitle className="text-sm">
              {severity === "critical" && "⚠️ Burnout Alert"}
              {severity === "high" && "⚠️ High Burnout Risk"}
              {severity === "medium" && "⚠️ Burnout Warning"}
              {severity === "low" && "📊 Burnout Monitor"}
            </CardTitle>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs bg-secondary text-secondary-foreground border border-primary/20">
                <p className="text-xs">{severityTooltips[severity]}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{signalSummary}</p>

        <div className="space-y-2">
          <p className="text-xs font-semibold">Recommended action:</p>
          <p className="text-sm">{actionLabel}</p>
        </div>

        <div className="flex gap-2">
          {severity !== "low" && (
            <Button
              size="sm"
              className="flex-1 font-mono text-xs"
              onClick={() => navigate("/dashboard/coach")}
            >
              Chat with Coach
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="font-mono text-xs"
            onClick={() => acknowledgeMutation.mutate(signal.id)}
            disabled={acknowledgeMutation.isPending}
          >
            Dismiss
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="font-mono text-xs h-8 px-2"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm bg-secondary text-secondary-foreground border border-primary/20">
                <p className="text-xs font-mono">
                  This feature monitors your study patterns to help prevent burnout. Learn more in our{" "}
                  <a
                    href="/docs/burnout-guide"
                    className="underline hover:no-underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    user guide
                  </a>
                  .
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {severity === "critical" && (
          <div className="text-xs text-red-600/70 flex items-center gap-2 bg-red-500/5 p-2 rounded border border-red-200/50">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>
              Take a 30-minute break. Burnout impacts learning retention. Your coach is
              ready to help with a recovery plan.
            </span>
          </div>
        )}

        {severity === "high" && (
          <div className="text-xs text-orange-600/70 flex items-center gap-2 bg-orange-500/5 p-2 rounded border border-orange-200/50">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>
              Consider taking a 15-20 minute break. Pacing your studies improves long-term
              retention.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
