import { motion } from "framer-motion";
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DomainPerformance,
  ReadinessScore as ReadinessData,
} from "@/services/analytics";

interface Props {
  weakTopics: DomainPerformance[] | undefined;
  readiness?: ReadinessData;
  isLoading?: boolean;
  isError?: boolean;
  isCertSelected?: boolean;
}

type ReadinessLevel = "high" | "medium" | "low";

function levelFromScore(score: number): ReadinessLevel {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export default function ReadinessScore({
  weakTopics,
  readiness,
  isLoading,
  isError,
  isCertSelected,
}: Props) {
  // Readiness is a single backend-owned metric. The component never recomputes
  // it client-side, so the number shown here always matches the server formula
  // (recency-weighted score + weakest-domain confidence + exam-count factor).
  if (!isCertSelected) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-mono flex items-center gap-2 text-muted-foreground">
            <Shield className="h-4 w-4" /> Exam Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="h-32 flex items-center justify-center text-sm text-muted-foreground font-mono">
          Select a certification to view readiness
        </CardContent>
      </Card>
    );
  }

  // Readiness query failed — surface an error instead of a perpetual spinner.
  if (isError && !readiness) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-mono flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Exam Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="h-32 flex items-center justify-center gap-2 text-sm text-destructive font-mono">
          <AlertCircle className="h-4 w-4" /> Couldn’t load readiness
        </CardContent>
      </Card>
    );
  }

  // Certification selected but the readiness query has not resolved yet.
  if (isLoading || !readiness) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-mono flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Exam Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="h-32 flex items-center justify-center gap-2 text-sm text-muted-foreground font-mono">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculating readiness…
        </CardContent>
      </Card>
    );
  }

  const score = Math.min(
    100,
    Math.max(0, Math.round(readiness.readinessScore)),
  );
  const weightedAvg = Math.round(readiness.weightedAvgScore);
  const examCount = readiness.totalExams;
  const level = levelFromScore(score);

  const colorMap = {
    high: { ring: "hsl(var(--accent))", text: "text-accent", label: "Ready" },
    medium: {
      ring: "hsl(var(--warning))",
      text: "text-warning",
      label: "Almost There",
    },
    low: {
      ring: "hsl(var(--destructive))",
      text: "text-destructive",
      label: "Keep Practicing",
    },
  };
  const c = colorMap[level];

  const circumference = 2 * Math.PI * 54;
  const strokeOffset = circumference - (score / 100) * circumference;

  const recommendedDomains = (weakTopics ?? [])
    .filter((d) => d.percentage < 70)
    .slice(0, 3);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-mono flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> Exam Readiness
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row items-center gap-6">
        {/* Circular gauge */}
        <div className="relative w-32 h-32 shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="hsl(var(--secondary))"
              strokeWidth="8"
            />
            <motion.circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke={c.ring}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: strokeOffset }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold font-mono ${c.text}`}>
              {score}%
            </span>
            <span className="text-[10px] text-muted-foreground">{c.label}</span>
          </div>
        </div>

        <div className="flex-1 space-y-4 min-w-0">
          {/* Recency-weighted average score — a real, server-computed metric */}
          <div className="flex items-center gap-3">
            <TrendingUp className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-1">
                Recent weighted avg score
                <span className="ml-1 text-muted-foreground/60">
                  ({examCount} {examCount === 1 ? "exam" : "exams"})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: c.ring }}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, Math.max(0, weightedAvg))}%`,
                    }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                  />
                </div>
                <span className={`text-sm font-mono font-bold ${c.text}`}>
                  {weightedAvg}%
                </span>
              </div>
            </div>
          </div>

          {/* Recommended domains */}
          {recommendedDomains.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs text-muted-foreground">
                  Focus Areas
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recommendedDomains.map((d) => (
                  <span
                    key={d.domain}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-warning/10 text-warning text-[11px] font-mono"
                  >
                    {d.domain}
                    <span className="text-warning/60">{d.percentage}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
