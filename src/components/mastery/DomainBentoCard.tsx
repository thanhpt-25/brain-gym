import type { DomainMastery } from "../../services/mastery";

interface DomainBentoCardProps {
  domain: DomainMastery;
  /** Index 0–4 selects the --viz-N token for the accent stripe */
  colorIndex?: number;
}

/**
 * Bento-style card showing per-domain mastery metrics.
 * Displays accuracy bar, SRS coverage, and due-card count.
 */
export function DomainBentoCard({
  domain,
  colorIndex = 0,
}: DomainBentoCardProps) {
  const vizColor = `var(--viz-${(colorIndex % 5) + 1})`;
  const accuracyPct = Math.round(domain.accuracy);
  const coveragePct = Math.round(domain.srsCoverage * 100);

  return (
    <article
      className="domain-bento-card"
      aria-label={`${domain.domainName} mastery`}
      style={{ "--domain-color": vizColor } as React.CSSProperties}
    >
      <div className="domain-bento-card__stripe" aria-hidden="true" />

      <header className="domain-bento-card__header">
        <h2 className="domain-bento-card__name">{domain.domainName}</h2>
        {domain.dueCount > 0 && (
          <span
            className="domain-bento-card__due-badge"
            aria-label={`${domain.dueCount} SRS card${domain.dueCount === 1 ? "" : "s"} due`}
          >
            {domain.dueCount} due
          </span>
        )}
      </header>

      <div className="domain-bento-card__accuracy-bar-wrap">
        <div
          className="domain-bento-card__accuracy-bar"
          role="progressbar"
          aria-valuenow={accuracyPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Accuracy ${accuracyPct}%`}
        >
          <div
            className="domain-bento-card__accuracy-fill"
            style={{ width: `${accuracyPct}%` }}
          />
        </div>
        <span className="domain-bento-card__accuracy-label">
          {accuracyPct}%
        </span>
      </div>

      <dl className="domain-bento-card__stats">
        <div className="domain-bento-card__stat">
          <dt>Answered</dt>
          <dd>{domain.totalAnswered}</dd>
        </div>
        <div className="domain-bento-card__stat">
          <dt>Correct</dt>
          <dd>{domain.totalCorrect}</dd>
        </div>
        <div className="domain-bento-card__stat">
          <dt>SRS coverage</dt>
          <dd>{coveragePct}%</dd>
        </div>
      </dl>
    </article>
  );
}
