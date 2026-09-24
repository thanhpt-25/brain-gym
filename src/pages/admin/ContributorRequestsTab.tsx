import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  approveContributorRequest,
  getAdminContributorRequest,
  getAdminContributorRequests,
  getApiErrorCode,
  rejectContributorRequest,
  type AdminContributorRequest,
} from '@/services/contributorRequests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExternalLink, Loader2, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'];
const statusColor: Record<string, string> = {
  PENDING: 'bg-warning/10 text-warning border border-warning/30',
  APPROVED: 'bg-accent/10 text-accent border border-accent/30',
  REJECTED: 'bg-destructive/10 text-destructive border border-destructive/30',
  CANCELLED: 'bg-secondary text-muted-foreground',
};

const formatDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '—');
const initials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

type Decision = { type: 'approve' | 'reject'; request: AdminContributorRequest } | null;

export default function ContributorRequestsTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [text, setText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-contributor-requests', statusFilter, search, page],
    queryFn: () =>
      getAdminContributorRequests({ status: statusFilter, search: search || undefined, page, limit: 20 }),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-contributor-request', selectedId],
    queryFn: () => getAdminContributorRequest(selectedId!),
    enabled: !!selectedId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-contributor-requests'] });
    queryClient.invalidateQueries({ queryKey: ['admin-contributor-request'] });
    queryClient.invalidateQueries({ queryKey: ['admin-contributor-request-stats'] });
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const onDecisionError = (error: unknown) => {
    const code = getApiErrorCode(error);
    if (code === 'REQUEST_NOT_PENDING') {
      toast.error('This request was already handled by someone else');
    } else if (code === 'USER_NOT_ACTIVE') {
      toast.error('User is not active — reject the request instead');
    } else {
      toast.error('Failed to update request');
    }
    setDecision(null);
    refresh();
  };

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => approveContributorRequest(id, note),
    onSuccess: () => {
      toast.success('Approved — user is now a contributor');
      setDecision(null);
      setSelectedId(null);
      refresh();
    },
    onError: onDecisionError,
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectContributorRequest(id, reason),
    onSuccess: () => {
      toast.success('Request rejected');
      setDecision(null);
      setSelectedId(null);
      refresh();
    },
    onError: onDecisionError,
  });

  const openDecision = (type: 'approve' | 'reject', request: AdminContributorRequest) => {
    setText('');
    setDecision({ type, request });
  };

  const submitDecision = () => {
    if (!decision) return;
    if (decision.type === 'approve') {
      approveMutation.mutate({ id: decision.request.id, note: text.trim() || undefined });
    } else {
      rejectMutation.mutate({ id: decision.request.id, reason: text.trim() });
    }
  };

  const rejectTooShort = decision?.type === 'reject' && text.trim().length < 10;
  const submitting = approveMutation.isPending || rejectMutation.isPending;
  const shown = detail ?? data?.data.find((r) => r.id === selectedId);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-mono flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Contributor Requests
          </span>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                className="font-mono text-xs h-7"
                onClick={() => { setStatusFilter(s); setPage(1); }}
              >
                {s}
              </Button>
            ))}
          </div>
        </CardTitle>
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Search email or name…"
            aria-label="Search contributor requests"
            className="pl-8 h-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !data?.data.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No {statusFilter === 'ALL' ? '' : statusFilter.toLowerCase() + ' '}requests
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono">User</TableHead>
                  <TableHead className="font-mono">Joined</TableHead>
                  <TableHead className="font-mono text-center">Exams</TableHead>
                  <TableHead className="font-mono text-center">Avg score</TableHead>
                  <TableHead className="font-mono">Expertise</TableHead>
                  <TableHead className="font-mono">Sent</TableHead>
                  <TableHead className="font-mono text-center">Status</TableHead>
                  <TableHead className="font-mono text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(r.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={r.user.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[10px]">{initials(r.user.displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-sm truncate max-w-[160px]">{r.user.displayName}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[160px]">{r.user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(r.user.createdAt)}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{r.stats.completedAttempts}</TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {r.stats.avgScore == null ? '—' : `${r.stats.avgScore}%`}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {r.expertiseCertifications.slice(0, 3).map((c) => (
                          <Badge key={c.id} variant="outline" className="text-[10px] font-mono">{c.code}</Badge>
                        ))}
                        {r.expertiseCertifications.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{r.expertiseCertifications.length - 3}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                    <TableCell className="text-center">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${statusColor[r.status] || ''}`}>{r.status}</span>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {r.status === 'PENDING' && (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-accent" onClick={() => openDecision('approve', r)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => openDecision('reject', r)}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.meta.lastPage > 1 && (
              <div className="flex justify-center mt-4 gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                <span className="py-2 px-3 text-xs font-mono text-muted-foreground">Page {page}/{data.meta.lastPage}</span>
                <Button size="sm" variant="outline" disabled={page >= data.meta.lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Detail drawer */}
      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-mono">Contributor request</SheetTitle>
            <SheetDescription>{shown ? `${shown.user.displayName} · ${shown.user.email}` : ''}</SheetDescription>
          </SheetHeader>
          {!shown || (detailLoading && !shown) ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-5 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${statusColor[shown.status] || ''}`}>{shown.status}</span>
                <span className="text-xs text-muted-foreground">Sent {formatDate(shown.createdAt)}</span>
                {shown.user.status !== 'ACTIVE' && (
                  <Badge variant="destructive" className="text-[10px]">{shown.user.status}</Badge>
                )}
              </div>

              <section>
                <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1">Motivation</h4>
                {/* Plain text only — never render user input as HTML/markdown. */}
                <p className="whitespace-pre-line break-words">{shown.motivation}</p>
              </section>

              {shown.expertiseCertifications.length > 0 && (
                <section>
                  <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1">Expertise</h4>
                  <div className="flex flex-wrap gap-1">
                    {shown.expertiseCertifications.map((c) => (
                      <Badge key={c.id} variant="outline" className="text-xs">{c.code} · {c.name}</Badge>
                    ))}
                  </div>
                </section>
              )}

              {shown.sampleUrl && (
                <section>
                  <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1">Link</h4>
                  <a
                    href={shown.sampleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 break-all hover:underline"
                  >
                    {shown.sampleUrl} <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  </a>
                </section>
              )}

              <section>
                <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Activity</h4>
                <dl className="grid grid-cols-2 gap-2">
                  {[
                    ['Joined', formatDate(shown.user.createdAt)],
                    ['Points', shown.user.points],
                    ['Completed exams', shown.stats.completedAttempts],
                    ['Avg score', shown.stats.avgScore == null ? '—' : `${shown.stats.avgScore}%`],
                    ['Comments', shown.stats.commentsCount],
                    ['Reports filed', shown.stats.reportsFiled],
                    ['Previously rejected', shown.stats.previousRequests.rejected],
                    ['Previously cancelled', shown.stats.previousRequests.cancelled],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-md border border-border/60 p-2">
                      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
                      <dd className="font-mono">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {shown.decisionReason && (
                <section>
                  <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1">
                    Decision {shown.reviewedBy ? `by ${shown.reviewedBy.displayName}` : ''} · {formatDate(shown.reviewedAt)}
                  </h4>
                  <p className="whitespace-pre-line break-words">{shown.decisionReason}</p>
                </section>
              )}

              {detail?.history && detail.history.length > 0 && (
                <section>
                  <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1">Previous requests</h4>
                  <ul className="space-y-1">
                    {detail.history.map((h) => (
                      <li key={h.id} className="text-xs flex gap-2">
                        <span className={`font-mono px-1.5 rounded ${statusColor[h.status] || ''}`}>{h.status}</span>
                        <span className="text-muted-foreground">{formatDate(h.createdAt)}</span>
                        {h.decisionReason && <span className="truncate">{h.decisionReason}</span>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {shown.status === 'PENDING' && (
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" onClick={() => openDecision('approve', shown)}>Approve</Button>
                  <Button variant="outline" className="flex-1 text-destructive" onClick={() => openDecision('reject', shown)}>
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Approve / reject dialog */}
      <Dialog open={!!decision} onOpenChange={(open) => !open && !submitting && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.type === 'approve' ? 'Approve contributor request' : 'Reject contributor request'}
            </DialogTitle>
            <DialogDescription>
              {decision?.type === 'approve'
                ? `${decision?.request.user.displayName} will become a CONTRIBUTOR and be notified by email.`
                : `${decision?.request.user.displayName} will be notified with your reason and can re-apply after the cooldown.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="contributor-decision-text">
              {decision?.type === 'approve' ? 'Note (optional)' : 'Reason (required)'}
            </Label>
            <Textarea
              id="contributor-decision-text"
              rows={4}
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-invalid={rejectTooShort && text.length > 0}
            />
            {decision?.type === 'reject' && (
              <p className="text-xs text-muted-foreground">At least 10 characters.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDecision(null)} disabled={submitting}>Cancel</Button>
            <Button
              variant={decision?.type === 'reject' ? 'destructive' : 'default'}
              onClick={submitDecision}
              disabled={submitting || rejectTooShort}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {decision?.type === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
