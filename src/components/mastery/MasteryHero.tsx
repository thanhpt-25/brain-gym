import type { MasteryData } from "../../services/mastery";

interface MasteryHeroProps {
  data: MasteryData;
  certName: string;
}

/**
 * Full-width hero tile for the Mastery Dashboard.
 * Shows overall readiness score (average domain accuracy) and attempt count.
 * Uses editorial light / dark-luxury design tokens from tokens.css.
 */
export function MasteryHero({ data, certName }: MasteryHeroProps) {
  const avgAccuracy =
    data.domains.length > 0
      ? Math.round(
          data.domains.reduce((sum, d) => sum + d.accuracy, 0) /
            data.domains.length,
        )
      : 0;

  const readinessLabel =
    avgAccuracy >= 80
      ? "Ready"
      : avgAccuracy >= 60
        ? "Progressing"
        : "Needs Work";

  const readinessColor =
    avgAccuracy >= 80
      ? "var(--color-signal)"
      : avgAccuracy >= 60
        ? "var(--color-warn)"
        : "var(--color-danger)";

  return (
    <section
      className="mastery-hero"
      aria-labelledby="mastery-hero-heading"
      style={
        {
          "--readiness-color": readinessColor,
        } as React.CSSProperties
      }
    >
      <div className="mastery-hero__inner">
        <div className="mastery-hero__meta">
          <p className="mastery-hero__cert-name">{certName}</p>
          <h1 id="mastery-hero-heading" className="mastery-hero__title">
            Mastery Dashboard
          </h1>
        </div>

        <div className="mastery-hero__stat-group">
          <div className="mastery-hero__stat mastery-hero__stat--primary">
            <span
              className="mastery-hero__stat-value"
              aria-label={`Overall readiness: ${avgAccuracy} percent`}
            >
              {data.isEmpty ? "—" : `${avgAccuracy}%`}
            </span>
            <span className="mastery-hero__stat-label">
              {data.isEmpty ? "No data yet" : readinessLabel}
            </span>
          </div>

          <div className="mastery-hero__stat">
            <span className="mastery-hero__stat-value mastery-hero__stat-value--secondary">
              {data.totalAttempts}
            </span>
            <span className="mastery-hero__stat-label">
              {data.totalAttempts === 1 ? "Attempt" : "Attempts"}
            </span>
          </div>

          <div className="mastery-hero__stat">
            <span className="mastery-hero__stat-value mastery-hero__stat-value--secondary">
              {data.domains.length}
            </span>
            <span className="mastery-hero__stat-label">
              {data.domains.length === 1 ? "Domain" : "Domains"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
