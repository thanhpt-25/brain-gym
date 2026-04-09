import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';
import type { CertReadiness } from '@/services/org-analytics';

interface Props {
  data: CertReadiness[];
}

const getScoreColor = (score: number) => {
  if (score >= 80) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (score >= 60) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
};

const ReadinessHeatmap = ({ data }: Props) => {
  if (data.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Target className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            No certification data yet. Members need to take exams first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="font-mono text-sm flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> Certification Readiness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-mono text-xs text-muted-foreground py-2 pr-4">Certification</th>
                <th className="text-center font-mono text-xs text-muted-foreground py-2 px-3">Attempted</th>
                <th className="text-center font-mono text-xs text-muted-foreground py-2 px-3">Avg Score</th>
                <th className="text-center font-mono text-xs text-muted-foreground py-2 px-3">Passed</th>
                <th className="text-center font-mono text-xs text-muted-foreground py-2 px-3">Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.map((cert) => (
                <tr key={cert.certificationId} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 pr-4">
                    <div>
                      <p className="font-mono font-medium text-sm">{cert.certificationCode}</p>
                      <p className="text-xs text-muted-foreground">{cert.certificationName}</p>
                    </div>
                  </td>
                  <td className="text-center py-3 px-3">
                    <span className="font-mono text-sm">
                      {cert.membersAttempted}/{cert.totalMembers}
                    </span>
                  </td>
                  <td className="text-center py-3 px-3">
                    <Badge variant="outline" className={`font-mono text-xs ${getScoreColor(cert.avgScore)}`}>
                      {cert.avgScore}%
                    </Badge>
                  </td>
                  <td className="text-center py-3 px-3">
                    <span className="font-mono text-sm">{cert.passedMembers}</span>
                  </td>
                  <td className="text-center py-3 px-3">
                    <Badge variant="outline" className={`font-mono text-xs ${getScoreColor(cert.passRate)}`}>
                      {cert.passRate}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReadinessHeatmap;
