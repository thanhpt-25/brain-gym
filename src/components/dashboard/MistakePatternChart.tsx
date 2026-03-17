import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart as PieChartIcon } from 'lucide-react';
import { HistoryItem } from '@/services/analytics';

interface Props {
  history: HistoryItem[];
}

interface PatternEntry {
  name: string;
  value: number;
  color: string;
}

const PATTERN_COLORS = [
  'hsl(var(--destructive))',
  'hsl(var(--warning))',
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--muted-foreground))',
];

export default function MistakePatternChart({ history }: Props) {
  const patterns = useMemo<PatternEntry[]>(() => {
    if (!history.length) return [];

    let lowScoreCount = 0;   // consistently low score (<50%)
    let timeRushCount = 0;    // fast submissions (might indicate rushing)
    let nearMissCount = 0;    // failed but close to passing (60-74%)
    let domainWeakCount = 0;  // has domain scores with <40%
    let otherCount = 0;

    history.forEach(h => {
      if (!h.passed && h.score >= 60) {
        nearMissCount++;
      } else if (h.score < 50) {
        lowScoreCount++;
      }

      // Rushing: less than 30s per question on average
      const avgTimePerQ = h.timeSpent / Math.max(h.totalQuestions, 1);
      if (avgTimePerQ < 30 && !h.passed) {
        timeRushCount++;
      }

      if (h.domainScores) {
        const weakDomains = Object.values(h.domainScores).filter(
          d => d.total > 0 && (d.correct / d.total) * 100 < 40
        );
        if (weakDomains.length > 0) domainWeakCount++;
      }
    });

    otherCount = Math.max(0, history.filter(h => !h.passed).length - lowScoreCount - nearMissCount - timeRushCount);

    const raw = [
      { name: 'Knowledge Gaps', value: lowScoreCount, color: PATTERN_COLORS[0] },
      { name: 'Time Pressure', value: timeRushCount, color: PATTERN_COLORS[1] },
      { name: 'Near Misses', value: nearMissCount, color: PATTERN_COLORS[2] },
      { name: 'Weak Domains', value: domainWeakCount, color: PATTERN_COLORS[3] },
      { name: 'Other', value: otherCount, color: PATTERN_COLORS[4] },
    ];

    return raw.filter(r => r.value > 0);
  }, [history]);

  const totalMistakes = patterns.reduce((s, p) => s + p.value, 0);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-mono flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-primary" /> Mistake Patterns
        </CardTitle>
      </CardHeader>
      <CardContent>
        {patterns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Chưa có dữ liệu lỗi. Hãy hoàn thành ít nhất 1 bài thi.
          </p>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-48 h-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={patterns}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {patterns.map((entry, i) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as PatternEntry;
                      const pct = totalMistakes > 0 ? Math.round((d.value / totalMistakes) * 100) : 0;
                      return (
                        <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                          <div className="font-medium">{d.name}</div>
                          <div className="text-muted-foreground">{d.value} times ({pct}%)</div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 space-y-2.5 min-w-0">
              {patterns.map(p => {
                const pct = totalMistakes > 0 ? Math.round((p.value / totalMistakes) * 100) : 0;
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-sm flex-1 truncate">{p.name}</span>
                    <span className="text-xs font-mono text-muted-foreground">{p.value}</span>
                    <span className="text-xs font-mono font-bold min-w-[36px] text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
