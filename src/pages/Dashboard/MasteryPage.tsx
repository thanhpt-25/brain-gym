import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { getMastery, getNextTopic } from "../../services/mastery";
import { useReadiness } from "../../services/readiness";
import { useAuthStore } from "../../stores/auth.store";
import { ReadinessGauge } from "../../components/mastery/ReadinessGauge";
import { DomainBentoCard } from "../../components/mastery/DomainBentoCard";
import { DomainBreakdownDrawer } from "../../components/mastery/DomainBreakdownDrawer";
import { NextTopicCard } from "../../components/mastery/NextTopicCard";
import { PassLikelihoodSurveyBanner } from "../../components/mastery/PassLikelihoodSurveyBanner";

/** Map a numeric score to the canonical readiness label. */
function scoreLabelFor(score: number | undefined): string {
  if (score === undefined || score === null) return "";
  if (score >= 85) return "Strong";
  if (score >= 70) return "Ready";
  if (score >= 50) return "Borderline";
  return "Not Ready";
}

/**
 * Mastery Dashboard page — route: /dashboard/mastery/:certId
 *
 * Fetches domain mastery data for the given certification and renders:
 *  1. A full-width hero tile with overall readiness score
 *  2. A bento grid of per-domain cards
 */
export default function MasteryPage() {
  const { certId } = useParams<{ certId: string }>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const gaugeRef = useRef<HTMLButtonElement>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mastery", certId],
    queryFn: () => getMastery(certId!),
    enabled: !!certId,
    staleTime: 60_000,
  });

  const { data: readiness } = useReadiness(certId);
  const authUser = useAuthStore().user;

  const { data: nextTopicSuggestion, isLoading: isLoadingNextTopic } = useQuery(
    {
      queryKey: ["nextTopic", certId],
      queryFn: () => getNextTopic(certId!),
      enabled: !!certId,
      staleTime: 60_000,
    },
  );

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
      <ReadinessGauge
        score={readiness?.score ?? null}
        confidence={readiness?.confidence ?? 0}
        attempts={readiness?.attempts ?? data.totalAttempts}
        label={scoreLabelFor(readiness?.score)}
        isPremium={true}
        signals={readiness?.signals}
        onOpenBreakdown={() => setDrawerOpen(true)}
        breakdownTriggerRef={gaugeRef}
      />

      <NextTopicCard
        suggestion={nextTopicSuggestion ?? null}
        isLoading={isLoadingNextTopic}
        certificationId={certId ?? ""}
      />

      {authUser?.featureFlags?.passPredictorBeta && (
        <PassLikelihoodSurveyBanner certificationId={certId ?? ""} />
      )}

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

      {/* Domain breakdown drawer */}
      <DomainBreakdownDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        domains={data.domains}
        triggerRef={gaugeRef}
      />
    </main>
  );
}
