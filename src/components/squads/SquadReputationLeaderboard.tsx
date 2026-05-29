import { useQuery } from "@tanstack/react-query";
import { Trophy, Loader2, Medal } from "lucide-react";
import {
  getReputationLeaderboard,
  LeaderboardEntry,
} from "../../services/squads";

interface Props {
  squadId: string;
  currentUserId?: string;
  limit?: number;
}

const TIER_STYLES: Record<
  LeaderboardEntry["tier"],
  { label: string; className: string }
> = {
  gold: { label: "Gold", className: "rep-tier rep-tier--gold" },
  silver: { label: "Silver", className: "rep-tier rep-tier--silver" },
  bronze: { label: "Bronze", className: "rep-tier rep-tier--bronze" },
  none: { label: "", className: "" },
};

export function SquadReputationLeaderboard({
  squadId,
  currentUserId,
  limit = 10,
}: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["squad-leaderboard", squadId, limit],
    queryFn: () => getReputationLeaderboard(squadId, limit),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="rep-board rep-board--loading" aria-busy="true">
        <Loader2 size={18} className="rep-spin" aria-hidden="true" />
        <span>Loading leaderboard…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rep-board rep-board--error" role="alert">
        Failed to load leaderboard.
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rep-board rep-board--empty">
        <Trophy size={24} className="rep-empty-icon" aria-hidden="true" />
        <p>
          No reputation points yet. Earn points by writing great explanations!
        </p>
      </div>
    );
  }

  return (
    <section className="rep-board" aria-label="Squad reputation leaderboard">
      <h3 className="rep-board-title">
        <Trophy size={16} aria-hidden="true" />
        Reputation Leaderboard
      </h3>
      <ol className="rep-list">
        {data.map((entry, idx) => {
          const isCurrentUser = entry.userId === currentUserId;
          const tierStyle = TIER_STYLES[entry.tier];
          return (
            <li
              key={entry.userId}
              className={`rep-item${isCurrentUser ? " rep-item--me" : ""}`}
              aria-current={isCurrentUser ? "true" : undefined}
            >
              <span className="rep-rank" aria-label={`Rank ${idx + 1}`}>
                {idx === 0 ? (
                  <Medal
                    size={16}
                    className="rep-rank-icon rep-rank-icon--gold"
                    aria-hidden="true"
                  />
                ) : idx === 1 ? (
                  <Medal
                    size={16}
                    className="rep-rank-icon rep-rank-icon--silver"
                    aria-hidden="true"
                  />
                ) : idx === 2 ? (
                  <Medal
                    size={16}
                    className="rep-rank-icon rep-rank-icon--bronze"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="rep-rank-num">{idx + 1}</span>
                )}
              </span>
              <span className="rep-name">
                {entry.displayName ?? "Anonymous"}
                {isCurrentUser && (
                  <span className="rep-you" aria-label="(you)">
                    {" "}
                    (you)
                  </span>
                )}
              </span>
              {tierStyle.label && (
                <span
                  className={tierStyle.className}
                  aria-label={`${tierStyle.label} tier`}
                >
                  {tierStyle.label}
                </span>
              )}
              <span
                className="rep-points"
                aria-label={`${entry.points} points`}
              >
                {entry.points} pts
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
