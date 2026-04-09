import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, TrendingUp, Award, Clock } from 'lucide-react';
import type { MemberAnalytics } from '@/services/org-analytics';

interface Props {
  data: MemberAnalytics;
}

const MemberAnalyticsCard = ({ data }: Props) => {
  const { member, summary, domains, recentAttempts } = data;

  return (
    <div className="space-y-4">
      {/* Member Header */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-muted border border-border flex items-center justify-center">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt="" className="h-12 w-12 rounded-full" />
              ) : (
                <User className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-mono font-bold text-lg">{member.displayName}</p>
              <p className="text-xs text-muted-foreground font-mono">{member.email}</p>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] font-mono">{member.role}</Badge>
                {member.group && (
                  <Badge variant="outline" className="text-[10px] font-mono">{member.group.name}</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Exams Taken', value: summary.totalExams, icon: TrendingUp, color: 'text-primary' },
          { label: 'Pass Rate', value: `${summary.passRate}%`, icon: Award, color: 'text-emerald-400' },
          { label: 'Avg Score', value: `${summary.avgScore}%`, icon: TrendingUp, color: 'text-amber-400' },
          { label: 'Best Score', value: `${summary.bestScore}%`, icon: Award, color: 'text-violet-400' },
        ].map((stat) => (
          <Card key={stat.label} className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <stat.icon className={`h-4 w-4 mx-auto mb-1 ${stat.color}`} />
              <p className="text-xl font-mono font-bold">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Domain Performance */}
      {domains.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="font-mono text-sm font-medium mb-3">Domain Performance</p>
            <div className="space-y-2">
              {domains.map((d) => (
                <div key={d.domain} className="flex items-center justify-between gap-3">
                  <span className="text-xs font-mono text-muted-foreground truncate flex-1">
                    {d.domain}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          d.percentage >= 70 ? 'bg-emerald-500' : d.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${d.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-medium w-8 text-right">{d.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Attempts */}
      {recentAttempts.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="font-mono text-sm font-medium mb-3">Recent Exams</p>
            <div className="space-y-2">
              {recentAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate">{attempt.examTitle}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {attempt.certification?.code || 'N/A'} · {attempt.totalCorrect}/{attempt.totalQuestions}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] ${
                        attempt.passed
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}
                    >
                      {attempt.score}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MemberAnalyticsCard;
