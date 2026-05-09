import { useNavigate } from "react-router-dom";
import type { NextTopicSuggestion } from "../../services/mastery";

export interface NextTopicCardProps {
  suggestion: NextTopicSuggestion | { message: string } | null;
  isLoading: boolean;
  certificationId: string;
}

function isNextTopicSuggestion(
  data: NextTopicSuggestion | { message: string } | null,
): data is NextTopicSuggestion {
  return (
    data !== null && "domain" in data && "accuracy" in data && "reason" in data
  );
}

/**
 * Adaptive weakness recommendation card.
 *
 * Displays the next topic to study based on domain performance analysis.
 * - If suggestion exists: shows weakest domain (lowest accuracy, ≥10 attempts)
 * - If well-rounded: shows congratulatory message and challenge prompt
 * - If loading: shows skeleton
 */
export function NextTopicCard({
  suggestion,
  isLoading,
  certificationId,
}: NextTopicCardProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <section
        className="next-topic-card next-topic-card--loading"
        aria-busy="true"
      >
        <div className="next-topic-card__skeleton" />
      </section>
    );
  }

  if (!suggestion) {
    return null;
  }

  const isSuggestion = isNextTopicSuggestion(suggestion);

  return (
    <section className="next-topic-card" aria-labelledby="next-topic-heading">
      <div className="next-topic-card__content">
        {isSuggestion ? (
          <>
            <h2 id="next-topic-heading" className="next-topic-card__heading">
              Next Topic to Master
            </h2>
            <div className="next-topic-card__domain">
              <p className="next-topic-card__domain-name">
                {suggestion.domain.name}
              </p>
              <p className="next-topic-card__accuracy">
                {suggestion.accuracy}% accurate
              </p>
            </div>
            <p className="next-topic-card__reason">{suggestion.reason}</p>
            <button
              className="next-topic-card__action"
              onClick={() => {
                navigate(
                  `/org/default/certs/${certificationId}/practice?domain=${suggestion.domain.id}`,
                );
              }}
            >
              Practice This Domain
            </button>
          </>
        ) : (
          <>
            <h2 id="next-topic-heading" className="next-topic-card__heading">
              You're Well-Rounded!
            </h2>
            <p className="next-topic-card__message">{suggestion.message}</p>
            <button
              className="next-topic-card__action next-topic-card__action--primary"
              onClick={() => {
                navigate(
                  `/org/default/certs/${certificationId}/exams?examType=TIMED`,
                );
              }}
            >
              Take a Timed Exam
            </button>
          </>
        )}
      </div>
    </section>
  );
}
