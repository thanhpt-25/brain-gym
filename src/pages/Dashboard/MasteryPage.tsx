import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMastery } from "../../services/mastery";
import { MasteryHero } from "../../components/mastery/MasteryHero";
import { DomainBentoCard } from "../../components/mastery/DomainBentoCard";

/**
 * Mastery Dashboard page — route: /dashboard/mastery/:certId
 *
 * Fetches domain mastery data for the given certification and renders:
 *  1. A full-width hero tile with overall readiness score
 *  2. A bento grid of per-domain cards
 */
export default function MasteryPage() {
  const { certId } = useParams<{ certId: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mastery", certId],
    queryFn: () => getMastery(certId!),
    enabled: !!certId,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <main id="main-content" className="mastery-page mastery-page--loading">
        <p className="mastery-page__loading-text" aria-live="polite">
          Loading mastery data…
        </p>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main id="main-content" className="mastery-page mastery-page--error">
        <p className="mastery-page__error-text" role="alert">
          Could not load mastery data. Please try again.
        </p>
      </main>
    );
  }

  const certName = certId ?? "Certification";

  return (
    <main id="main-content" className="mastery-page">
      <MasteryHero data={data} certName={certName} />

      {data.isEmpty ? (
        <section
          className="mastery-page__empty"
          aria-labelledby="mastery-empty-heading"
        >
          <h2 id="mastery-empty-heading" className="mastery-page__empty-title">
            No attempts yet
          </h2>
          <p className="mastery-page__empty-body">
            Complete at least one exam attempt to see your domain mastery
            breakdown.
          </p>
        </section>
      ) : (
        <section
          className="mastery-page__bento"
          aria-labelledby="mastery-domains-heading"
        >
          <h2
            id="mastery-domains-heading"
            className="mastery-page__section-title"
          >
            Domain breakdown
          </h2>
          <ul className="mastery-bento-grid" role="list">
            {data.domains.map((domain, index) => (
              <li key={domain.domainId}>
                <DomainBentoCard domain={domain} colorIndex={index} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
