import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  getScenarioLeaderboard,
  type LeaderboardEntry,
} from "@/services/scenarios";

interface ScenarioLeaderboardProps {
  scenarioId: string;
}

export function ScenarioLeaderboard({ scenarioId }: ScenarioLeaderboardProps) {
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["scenario-leaderboard", scenarioId],
    queryFn: () => getScenarioLeaderboard(scenarioId),
    enabled: !!scenarioId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            Loading leaderboard...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">No attempts yet</div>
        </CardContent>
      </Card>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-yellow-600" />
          <h3 className="font-mono font-semibold text-gray-900">
            Top Performers
          </h3>
        </div>

        <div className="space-y-2">
          {leaderboard.slice(0, 10).map((entry: LeaderboardEntry) => (
            <div
              key={`${entry.username}-${entry.completedAt}`}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-mono font-bold text-sm">
                  {entry.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {entry.username}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTime(entry.timeSpent)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4 shrink-0">
                <div className="text-right">
                  <div className="text-lg font-mono font-bold text-gray-900">
                    {entry.score}%
                  </div>
                </div>
                {entry.rank <= 3 && (
                  <div className="text-xl">
                    {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {leaderboard.length > 10 && (
          <div className="mt-3 text-xs text-gray-500 text-center">
            +{leaderboard.length - 10} more
          </div>
        )}
      </CardContent>
    </Card>
  );
}
