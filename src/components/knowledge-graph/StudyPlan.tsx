import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Loader2, CheckCircle2, XCircle, Plus } from "lucide-react";
import {
  listStudyPlans,
  createStudyPlan,
  StudyPlanDto,
} from "../../services/knowledgeGraph";

interface Props {
  targetCertId: string;
  targetCertName?: string;
}

export function StudyPlanPanel({ targetCertId, targetCertName }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: plans, isLoading } = useQuery({
    queryKey: ["study-plans"],
    queryFn: listStudyPlans,
    staleTime: 30_000,
  });

  const generate = useMutation({
    mutationFn: () => createStudyPlan(targetCertId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-plans"] }),
  });

  const forThisCert =
    plans?.filter((p) => p.targetCertId === targetCertId) ?? [];

  return (
    <section className="study-plan-panel" aria-label="Study plans">
      <div className="study-plan-header">
        <h3 className="study-plan-title">
          <BookOpen size={16} />
          Study Plans{targetCertName ? ` — ${targetCertName}` : ""}
        </h3>
        <button
          className="study-plan-generate-btn"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          aria-label="Generate new study plan"
        >
          {generate.isPending ? (
            <Loader2 size={14} className="study-plan-spin" />
          ) : (
            <Plus size={14} />
          )}
          Generate Plan
        </button>
      </div>

      {generate.isError && (
        <p className="study-plan-error" role="alert">
          Failed to generate plan. Try again.
        </p>
      )}

      {isLoading && (
        <div className="study-plan-loading" aria-busy="true">
          <Loader2 size={16} className="study-plan-spin" />
          <span>Loading plans…</span>
        </div>
      )}

      {!isLoading && forThisCert.length === 0 && (
        <p className="study-plan-empty">
          No plans yet. Generate one to see which topics you can skip based on
          your existing certifications.
        </p>
      )}

      {forThisCert.length > 0 && (
        <ul className="study-plan-list">
          {forThisCert.map((plan) => {
            const key = plan.id ?? plan.createdAt ?? Math.random().toString();
            return (
              <StudyPlanCard
                key={key}
                plan={plan}
                expanded={expanded === key}
                onToggle={() =>
                  setExpanded((prev) => (prev === key ? null : key))
                }
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StudyPlanCard({
  plan,
  expanded,
  onToggle,
}: {
  plan: StudyPlanDto;
  expanded: boolean;
  onToggle: () => void;
}) {
  const date = plan.createdAt
    ? new Date(plan.createdAt).toLocaleDateString()
    : null;

  return (
    <li className="study-plan-card">
      <button
        className="study-plan-card-header"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="study-plan-reduction">
          {plan.effortReductionPct}% effort saved
        </span>
        <span className="study-plan-meta">
          {plan.skippableCount}/{plan.totalTopics} topics skippable
          {date && <span className="study-plan-date"> · {date}</span>}
        </span>
        <span className="study-plan-chevron" aria-hidden="true">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className="study-plan-body">
          {plan.skipTopics.length > 0 && (
            <div className="study-plan-section">
              <h4 className="study-plan-section-title">
                <CheckCircle2 size={14} className="study-plan-icon--skip" />
                Can skip ({plan.skipTopics.length})
              </h4>
              <ul className="study-plan-topics">
                {plan.skipTopics.map((t) => (
                  <li
                    key={t}
                    className="study-plan-topic study-plan-topic--skip"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plan.mustLearnTopics.length > 0 && (
            <div className="study-plan-section">
              <h4 className="study-plan-section-title">
                <XCircle size={14} className="study-plan-icon--must" />
                Must study ({plan.mustLearnTopics.length})
              </h4>
              <ul className="study-plan-topics">
                {plan.mustLearnTopics.map((t) => (
                  <li
                    key={t}
                    className="study-plan-topic study-plan-topic--must"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
