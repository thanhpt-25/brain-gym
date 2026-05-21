import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLlmMetrics } from '@/services/api';

interface LlmMetrics {
  totalCostUsd: number;
  tokenCount: number;
  inputTokens: number;
  outputTokens: number;
  dailyCostTrend: Array<{ date: string; cost: number }>;
  monthlyQuota: number;
  monthlyUsed: number;
  estimatedRemainingQuota: number;
  quotaUsedPercent: number;
}

export function LlmCostPanel() {
  const { data: metrics, isLoading } = useQuery<LlmMetrics>({
    queryKey: ['llm-metrics'],
    queryFn: () => getLlmMetrics(30),
    refetchInterval: 60000, // Refresh every minute
  });

  const getQuotaColor = (percent: number) => {
    if (percent >= 80) return 'bg-red-500';
    if (percent >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getQuotaTextColor = (percent: number) => {
    if (percent >= 80) return 'text-red-500';
    if (percent >= 60) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Total Cost Card */}
      <Card className="glass-card md:col-span-1">
        <CardHeader>
          <CardTitle className="text-base font-mono flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" /> Monthly Cost
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className={`text-3xl font-bold font-mono ${metrics ? getQuotaTextColor(metrics.quotaUsedPercent) : ''}`}>
              ${metrics?.monthlyUsed.toFixed(2) ?? '0.00'}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
              of ${metrics?.monthlyQuota.toFixed(2) ?? '20.00'}
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getQuotaColor(metrics?.quotaUsedPercent ?? 0)}`}
                style={{ width: `${Math.min(metrics?.quotaUsedPercent ?? 0, 100)}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-muted-foreground text-right">
              {metrics?.quotaUsedPercent.toFixed(0) ?? 0}% used
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Token Usage Card */}
      <Card className="glass-card md:col-span-1">
        <CardHeader>
          <CardTitle className="text-base font-mono flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" /> Token Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-2xl font-bold font-mono text-gradient-cyan">
              {isLoading ? '--' : (metrics?.tokenCount ?? 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
              Total Tokens (30d)
            </div>
          </div>
          <div className="text-[11px] space-y-1 pt-2 border-t border-muted/20">
            <div className="flex justify-between font-mono">
              <span className="text-muted-foreground">Input</span>
              <span>{isLoading ? '--' : (metrics?.inputTokens ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-muted-foreground">Output</span>
              <span>{isLoading ? '--' : (metrics?.outputTokens ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Trend Sparkline Card */}
      <Card className="glass-card md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base font-mono">Cost Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">
                Loading...
              </div>
            ) : (metrics?.dailyCostTrend?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                {/* Simple sparkline chart */}
                <div className="flex items-end justify-between gap-1 h-16">
                  {metrics?.dailyCostTrend.map((day, idx) => {
                    const maxCost = Math.max(...(metrics?.dailyCostTrend.map(d => d.cost) ?? [1]));
                    const heightPercent = (day.cost / maxCost) * 100;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-primary/60 rounded-sm transition-colors hover:bg-primary"
                          style={{ height: `${heightPercent}%`, minHeight: '2px' }}
                          title={`${day.date}: $${day.cost.toFixed(2)}`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>{metrics?.dailyCostTrend?.[0]?.date ?? 'N/A'}</span>
                  <span>{metrics?.dailyCostTrend?.[metrics.dailyCostTrend.length - 1]?.date ?? 'N/A'}</span>
                </div>
              </div>
            ) : (
              <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">
                No cost data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
