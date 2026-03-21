import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { HistoryItem } from '@/types/api-types';

interface ScoreTrendChartProps {
  history: HistoryItem[];
}

const chartConfig = {
  score: { label: 'Score %', color: 'hsl(var(--primary))' },
};

export function ScoreTrendChart({ history }: ScoreTrendChartProps) {
  const scoreTrend = useMemo(() =>
    [...history]
      .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
      .map(h => ({
        date: new Date(h.submittedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        score: h.score,
        cert: h.certification.code,
      })),
    [history],
  );

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-mono flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Score Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        {scoreTrend.length < 2 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Cần ít nhất 2 bài thi để hiển thị biểu đồ.
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <LineChart data={scoreTrend} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
