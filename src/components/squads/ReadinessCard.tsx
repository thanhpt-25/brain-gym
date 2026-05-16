import { Loader2 } from "lucide-react";
import "./squad-dashboard.css";

interface ReadinessCardProps {
  score: number; // 0-100
  isLoading: boolean;
  certificationId: string;
}

/**
 * Displays squad readiness score as circular progress with level label
 * Adapts BehavioralInsightBanner pattern for squad-specific readiness
 */
export function ReadinessCard({
  score,
  isLoading,
  certificationId,
}: ReadinessCardProps) {
  const getLevel = (readinessScore: number) => {
    if (readinessScore < 25) return "Beginner";
    if (readinessScore < 50) return "Novice";
    if (readinessScore < 75) return "Intermediate";
    return "Advanced";
  };

  if (isLoading) {
    return <ReadinessCardSkeleton />;
  }

  return (
    <div className="readiness-card" data-testid="readiness-card">
      <h2>Squad Readiness</h2>

      {/* Circular progress visualization */}
      <div className="readiness-circle-wrapper">
        <svg className="readiness-progress-ring" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="8"
            strokeDasharray={`${(score / 100) * 340} 340`}
            strokeLinecap="round"
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "50% 50%",
              transition: "stroke-dasharray 0.5s ease",
            }}
          />
        </svg>

        {/* Score text centered in circle */}
        <div className="readiness-score-overlay">
          <p className="score-text" data-testid="readiness-score">
            {score}%
          </p>
        </div>
      </div>

      {/* Level label */}
      <div className="readiness-stats">
        <p className="level-text">{getLevel(score)}</p>
        <p className="cert-id-text">{certificationId}</p>
      </div>
    </div>
  );
}

/**
 * Skeleton loading state for readiness card
 */
function ReadinessCardSkeleton() {
  return (
    <div className="readiness-card skeleton">
      <div className="skeleton-line h-6 w-32 mb-4" />
      <div className="skeleton-line h-32 w-32 rounded-full mb-4" />
      <div className="skeleton-line h-4 w-24" />
    </div>
  );
}
