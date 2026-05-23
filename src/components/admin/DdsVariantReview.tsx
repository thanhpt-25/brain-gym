import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "../../services/api";
import "./dds-variant-review.css";

interface Choice {
  label: string;
  content: string;
  isCorrect: boolean;
}

interface VariantDiff {
  originalChoices: Choice[];
  revisedChoices: Choice[];
}

interface QuestionVariant {
  id: string;
  questionId: string;
  reason: string;
  status: string;
  diff: VariantDiff;
  createdAt: string;
}

async function fetchPending(limit = 20): Promise<QuestionVariant[]> {
  const res = await api.get<QuestionVariant[]>(
    "/ai-question-bank/dds/pending",
    {
      params: { limit },
    },
  );
  return res.data;
}

async function approveVariant(variantId: string, reviewNote?: string) {
  return api.patch(`/ai-question-bank/dds/variants/${variantId}/approve`, {
    reviewNote,
  });
}

async function rejectVariant(variantId: string, reviewNote?: string) {
  return api.patch(`/ai-question-bank/dds/variants/${variantId}/reject`, {
    reviewNote,
  });
}

function ChoiceDiff({
  original,
  revised,
}: {
  original: Choice[];
  revised: Choice[];
}) {
  return (
    <div className="dds-diff">
      <div className="dds-diff-col">
        <h4 className="dds-diff-col-title">Original</h4>
        <ul className="dds-choice-list">
          {original.map((c) => (
            <li
              key={c.label}
              className={`dds-choice ${c.isCorrect ? "dds-choice--correct" : ""}`}
            >
              <span className="dds-choice-label">{c.label}.</span>
              {c.content}
            </li>
          ))}
        </ul>
      </div>
      <div className="dds-diff-col">
        <h4 className="dds-diff-col-title">Revised</h4>
        <ul className="dds-choice-list">
          {revised.map((c, i) => {
            const orig = original[i];
            const changed = orig && orig.content !== c.content && !c.isCorrect;
            return (
              <li
                key={c.label}
                className={`dds-choice ${c.isCorrect ? "dds-choice--correct" : ""} ${changed ? "dds-choice--changed" : ""}`}
              >
                <span className="dds-choice-label">{c.label}.</span>
                {c.content}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function VariantCard({ variant }: { variant: QuestionVariant }) {
  const [expanded, setExpanded] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const qc = useQueryClient();

  const approve = useMutation({
    mutationFn: () => approveVariant(variant.id, reviewNote || undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dds-pending"] }),
  });

  const reject = useMutation({
    mutationFn: () => rejectVariant(variant.id, reviewNote || undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dds-pending"] }),
  });

  const isPending = approve.isPending || reject.isPending;

  return (
    <article className="dds-card">
      <div className="dds-card-header">
        <div className="dds-card-meta">
          <span className="dds-reason-badge">{variant.reason}</span>
          <span className="dds-question-id">
            Q: {variant.questionId.slice(0, 8)}…
          </span>
          <span className="dds-created-at">
            {new Date(variant.createdAt).toLocaleDateString()}
          </span>
        </div>
        <button
          className="dds-expand-btn"
          onClick={() => setExpanded((p) => !p)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse diff" : "Expand diff"}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {expanded ? "Hide diff" : "Show diff"}
        </button>
      </div>

      {expanded && (
        <ChoiceDiff
          original={variant.diff.originalChoices}
          revised={variant.diff.revisedChoices}
        />
      )}

      <div className="dds-card-actions">
        <input
          className="dds-review-note"
          placeholder="Review note (optional)"
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          disabled={isPending}
          aria-label="Review note"
        />
        <button
          className="dds-btn dds-btn--approve"
          onClick={() => approve.mutate()}
          disabled={isPending}
          aria-label="Approve variant"
        >
          {approve.isPending ? (
            <Loader2 size={14} className="dds-spin" />
          ) : (
            <CheckCircle2 size={14} />
          )}
          Approve
        </button>
        <button
          className="dds-btn dds-btn--reject"
          onClick={() => reject.mutate()}
          disabled={isPending}
          aria-label="Reject variant"
        >
          {reject.isPending ? (
            <Loader2 size={14} className="dds-spin" />
          ) : (
            <XCircle size={14} />
          )}
          Reject
        </button>
      </div>
    </article>
  );
}

/**
 * DDS Variant Review Queue — lists pending AI-rewritten distractor sets
 * and lets an admin approve or reject each one.
 */
export function DdsVariantReview() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dds-pending"],
    queryFn: () => fetchPending(20),
  });

  if (isLoading) {
    return (
      <div className="dds-loading">
        <Loader2 className="dds-spin" />
        <span>Loading variants…</span>
      </div>
    );
  }

  if (error) {
    return <div className="dds-error">Failed to load pending variants.</div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="dds-empty">
        <CheckCircle2 size={32} className="dds-empty-icon" />
        <p>All caught up — no pending variants.</p>
      </div>
    );
  }

  return (
    <section className="dds-review" aria-label="DDS variant review queue">
      <h2 className="dds-review-title">Pending Variants ({data.length})</h2>
      <div className="dds-card-list">
        {data.map((v) => (
          <VariantCard key={v.id} variant={v} />
        ))}
      </div>
    </section>
  );
}
