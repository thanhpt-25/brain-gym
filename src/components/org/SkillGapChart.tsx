import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import type { DomainGap } from '@/services/org-analytics';

interface Props {
  data: DomainGap[];
}

const chartConfig = {
  percentage: { label: 'Score %', color: 'hsl(var(--primary))' },
};

const SkillGapChart = ({ data }: Props) => {
  if (data.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            No domain data available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Truncate long domain names for the radar chart
  const chartData = data.map((d) => ({
    ...d,
    shortDomain: d.domain.length > 20 ? d.domain.slice(0, 18) + '...' : d.domain,
  }));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="font-mono text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" /> Skill Gaps by Domain
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length >= 3 ? (
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <RadarChart data={chartData} margin={{ top: 8, right: 32, bottom: 8, left: 32 }}>
              <PolarGrid className="stroke-border" />
              <PolarAngleAxis
                dataKey="shortDomain"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <PolarRadiusAxis
                domain={[0, 100]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Radar
                name="Score %"
                dataKey="percentage"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ChartContainer>
        ) : (
          <div className="space-y-3">
            {data.map((d) => (
              <div key={d.domain} className="flex items-center justify-between">
                <span className="text-sm font-mono text-muted-foreground truncate max-w-[60%]">
                  {d.domain}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${d.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono font-medium w-10 text-right">
                    {d.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SkillGapChart;
