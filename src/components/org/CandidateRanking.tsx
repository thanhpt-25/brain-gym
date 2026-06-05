import { useState, useEffect, Fragment } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  MoreVertical,
  Star,
  UserCheck,
  UserX,
  Eye,
  Search,
  ThumbsUp,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Clock,
  Monitor,
  Copy,
  EyeOff,
  Maximize,
} from 'lucide-react';
import { toast } from 'sonner';
import { updateCandidateDecision, getCandidateEvents } from '@/services/assessments';
import type { CandidateInvite, CandidateStage, CandidateEvent } from '@/types/assessment-types';

// ─── Stage config ─────────────────────────────────────────────────────────────

const stageConfig: Record<
  CandidateStage,
  { color: string; label: string; icon: React.ElementType }
> = {
  APPLIED:     { color: 'bg-blue-500/15 text-blue-400',    label: 'Applied',     icon: Eye },
  SCREENING:   { color: 'bg-amber-500/15 text-amber-400',  label: 'Screening',   icon: Search },
  SHORTLISTED: { color: 'bg-violet-500/15 text-violet-400',label: 'Shortlisted', icon: ThumbsUp },
  REJECTED:    { color: 'bg-red-500/15 text-red-400',      label: 'Rejected',    icon: UserX },
  HIRED:       { color: 'bg-emerald-500/15 text-emerald-400', label: 'Hired',    icon: UserCheck },
};

const attemptStatusConfig: Record<string, { color: string; label: string }> = {
  INVITED:   { color: 'bg-slate-500/15 text-slate-400',   label: 'Invited' },
  STARTED:   { color: 'bg-amber-500/15 text-amber-400',   label: 'In Progress' },
  SUBMITTED: { color: 'bg-emerald-500/15 text-emerald-400', label: 'Submitted' },
  EXPIRED:   { color: 'bg-zinc-500/15 text-zinc-400',     label: 'Expired' },
};

const formatDuration = (seconds: number | null): string => {
  if (seconds == null) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

// ─── Integrity ────────────────────────────────────────────────────────────────

const eventConfig: Record<string, { label: string; icon: any; color: string }> = {
  TAB_SWITCH:      { label: 'Tab Switch',       icon: Monitor,  color: 'text-amber-400' },
  FULLSCREEN_EXIT: { label: 'Fullscreen Exit',  icon: Maximize, color: 'text-red-400'   },
  BLUR:            { label: 'Window Blur',       icon: EyeOff,   color: 'text-zinc-400'  },
  COPY:            { label: 'Copy Detected',     icon: Copy,     color: 'text-red-400'   },
  PASTE:           { label: 'Paste Detected',    icon: Copy,     color: 'text-red-400'   },
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

const EventTimeline = ({
  slug, aid, inviteId,
}: { slug: string; aid: string; inviteId: string }) => {
  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: ['candidate-events', inviteId],
    queryFn: () => getCandidateEvents(slug, aid, inviteId),
  });

  if (isLoading) return <p className="text-[10px] text-muted-foreground font-mono">Loading events…</p>;
  if (isError)   return <p className="text-[10px] text-red-400 font-mono">Failed to load event timeline</p>;
  if (events.length === 0) return <p className="text-[10px] text-muted-foreground font-mono">No integrity events recorded</p>;

  return (
    <div className="space-y-1.5">
      {events.map((e: CandidateEvent) => {
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

// ─── StarRating ───────────────────────────────────────────────────────────────

const StarRating = ({
  value,
  onChange,
  readonly,
}: {
  value: number | null;
  onChange?: (n: number) => void;
  readonly?: boolean;
}) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        className={`h-3.5 w-3.5 transition-colors ${
          (value ?? 0) >= n ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
        } ${!readonly ? 'cursor-pointer hover:text-amber-400' : ''}`}
        onClick={!readonly ? () => onChange?.(n) : undefined}
      />
    ))}
  </div>
);

// ─── CandidateDetailDrawer ────────────────────────────────────────────────────

interface DrawerProps {
  candidate: CandidateInvite | null;
  passingScore: number | null;
  slug: string;
  aid: string;
  onClose: () => void;
  onUpdated: () => void;
}

const CandidateDetailDrawer = ({
  candidate,
  passingScore,
  slug,
  aid,
  onClose,
  onUpdated,
}: DrawerProps) => {
  const [note, setNote] = useState(candidate?.recruiterNote ?? '');
  const [rating, setRating] = useState<number | null>(candidate?.rating ?? null);

  // Sync state when a different candidate is opened
  useEffect(() => {
    setNote(candidate?.recruiterNote ?? '');
    setRating(candidate?.rating ?? null);
  }, [candidate?.id]);

  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof updateCandidateDecision>[3]) =>
      updateCandidateDecision(slug, aid, candidate!.id, data),
    onSuccess: () => {
      toast.success('Updated');
      onUpdated();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Update failed'),
  });

  if (!candidate) return null;

  const passed =
    passingScore != null && candidate.score != null
      ? Number(candidate.score) >= passingScore
      : null;

  const handleSaveNote = () => {
    mutation.mutate({ recruiterNote: note });
  };

  const handleRating = (n: number) => {
    setRating(n);
    mutation.mutate({ rating: n });
  };

  return (
    <Sheet open={!!candidate} onOpenChange={onClose}>
      <SheetContent className="w-[420px] sm:w-[520px] overflow-y-auto bg-card border-border">
        <SheetHeader className="mb-4">
          <SheetTitle className="font-mono text-base">
            {candidate.candidateName || candidate.candidateEmail}
          </SheetTitle>
          {candidate.candidateName && (
            <p className="text-xs text-muted-foreground">{candidate.candidateEmail}</p>
          )}
        </SheetHeader>

        <div className="space-y-5">
          {/* Score summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Score',
                value: candidate.score != null ? `${Number(candidate.score).toFixed(1)}%` : '-',
                accent: passed === true ? 'text-emerald-400' : passed === false ? 'text-red-400' : '',
              },
              {
                label: 'Correct',
                value: candidate.totalCorrect != null
                  ? `${candidate.totalCorrect}/${candidate.totalQuestions}`
                  : '-',
                accent: '',
              },
              {
                label: 'Percentile',
                value: candidate.percentile != null ? `${candidate.percentile}th` : '-',
                accent: 'text-violet-400',
              },
            ].map(({ label, value, accent }) => (
              <div key={label} className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{label}</p>
                <p className={`text-lg font-mono font-bold mt-0.5 ${accent}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Meta */}
          <div className="space-y-1.5 text-[11px] font-mono">
            {[
              { label: 'Status', value: attemptStatusConfig[candidate.status]?.label ?? candidate.status },
              { label: 'Time spent', value: formatDuration(candidate.timeSpent) },
              { label: 'Tab switches', value: String(candidate.tabSwitchCount ?? 0) },
              { label: 'Submitted', value: candidate.submittedAt ? new Date(candidate.submittedAt).toLocaleString() : '-' },
              { label: 'Expires', value: new Date(candidate.expiresAt).toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>

          {/* Domain scores */}
          {candidate.domainScores && Object.keys(candidate.domainScores).length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">
                Domain Breakdown
              </p>
              <div className="space-y-2">
                {Object.entries(candidate.domainScores).map(([domain, stats]) => {
                  const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                  const isWeak = pct < (passingScore ?? 70);
                  return (
                    <div key={domain} className="flex items-center gap-3">
                      <span className="w-32 truncate text-[10px] font-mono text-muted-foreground shrink-0">
                        {domain}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isWeak ? 'bg-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-mono w-16 text-right shrink-0 ${isWeak ? 'text-red-400' : 'text-emerald-400'}`}>
                        {stats.correct}/{stats.total} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rating */}
          <div>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">
              Rating
            </p>
            <StarRating value={rating} onChange={handleRating} />
          </div>

          {/* Recruiter note */}
          <div>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">
              Internal Note
            </p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add internal notes about this candidate…"
              className="text-xs font-mono bg-muted/30 border-border resize-none min-h-[80px]"
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-2 text-xs font-mono"
              onClick={handleSaveNote}
              disabled={mutation.isPending}
            >
              Save note
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  candidates: CandidateInvite[];
  passingScore: number | null;
  slug: string;
  aid: string;
  onReinvite?: (email: string) => void;
  isReinviting?: boolean;
}

const CandidateRanking = ({
  candidates,
  passingScore,
  slug,
  aid,
  onReinvite,
  isReinviting,
}: Props) => {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [timelineId, setTimelineId] = useState<string | null>(null);
  const [drawerCandidate, setDrawerCandidate] = useState<CandidateInvite | null>(null);

  const stageMutation = useMutation({
    mutationFn: ({
      inviteId,
      stage,
    }: {
      inviteId: string;
      stage: CandidateStage;
    }) => updateCandidateDecision(slug, aid, inviteId, { stage }),
    onSuccess: () => {
      toast.success('Stage updated');
      queryClient.invalidateQueries({ queryKey: ['assessment-results', slug, aid] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Update failed'),
  });

  const handleUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['assessment-results', slug, aid] });
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left p-3 font-medium w-6"></th>
                  <th className="text-left p-3 font-medium">#</th>
                  <th className="text-left p-3 font-medium">Candidate</th>
                  <th className="text-left p-3 font-medium">Attempt</th>
                  <th className="text-left p-3 font-medium">Stage</th>
                  <th className="text-right p-3 font-medium">Score</th>
                  <th className="text-right p-3 font-medium">%tile</th>
                  <th className="text-right p-3 font-medium">Time</th>
                  <th className="text-right p-3 font-medium">Switches</th>
                  <th className="text-right p-3 font-medium">Integrity</th>
                  <th className="text-left p-3 font-medium">Result</th>
                  <th className="text-right p-3 font-medium">Rating</th>
                  <th className="text-right p-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, i) => {
                  const passed =
                    passingScore != null && c.score != null
                      ? Number(c.score) >= passingScore
                      : null;
                  const hasDomainScores =
                    c.domainScores && Object.keys(c.domainScores).length > 0;
                  const isExpanded = expandedId === c.id;
                  const canReinvite =
                    (c.status === 'INVITED' || c.status === 'EXPIRED') && !!onReinvite;
                  const stage = c.stage ?? 'APPLIED';
                  const StageCfg = stageConfig[stage];

                  return (
                    <Fragment key={c.id}>
                      <tr
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      >
                        {/* expand toggle */}
                        <td
                          className="p-3 text-muted-foreground cursor-pointer"
                          onClick={() =>
                            hasDomainScores && setExpandedId(isExpanded ? null : c.id)
                          }
                        >
                          {hasDomainScores &&
                            (isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            ))}
                        </td>
                        <td className="p-3 text-muted-foreground">{i + 1}</td>
                        <td className="p-3">
                          <div>
                            {c.candidateName && (
                              <span className="font-medium block">{c.candidateName}</span>
                            )}
                            <span className="text-muted-foreground">{c.candidateEmail}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge
                            className={`text-[10px] ${attemptStatusConfig[c.status]?.color ?? ''}`}
                          >
                            {attemptStatusConfig[c.status]?.label ?? c.status}
                          </Badge>
                        </td>
                        {/* Stage badge */}
                        <td className="p-3">
                          <Badge className={`text-[10px] ${StageCfg.color}`}>
                            {StageCfg.label}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          {c.score != null ? `${Number(c.score).toFixed(1)}%` : '-'}
                        </td>
                        <td className="p-3 text-right text-violet-400">
                          {c.percentile != null ? `${c.percentile}th` : '-'}
                        </td>
                        <td className="p-3 text-right">{formatDuration(c.timeSpent)}</td>
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
                          {c.status === 'SUBMITTED' ? (
                            <button
                              className="flex items-center justify-end gap-1 hover:opacity-70 transition-opacity"
                              onClick={() => setTimelineId(timelineId === c.id ? null : c.id)}
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
                        <td className="p-3 text-right">
                          <StarRating value={c.rating} readonly />
                        </td>
                        {/* Actions */}
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs font-mono w-44">
                              <DropdownMenuItem onClick={() => setDrawerCandidate(c)}>
                                <Eye className="h-3.5 w-3.5 mr-2" /> View details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {(
                                ['APPLIED', 'SCREENING', 'SHORTLISTED', 'REJECTED', 'HIRED'] as CandidateStage[]
                              )
                                .filter((s) => s !== stage)
                                .map((s) => {
                                  const cfg = stageConfig[s];
                                  const Icon = cfg.icon;
                                  return (
                                    <DropdownMenuItem
                                      key={s}
                                      onClick={() =>
                                        stageMutation.mutate({ inviteId: c.id, stage: s })
                                      }
                                      disabled={stageMutation.isPending}
                                    >
                                      <Icon className="h-3.5 w-3.5 mr-2" />
                                      Move to {cfg.label}
                                    </DropdownMenuItem>
                                  );
                                })}
                              {canReinvite && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => onReinvite!(c.candidateEmail)}
                                    disabled={isReinviting}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5 mr-2" /> Re-send invite
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>

                      {/* Integrity timeline */}
                      {timelineId === c.id && (
                        <tr key={`${c.id}-timeline`} className="border-b border-border/50 bg-red-500/5">
                          <td colSpan={13} className="px-5 py-3">
                            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Integrity Event Timeline
                            </p>
                            <EventTimeline slug={slug} aid={aid} inviteId={c.id} />
                          </td>
                        </tr>
                      )}

                      {/* Domain score expansion */}
                      {isExpanded && hasDomainScores && (
                        <tr key={`${c.id}-domain`} className="border-b border-border/50 bg-muted/20">
                          <td colSpan={13} className="px-5 py-3">
                            <div className="space-y-2">
                              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-2">
                                Domain Breakdown
                              </p>
                              {Object.entries(c.domainScores!).map(([domain, stats]) => {
                                const pct =
                                  stats.total > 0
                                    ? Math.round((stats.correct / stats.total) * 100)
                                    : 0;
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
                                    <span
                                      className={`text-[10px] font-mono w-16 text-right shrink-0 ${
                                        isWeak ? 'text-red-400' : 'text-emerald-400'
                                      }`}
                                    >
                                      {stats.correct}/{stats.total} ({pct}%)
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <CandidateDetailDrawer
        candidate={drawerCandidate}
        passingScore={passingScore}
        slug={slug}
        aid={aid}
        onClose={() => setDrawerCandidate(null)}
        onUpdated={handleUpdated}
      />
    </>
  );
};

export default CandidateRanking;
