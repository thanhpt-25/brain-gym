import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight,
  RefreshCw, ShieldCheck, ShieldAlert, Shield, Clock,
  Monitor, Copy, EyeOff, Maximize,
} from 'lucide-react';
import type { CandidateInvite, CandidateEvent } from '@/types/assessment-types';
import { getCandidateEvents } from '@/services/assessments';

const statusConfig: Record<string, { color: string; label: string }> = {
  INVITED: { color: 'bg-blue-500/15 text-blue-400', label: 'Invited' },
  STARTED: { color: 'bg-amber-500/15 text-amber-400', label: 'In Progress' },
  SUBMITTED: { color: 'bg-emerald-500/15 text-emerald-400', label: 'Submitted' },
  EXPIRED: { color: 'bg-zinc-500/15 text-zinc-400', label: 'Expired' },
};

const eventConfig: Record<string, { label: string; icon: any; color: string }> = {
  TAB_SWITCH: { label: 'Tab Switch', icon: Monitor, color: 'text-amber-400' },
  FULLSCREEN_EXIT: { label: 'Fullscreen Exit', icon: Maximize, color: 'text-red-400' },
  BLUR: { label: 'Window Blur', icon: EyeOff, color: 'text-zinc-400' },
  COPY: { label: 'Copy Detected', icon: Copy, color: 'text-red-400' },
  PASTE: { label: 'Paste Detected', icon: Copy, color: 'text-red-400' },
};

const IntegrityBadge = ({ score }: { score: number | null }) => {
  if (score == null) return <span className="text-muted-foreground">-</span>;
  const color = score >= 80 ? 'bg-emerald-500/15 text-emerald-400'
    : score >= 60 ? 'bg-amber-500/15 text-amber-400'
    : 'bg-red-500/15 text-red-400';
  const Icon = score >= 80 ? ShieldCheck : score >= 60 ? Shield : ShieldAlert;
  return (
    <Badge className={`text-[10px] gap-1 ${color}`}>
      <Icon className="h-3 w-3" /> {score}
    </Badge>
  );
};

const formatDuration = (seconds: number | null): string => {
  if (seconds == null) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

const EventTimeline = ({
  orgSlug, assessmentId, inviteId,
}: { orgSlug: string; assessmentId: string; inviteId: string }) => {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['candidate-events', inviteId],
    queryFn: () => getCandidateEvents(orgSlug, assessmentId, inviteId),
  });

  if (isLoading) return <p className="text-[10px] text-muted-foreground font-mono">Loading events...</p>;
  if (events.length === 0) return <p className="text-[10px] text-muted-foreground font-mono">No integrity events recorded</p>;

  return (
    <div className="space-y-1.5">
      {events.map((e) => {
        const cfg = eventConfig[e.eventType];
        const Icon = cfg?.icon ?? AlertTriangle;
        return (
          <div key={e.id} className="flex items-center gap-2 text-[10px] font-mono">
            <Icon className={`h-3 w-3 shrink-0 ${cfg?.color ?? 'text-muted-foreground'}`} />
            <span className={cfg?.color ?? 'text-muted-foreground'}>{cfg?.label ?? e.eventType}</span>
            <span className="text-muted-foreground ml-auto">
              {new Date(e.clientTs).toLocaleTimeString()}
            </span>
          </div>
        );
      })}
    </div>
  );
};

interface Props {
  candidates: CandidateInvite[];
  passingScore: number | null;
  assessmentId: string;
  orgSlug: string;
  onReinvite?: (email: string) => void;
  isReinviting?: boolean;
}

const CandidateRanking = ({
  candidates, passingScore, assessmentId, orgSlug, onReinvite, isReinviting,
}: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [timelineId, setTimelineId] = useState<string | null>(null);

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
                <th className="text-right p-3 font-medium">Integrity</th>
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
                const showTimeline = timelineId === c.id;
                const canReinvite = (c.status === 'INVITED' || c.status === 'EXPIRED') && !!onReinvite;
                const isSubmitted = c.status === 'SUBMITTED';

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
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {isSubmitted ? (
                          <button
                            className="flex items-center justify-end gap-1 hover:opacity-70 transition-opacity"
                            onClick={() => setTimelineId(showTimeline ? null : c.id)}
                            title="View integrity timeline"
                          >
                            <IntegrityBadge score={c.integrityScore} />
                          </button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
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

                    {/* Integrity Timeline */}
                    {showTimeline && (
                      <tr key={`${c.id}-timeline`} className="border-b border-border/50 bg-red-500/5">
                        <td colSpan={11} className="px-5 py-3">
                          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Integrity Event Timeline
                          </p>
                          <EventTimeline
                            orgSlug={orgSlug}
                            assessmentId={assessmentId}
                            inviteId={c.id}
                          />
                        </td>
                      </tr>
                    )}

                    {/* Domain Score Expansion */}
                    {isExpanded && hasDomainScores && (
                      <tr key={`${c.id}-domain`} className="border-b border-border/50 bg-muted/20">
                        <td colSpan={11} className="px-5 py-3">
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
