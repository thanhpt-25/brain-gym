import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight, RefreshCw,
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
  onReinvite?: (email: string) => void;
  isReinviting?: boolean;
}

const CandidateRanking = ({ candidates, passingScore, onReinvite, isReinviting }: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left p-3 font-medium w-6"></th>
                <th className="text-left p-3 font-medium">#</th>
                <th className="text-left p-3 font-medium">Candidate</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Score</th>
                <th className="text-right p-3 font-medium">Correct</th>
                <th className="text-right p-3 font-medium">Time</th>
                <th className="text-right p-3 font-medium">Switches</th>
                <th className="text-left p-3 font-medium">Result</th>
                <th className="text-right p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c, i) => {
                const passed = passingScore != null && c.score != null
                  ? Number(c.score) >= passingScore
                  : null;
                const hasDomainScores = c.domainScores && Object.keys(c.domainScores).length > 0;
                const isExpanded = expandedId === c.id;
                const canReinvite = (c.status === 'INVITED' || c.status === 'EXPIRED') && !!onReinvite;

                return (
                  <>
                    <tr
                      key={c.id}
                      className={`border-b border-border/50 ${hasDomainScores ? 'cursor-pointer hover:bg-muted/30' : ''}`}
                      onClick={() => hasDomainScores && setExpandedId(isExpanded ? null : c.id)}
                    >
                      <td className="p-3 text-muted-foreground">
                        {hasDomainScores && (
                          isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5" />
                            : <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </td>
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
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {canReinvite && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] font-mono text-muted-foreground hover:text-foreground"
                            disabled={isReinviting}
                            onClick={() => onReinvite!(c.candidateEmail)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" /> Re-send
                          </Button>
                        )}
                      </td>
                    </tr>

                    {/* Domain Score Expansion */}
                    {isExpanded && hasDomainScores && (
                      <tr key={`${c.id}-domain`} className="border-b border-border/50 bg-muted/20">
                        <td colSpan={10} className="px-5 py-3">
                          <div className="space-y-2">
                            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">
                              Domain Breakdown
                            </p>
                            {Object.entries(c.domainScores!).map(([domain, stats]) => {
                              const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                              const isWeak = pct < (passingScore ?? 70);
                              return (
                                <div key={domain} className="flex items-center gap-3">
                                  <span className="w-40 truncate text-[10px] font-mono text-muted-foreground shrink-0">
                                    {domain}
                                  </span>
                                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        isWeak ? 'bg-red-500' : 'bg-emerald-500'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className={`text-[10px] font-mono w-14 text-right shrink-0 ${
                                    isWeak ? 'text-red-400' : 'text-emerald-400'
                                  }`}>
                                    {stats.correct}/{stats.total} ({pct}%)
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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
