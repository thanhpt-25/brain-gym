import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Zap,
  RotateCcw,
  Loader2,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import api from "../../services/api";

interface AutoApplyDecision {
  shouldApply: boolean;
  reason: string;
  cohort: string;
  approvedCount: number;
  threshold: number;
}

interface QuestionVariant {
  id: string;
  questionId: string;
  reason: string;
  status: string;
  createdAt: string;
}

async function fetchAutoApplied(): Promise<QuestionVariant[]> {
  const res = await api.get<QuestionVariant[]>(
    "/ai-question-bank/dds/pending",
    {
      params: { limit: 50 },
    },
  );
  return res.data.filter((v) => v.status === "AUTO_APPLIED");
}

async function evaluateVariant(variantId: string): Promise<AutoApplyDecision> {
  const res = await api.get<AutoApplyDecision>(
    `/ai-question-bank/dds/variants/${variantId}/auto-apply/evaluate`,
  );
  return res.data;
}

async function triggerAutoApply(variantId: string) {
  return api.post(`/ai-question-bank/dds/variants/${variantId}/auto-apply`);
}

async function rollbackVariant(variantId: string) {
  return api.patch(`/ai-question-bank/dds/variants/${variantId}/rollback`);
}

export function DdsAutoApplyPanel() {
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [decision, setDecision] = useState<AutoApplyDecision | null>(null);
  const qc = useQueryClient();

  const { data: variants, isLoading } = useQuery({
    queryKey: ["dds-auto-applied"],
    queryFn: fetchAutoApplied,
    staleTime: 30_000,
  });

  const evaluate = useMutation({
    mutationFn: (variantId: string) => {
      setEvaluatingId(variantId);
      return evaluateVariant(variantId);
    },
    onSuccess: (data) => setDecision(data),
    onSettled: () => setEvaluatingId(null),
  });

  const apply = useMutation({
    mutationFn: (variantId: string) => triggerAutoApply(variantId),
    onSuccess: () => {
      setDecision(null);
      qc.invalidateQueries({ queryKey: ["dds-auto-applied"] });
    },
  });

  const rollback = useMutation({
    mutationFn: (variantId: string) => rollbackVariant(variantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dds-auto-applied"] }),
  });

  const shadowMode = import.meta.env.VITE_DDS_SHADOW_MODE !== "false";

  return (
    <section className="dds-auto-panel" aria-label="DDS auto-apply management">
      <div className="dds-auto-header">
        <h3 className="dds-auto-title">
          <Zap size={16} />
          DDS Auto-Apply
        </h3>
        {shadowMode && (
          <span className="dds-shadow-badge" aria-label="Shadow mode active">
            <ShieldAlert size={13} /> Shadow mode
          </span>
        )}
      </div>

      <p className="dds-auto-description">
        Variants that meet the cohort approval threshold are auto-applied. In
        shadow mode, decisions are logged but not committed.
      </p>

      {decision && evaluatingId && (
        <div
          className={`dds-decision dds-decision--${decision.shouldApply ? "go" : "hold"}`}
          role="status"
        >
          <strong>
            {decision.shouldApply ? "Ready to apply" : "Not ready"}
          </strong>
          <span>{decision.reason}</span>
          <span>
            {decision.approvedCount}/{decision.threshold} approvals (cohort:{" "}
            {decision.cohort})
          </span>
          {decision.shouldApply && (
            <button
              className="dds-apply-btn"
              onClick={() => apply.mutate(evaluatingId)}
              disabled={apply.isPending}
              aria-label="Confirm auto-apply"
            >
              {apply.isPending ? (
                <Loader2 size={13} className="dds-spin" />
              ) : (
                <CheckCircle2 size={13} />
              )}
              {shadowMode ? "Simulate apply" : "Apply now"}
            </button>
          )}
          <button
            className="dds-decision-dismiss"
            onClick={() => setDecision(null)}
            aria-label="Dismiss evaluation result"
          >
            ✕
          </button>
        </div>
      )}

      {isLoading && (
        <div className="dds-loading" aria-busy="true">
          <Loader2 size={16} className="dds-spin" />
          <span>Loading auto-applied variants…</span>
        </div>
      )}

      {!isLoading && (!variants || variants.length === 0) && (
        <p className="dds-empty">No auto-applied variants yet.</p>
      )}

      {variants && variants.length > 0 && (
        <ul className="dds-variant-list">
          {variants.map((v) => (
            <li key={v.id} className="dds-variant-item">
              <div className="dds-variant-info">
                <span className="dds-variant-reason">{v.reason}</span>
                <span className="dds-variant-date">
                  {new Date(v.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="dds-variant-actions">
                <button
                  className="dds-evaluate-btn"
                  onClick={() => evaluate.mutate(v.id)}
                  disabled={evaluate.isPending && evaluatingId === v.id}
                  aria-label="Evaluate auto-apply eligibility"
                >
                  {evaluate.isPending && evaluatingId === v.id ? (
                    <Loader2 size={13} className="dds-spin" />
                  ) : (
                    <Zap size={13} />
                  )}
                  Evaluate
                </button>
                <button
                  className="dds-rollback-btn"
                  onClick={() => rollback.mutate(v.id)}
                  disabled={rollback.isPending}
                  aria-label="Rollback this variant"
                >
                  {rollback.isPending ? (
                    <Loader2 size={13} className="dds-spin" />
                  ) : (
                    <RotateCcw size={13} />
                  )}
                  Rollback
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
