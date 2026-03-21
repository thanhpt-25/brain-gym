import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DomainPerformance } from '@/types/api-types';

interface WeakTopicsChartProps {
  weakTopics?: DomainPerformance[];
  domains?: DomainPerformance[];
}

const chartConfig = {
  percentage: { label: 'Accuracy %', color: 'hsl(var(--accent))' },
};

export function WeakTopicsChart({ weakTopics, domains }: WeakTopicsChartProps) {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-mono flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" /> Weak Topics Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!weakTopics?.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Chưa có dữ liệu. Hãy hoàn thành ít nhất 1 bài thi.
          </p>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart
                data={weakTopics.slice(0, 6)}
                layout="vertical"
                margin={{ top: 0, right: 12, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis
                  dataKey="domain"
                  type="category"
                  width={180}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="percentage" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ChartContainer>

            <DomainList domains={domains ?? []} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DomainList({ domains }: { domains: DomainPerformance[] }) {
  if (!domains.length) return null;
  return (
    <div className="space-y-3">
      {domains.map((t, i) => (
        <div key={t.domain} className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{t.domain}</div>
            <div className="text-xs text-muted-foreground">{t.correct}/{t.total}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${t.percentage}%`,
                  backgroundColor: t.percentage >= 75
                    ? 'hsl(var(--accent))'
                    : t.percentage >= 50
                      ? 'hsl(var(--warning))'
                      : 'hsl(var(--destructive))',
                }}
              />
            </div>
            <span className={`text-xs font-mono font-bold min-w-[36px] text-right ${
              t.percentage >= 75
                ? 'text-accent'
                : t.percentage >= 50
                  ? 'text-warning'
                  : 'text-destructive'
            }`}>
              {t.percentage}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
