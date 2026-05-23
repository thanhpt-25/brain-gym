import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ThumbsUp, Send, Loader2, Star } from "lucide-react";
import api from "../../services/api";
import "./peer-review-challenge.css";

interface PeerExplanation {
  id: string;
  questionId: string;
  squadId: string;
  authorId: string;
  content: string;
  upvotes: number;
  isTop: boolean;
  createdAt: string;
}

interface VoteResult {
  newUpvotes: number;
  isTop: boolean;
}

async function fetchExplanations(
  questionId: string,
  squadId: string,
): Promise<PeerExplanation[]> {
  const res = await api.get<PeerExplanation[]>(
    "/squads/peer-review/explanations",
    { params: { questionId, squadId } },
  );
  return res.data;
}

async function submitExplanation(
  questionId: string,
  squadId: string,
  content: string,
): Promise<PeerExplanation> {
  const res = await api.post<PeerExplanation>(
    "/squads/peer-review/explanations",
    { questionId, squadId, content },
  );
  return res.data;
}

async function voteOnExplanation(explanationId: string): Promise<VoteResult> {
  const res = await api.post<VoteResult>(
    `/squads/peer-review/explanations/${explanationId}/vote`,
  );
  return res.data;
}

interface PeerReviewChallengeProps {
  questionId: string;
  squadId: string;
  currentUserId: string;
}

const TIER_THRESHOLDS = [
  { min: 50, label: "Gold", className: "pr-badge--gold" },
  { min: 20, label: "Silver", className: "pr-badge--silver" },
  { min: 5, label: "Bronze", className: "pr-badge--bronze" },
] as const;

function resolveBadge(upvotes: number) {
  return TIER_THRESHOLDS.find((t) => upvotes >= t.min) ?? null;
}

/**
 * Peer Review Challenge panel — shown after a question attempt.
 * Lets squad members submit an explanation and upvote each other's answers.
 * Top explanations earn tiered badges: Bronze (≥5), Silver (≥20), Gold (≥50).
 */
export function PeerReviewChallenge({
  questionId,
  squadId,
  currentUserId,
}: PeerReviewChallengeProps) {
  const [draft, setDraft] = useState("");
  const qc = useQueryClient();
  const queryKey = ["peer-explanations", questionId, squadId];

  const { data: explanations, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchExplanations(questionId, squadId),
  });

  const submit = useMutation({
    mutationFn: () => submitExplanation(questionId, squadId, draft),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey });
    },
  });

  const vote = useMutation({
    mutationFn: (explanationId: string) => voteOnExplanation(explanationId),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const myExplanation = explanations?.find((e) => e.authorId === currentUserId);

  return (
    <section className="pr-challenge" aria-label="Peer review challenge">
      <h3 className="pr-title">Squad Explanations</h3>
      <p className="pr-subtitle">
        Share your reasoning — top explanations earn a badge!
      </p>

      {/* Submit / edit own explanation */}
      <div className="pr-compose">
        <textarea
          className="pr-textarea"
          rows={3}
          placeholder={
            myExplanation
              ? "Update your explanation…"
              : "Explain why the correct answer is right…"
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={submit.isPending}
          aria-label="Your explanation"
        />
        <button
          className="pr-submit-btn"
          onClick={() => submit.mutate()}
          disabled={submit.isPending || draft.trim().length === 0}
          aria-label="Submit explanation"
        >
          {submit.isPending ? (
            <Loader2 size={15} className="pr-spin" />
          ) : (
            <Send size={15} />
          )}
          {myExplanation ? "Update" : "Submit"}
        </button>
      </div>

      {/* Explanation list */}
      {isLoading && (
        <div className="pr-loading">
          <Loader2 className="pr-spin" size={18} />
          <span>Loading explanations…</span>
        </div>
      )}

      {!isLoading && explanations && explanations.length === 0 && (
        <p className="pr-empty">
          No explanations yet. Be the first to share your reasoning!
        </p>
      )}

      {!isLoading && explanations && explanations.length > 0 && (
        <ul className="pr-list">
          {explanations.map((ex) => {
            const isOwn = ex.authorId === currentUserId;
            return (
              <li
                key={ex.id}
                className={`pr-item ${ex.isTop ? "pr-item--top" : ""} ${isOwn ? "pr-item--own" : ""}`}
              >
                {ex.isTop &&
                  (() => {
                    const badge = resolveBadge(ex.upvotes);
                    return (
                      <span
                        className={`pr-top-badge ${badge?.className ?? ""}`}
                        aria-label={`${badge?.label ?? "Top"} explanation`}
                      >
                        <Star size={12} />
                        {badge?.label ?? "Top"}
                      </span>
                    );
                  })()}
                <p className="pr-item-content">{ex.content}</p>
                <div className="pr-item-footer">
                  <span className="pr-item-date">
                    {new Date(ex.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    className="pr-vote-btn"
                    onClick={() => vote.mutate(ex.id)}
                    disabled={isOwn || vote.isPending}
                    aria-label={`Upvote — ${ex.upvotes} votes`}
                    title={
                      isOwn ? "Cannot vote on your own explanation" : "Upvote"
                    }
                  >
                    <ThumbsUp size={13} />
                    <span>{ex.upvotes}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
