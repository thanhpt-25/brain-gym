import { motion } from 'framer-motion';
import { Shield, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsSummary, DomainPerformance } from '@/services/analytics';

interface Props {
  summary: AnalyticsSummary | undefined;
  domains: DomainPerformance[] | undefined;
  weakTopics: DomainPerformance[] | undefined;
}

function computeReadiness(summary?: AnalyticsSummary, domains?: DomainPerformance[]) {
  if (!summary || !summary.totalExams) return { score: 0, probability: 0, level: 'low' as const };

  const avgWeight = 0.4;
  const passRateWeight = 0.3;
  const consistencyWeight = 0.3;

  const avgNorm = Math.min(summary.avgScore / 100, 1);
  const passNorm = Math.min(summary.passRate / 100, 1);

  // Consistency: how uniform are domain scores
  let consistencyNorm = 0.5;
  if (domains && domains.length > 1) {
    const mean = domains.reduce((s, d) => s + d.percentage, 0) / domains.length;
    const variance = domains.reduce((s, d) => s + (d.percentage - mean) ** 2, 0) / domains.length;
    const stdDev = Math.sqrt(variance);
    consistencyNorm = Math.max(0, 1 - stdDev / 50);
  }

  const score = Math.round((avgNorm * avgWeight + passNorm * passRateWeight + consistencyNorm * consistencyWeight) * 100);
  const probability = Math.round(Math.min(100, score * 0.95 + (summary.bestScore > 80 ? 5 : 0)));

  const level = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
  return { score, probability, level };
}

export default function ReadinessScore({ summary, domains, weakTopics }: Props) {
  const { score, probability, level } = computeReadiness(summary, domains);

  const colorMap = {
    high: { ring: 'hsl(var(--accent))', text: 'text-accent', label: 'Ready' },
    medium: { ring: 'hsl(var(--warning))', text: 'text-warning', label: 'Almost There' },
    low: { ring: 'hsl(var(--destructive))', text: 'text-destructive', label: 'Keep Practicing' },
  };
  const c = colorMap[level];

  const circumference = 2 * Math.PI * 54;
  const strokeOffset = circumference - (score / 100) * circumference;

  const recommendedDomains = (weakTopics ?? []).filter(d => d.percentage < 70).slice(0, 3);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-mono flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> Exam Readiness
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row items-center gap-6">
        {/* Circular gauge */}
        <div className="relative w-32 h-32 shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
            <motion.circle
              cx="60" cy="60" r="54" fill="none"
              stroke={c.ring}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: strokeOffset }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold font-mono ${c.text}`}>{score}%</span>
            <span className="text-[10px] text-muted-foreground">{c.label}</span>
          </div>
        </div>

        <div className="flex-1 space-y-4 min-w-0">
          {/* Pass probability */}
          <div className="flex items-center gap-3">
            <TrendingUp className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-1">Pass Probability</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: c.ring }}
                    initial={{ width: 0 }}
                    animate={{ width: `${probability}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                  />
                </div>
                <span className={`text-sm font-mono font-bold ${c.text}`}>{probability}%</span>
              </div>
            </div>
          </div>

          {/* Recommended domains */}
          {recommendedDomains.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs text-muted-foreground">Focus Areas</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recommendedDomains.map(d => (
                  <span
                    key={d.domain}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-warning/10 text-warning text-[11px] font-mono"
                  >
                    {d.domain}
                    <span className="text-warning/60">{d.percentage}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
