import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle2, XCircle, Clock, Eye, AlertTriangle,
} from 'lucide-react';
import type { CandidateInvite } from '@/types/assessment-types';

const statusConfig: Record<string, { color: string; label: string }> = {
  INVITED: { color: 'bg-blue-500/15 text-blue-400', label: 'Invited' },
  STARTED: { color: 'bg-amber-500/15 text-amber-400', label: 'In Progress' },
  SUBMITTED: { color: 'bg-emerald-500/15 text-emerald-400', label: 'Submitted' },
  EXPIRED: { color: 'bg-zinc-500/15 text-zinc-400', label: 'Expired' },
};

const formatDuration = (seconds: number | null): string => {
  if (seconds == null) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

interface Props {
  candidates: CandidateInvite[];
  passingScore: number | null;
}

const CandidateRanking = ({ candidates, passingScore }: Props) => {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left p-3 font-medium">#</th>
                <th className="text-left p-3 font-medium">Candidate</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Score</th>
                <th className="text-right p-3 font-medium">Correct</th>
                <th className="text-right p-3 font-medium">Time</th>
                <th className="text-right p-3 font-medium">Tab Switches</th>
                <th className="text-left p-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c, i) => {
                const passed = passingScore != null && c.score != null
                  ? Number(c.score) >= passingScore
                  : null;

                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground">{i + 1}</td>
                    <td className="p-3">
                      <div>
                        {c.candidateName && (
                          <span className="font-medium">{c.candidateName}</span>
                        )}
                        <span className={`${c.candidateName ? 'text-muted-foreground ml-1' : ''}`}>
                          {c.candidateEmail}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge className={`text-[10px] ${statusConfig[c.status]?.color ?? ''}`}>
                        {statusConfig[c.status]?.label ?? c.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {c.score != null ? `${Number(c.score).toFixed(1)}%` : '-'}
                    </td>
                    <td className="p-3 text-right">
                      {c.totalCorrect != null ? `${c.totalCorrect}/${c.totalQuestions}` : '-'}
                    </td>
                    <td className="p-3 text-right">
                      {formatDuration(c.timeSpent)}
                    </td>
                    <td className="p-3 text-right">
                      {c.tabSwitchCount != null && c.tabSwitchCount > 0 ? (
                        <span className="flex items-center justify-end gap-1 text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> {c.tabSwitchCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="p-3">
                      {passed === true && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Pass
                        </span>
                      )}
                      {passed === false && (
                        <span className="flex items-center gap-1 text-red-400">
                          <XCircle className="h-3.5 w-3.5" /> Fail
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default CandidateRanking;
