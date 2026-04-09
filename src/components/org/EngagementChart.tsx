import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { WeeklyProgress } from '@/services/org-analytics';

interface Props {
  data: WeeklyProgress[];
}

const chartConfig = {
  examsTaken: { label: 'Exams Taken', color: 'hsl(var(--primary))' },
  avgScore: { label: 'Avg Score', color: 'hsl(142 76% 36%)' },
  activeUsers: { label: 'Active Users', color: 'hsl(217 91% 60%)' },
};

const EngagementChart = ({ data }: Props) => {
  if (data.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            No progress data yet. Members need to complete exams first.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Format week labels (e.g. "2026-W14" → "W14")
  const chartData = data.map((d) => ({
    ...d,
    label: d.week.replace(/^\d{4}-/, ''),
  }));

  return (
    <div className="space-y-4">
      {/* Exams + Active Users bar chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-mono text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Weekly Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="examsTaken" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="activeUsers" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Avg Score trend line */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-mono text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" /> Average Score Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="avgScore"
                stroke="hsl(142 76% 36%)"
                strokeWidth={2.5}
                dot={{ fill: 'hsl(142 76% 36%)', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default EngagementChart;
