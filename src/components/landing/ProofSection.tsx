import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { getPlatformStats, type PlatformStats } from "@/services/analytics";
import { getLeaderboard } from "@/services/gamification";
import { StatsSkeleton } from "@/components/PageSkeleton";

const formatStat = (value: number): string => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M+`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K+`;
  return value.toString();
};

/** Minimum submitted attempts before we show a platform-wide pass rate — below
 * that the number is too noisy to mean anything. */
const MIN_ATTEMPTS_FOR_PASS_RATE = 20;

export function ProofSection() {
  const {
    data: platformStats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery<PlatformStats>({
    queryKey: ["platform-stats"],
    queryFn: getPlatformStats,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ["leaderboard-preview"],
    queryFn: () => getLeaderboard(undefined, 5),
  });

  const stats = platformStats
    ? [
        { value: formatStat(platformStats.totalQuestions), label: "Questions" },
        {
          value: formatStat(platformStats.totalCertifications),
          label: "Certifications",
        },
        {
          value: formatStat(platformStats.totalExamAttempts),
          label: "Practice Exams Taken",
        },
        ...(platformStats.totalExamAttempts >= MIN_ATTEMPTS_FOR_PASS_RATE
          ? [{ value: `${platformStats.averagePassRate}%`, label: "Avg. Practice Score ≥ Passing" }]
          : []),
      ]
    : [];

  const showStats = !statsLoading && !statsError && stats.length > 0;

  return (
    <section className="py-20 border-t border-border">
      <div className="container">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold font-mono mb-3">
            Real activity, <span className="text-gradient-cyan">real numbers</span>
          </h2>
          <p className="text-muted-foreground">
            Live from the CertGym community — no invented case studies
          </p>
        </motion.div>

        {statsLoading && (
          <div className="max-w-3xl mx-auto mb-16">
            <StatsSkeleton count={4} />
          </div>
        )}
        {showStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto mb-16">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center flex flex-col gap-1">
                <div className="text-3xl md:text-4xl font-bold font-mono text-gradient-cyan">
                  {stat.value}
                </div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {leaderboard && leaderboard.length > 0 && (
          <div className="max-w-lg mx-auto glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-4 w-4 text-accent" />
              <h3 className="font-mono font-semibold text-sm uppercase tracking-widest">
                This week's top learners
              </h3>
            </div>
            <ul className="space-y-2">
              {leaderboard.map((entry) => (
                <li
                  key={entry.userId}
                  className="flex items-center justify-between text-sm font-mono py-1.5"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground w-5">#{entry.rank}</span>
                    {entry.displayName}
                  </span>
                  <span className="text-primary">{entry.points} pts</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
