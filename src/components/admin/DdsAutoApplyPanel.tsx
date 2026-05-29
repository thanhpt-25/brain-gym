import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Zap,
  RotateCcw,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import api from "../../services/api";
import "./dds-auto-apply-panel.css";

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

interface AutoApplyReadiness {
  cleanApprovals: number;
  threshold: number;
  rollbackCount: number;
  lastRollbackAt: string | null;
  readyToPromote: boolean;
  progressPercent: number;
}

interface CohortConfig {
  cohortName: string;
  shadowModeEnabled: boolean;
  canaryArmed: boolean;
  promotedAt: string | null;
  canaryPausedAt: string | null;
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

async function fetchAutoApplyReadiness(): Promise<AutoApplyReadiness> {
  const res = await api.get<AutoApplyReadiness>(
    "/ai-question-bank/dds/auto-apply/readiness",
  );
  return res.data;
}

async function fetchCohortConfig(): Promise<CohortConfig | null> {
  const res = await api.get<CohortConfig>(
    "/ai-question-bank/dds/auto-apply/cohort-config",
  );
  return res.data;
}

async function promoteCohortToLive() {
  return api.post("/ai-question-bank/dds/auto-apply/promote");
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

  const { data: readiness, isLoading: readinessLoading } = useQuery({
    queryKey: ["dds-auto-apply-readiness"],
    queryFn: fetchAutoApplyReadiness,
    staleTime: 60_000,
  });

  const { data: cohortConfig, isLoading: cohortLoading } = useQuery({
    queryKey: ["dds-cohort-config"],
    queryFn: fetchCohortConfig,
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
      qc.invalidateQueries({ queryKey: ["dds-auto-apply-readiness"] });
    },
  });

  const rollback = useMutation({
    mutationFn: (variantId: string) => rollbackVariant(variantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dds-auto-applied"] });
      qc.invalidateQueries({ queryKey: ["dds-auto-apply-readiness"] });
    },
  });

  const promote = useMutation({
    mutationFn: promoteCohortToLive,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dds-auto-apply-readiness"] });
      qc.invalidateQueries({ queryKey: ["dds-auto-applied"] });
    },
  });

  const shadowMode = import.meta.env.VITE_DDS_SHADOW_MODE !== "false";

  return (
    <section className="dds-auto-panel" aria-label="DDS auto-apply management">
      <div className="dds-auto-header">
        <h3 className="dds-auto-title">
          <Zap size={16} aria-hidden="true" />
          DDS Auto-Apply
        </h3>
        {shadowMode && (
          <span className="dds-shadow-badge" aria-label="Shadow mode active">
            <ShieldAlert size={13} aria-hidden="true" /> Shadow mode
          </span>
        )}
      </div>

      <p className="dds-auto-description">
        Variants that meet the cohort approval threshold are auto-applied. In
        shadow mode, decisions are logged but not committed.
      </p>

      {readinessLoading && (
        <div className="dds-readiness-loading" aria-busy="true">
          <Loader2 size={16} className="dds-spin" aria-hidden="true" />
          <span>Loading Gate 2 readiness…</span>
        </div>
      )}

      {readiness && !readinessLoading && (
        <div
          className={`dds-readiness ${readiness.readyToPromote ? "dds-readiness--ready" : "dds-readiness--pending"}`}
          role="status"
        >
          <div className="dds-readiness-header">
            <h4 className="dds-readiness-title">
              <TrendingUp size={16} aria-hidden="true" />
              Gate 2: Readiness
            </h4>
            {readiness.readyToPromote && (
              <span
                className="dds-readiness-badge"
                aria-label="Ready to promote"
              >
                <CheckCircle2 size={13} aria-hidden="true" /> Ready
              </span>
            )}
          </div>

          <div className="dds-readiness-metrics">
            <div className="dds-metric">
              <span className="dds-metric-label">Clean Approvals</span>
              <span className="dds-metric-value">
                {readiness.cleanApprovals}/{readiness.threshold}
              </span>
              <div className="dds-metric-bar">
                <div
                  className="dds-metric-fill"
                  role="progressbar"
                  aria-valuenow={readiness.cleanApprovals}
                  aria-valuemin={0}
                  aria-valuemax={readiness.threshold}
                  aria-label={`${readiness.cleanApprovals} of ${readiness.threshold} clean approvals`}
                  style={{
                    width: `${readiness.progressPercent}%`,
                  }}
                />
              </div>
            </div>

            <div className="dds-metric">
              <span className="dds-metric-label">Rollbacks</span>
              <span className="dds-metric-value">
                {readiness.rollbackCount}
              </span>
              {readiness.rollbackCount > 0 && readiness.lastRollbackAt && (
                <span className="dds-metric-detail">
                  Last:{" "}
                  {new Date(readiness.lastRollbackAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {!readiness.readyToPromote && readiness.rollbackCount > 0 && (
            <div className="dds-readiness-warning" role="alert">
              <AlertCircle size={13} aria-hidden="true" />
              Cannot promote: recent rollbacks detected. Must reach zero
              rollbacks.
            </div>
          )}

          {!readiness.readyToPromote &&
            readiness.cleanApprovals < readiness.threshold && (
              <div className="dds-readiness-warning" role="alert">
                <AlertCircle size={13} aria-hidden="true" />
                {readiness.threshold - readiness.cleanApprovals} more clean
                approvals needed.
              </div>
            )}

          <button
            className="dds-promote-btn"
            onClick={() => promote.mutate()}
            disabled={!readiness.readyToPromote || promote.isPending}
            aria-label="Promote DDS cohort to live mode"
          >
            {promote.isPending ? (
              <Loader2 size={13} className="dds-spin" aria-hidden="true" />
            ) : (
              <Zap size={13} />
            )}
            {shadowMode ? "Simulate promote" : "Promote to live"}
          </button>
        </div>
      )}

      {cohortConfig && !cohortLoading && (
        <div className="dds-canary-status" role="status">
          <h4>
            <ShieldAlert size={14} aria-hidden="true" />
            Canary Status
          </h4>
          <div className="dds-canary-state">
            {cohortConfig.canaryArmed ? (
              <span className="dds-canary-armed" aria-label="Canary armed">
                <span aria-hidden="true">🛡️</span> Armed
              </span>
            ) : cohortConfig.promotedAt ? (
              <span className="dds-canary-paused" aria-label="Canary paused">
                <span aria-hidden="true">⏸️</span> Paused
              </span>
            ) : (
              <span className="dds-canary-inactive">○ Inactive</span>
            )}
          </div>
          {cohortConfig.promotedAt && (
            <span className="dds-canary-detail">
              Promoted: {new Date(cohortConfig.promotedAt).toLocaleDateString()}
            </span>
          )}
          {cohortConfig.canaryPausedAt && (
            <span className="dds-canary-detail">
              Paused:{" "}
              {new Date(cohortConfig.canaryPausedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

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
                <Loader2 size={13} className="dds-spin" aria-hidden="true" />
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
          <Loader2 size={16} className="dds-spin" aria-hidden="true" />
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
                    <Loader2
                      size={13}
                      className="dds-spin"
                      aria-hidden="true"
                    />
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
                    <Loader2
                      size={13}
                      className="dds-spin"
                      aria-hidden="true"
                    />
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
