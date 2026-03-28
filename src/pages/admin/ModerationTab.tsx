import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingQuestions, updateQuestionStatus, adminDeleteQuestion, bulkUpdateQuestionStatus } from '@/services/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, CheckCircle2, XCircle, Loader2, Trash2, CheckCheck, X } from 'lucide-react';
import { toast } from 'sonner';

export default function ModerationTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['admin-pending', page],
    queryFn: () => getPendingQuestions(page, 10),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateQuestionStatus(id, status),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-pending'] }); toast.success('Question status updated'); },
    onError: () => toast.error('Failed to update status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteQuestion(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-pending'] }); toast.success('Question deleted'); },
    onError: () => toast.error('Failed to delete'),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) => bulkUpdateQuestionStatus(ids, status),
    onSuccess: (data, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending'] });
      setSelected(new Set());
      toast.success(`${data.updated} question(s) ${status === 'APPROVED' ? 'approved' : 'rejected'}`);
    },
    onError: () => toast.error('Bulk action failed'),
  });

  const questions = data?.data ?? [];
  const allSelected = questions.length > 0 && questions.every(q => selected.has(q.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(questions.map(q => q.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-mono flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Question Moderation Queue
            {data && <Badge variant="secondary" className="font-mono">{data.meta.total} pending</Badge>}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-xs font-mono text-primary">{selected.size} selected</span>
            <Button
              size="sm"
              className="h-7 font-mono text-xs text-accent border-accent/30 bg-accent/10 hover:bg-accent/20"
              variant="outline"
              onClick={() => bulkMutation.mutate({ ids: [...selected], status: 'APPROVED' })}
              disabled={bulkMutation.isPending}
            >
              <CheckCheck className="h-3 w-3 mr-1" /> Approve All
            </Button>
            <Button
              size="sm"
              className="h-7 font-mono text-xs text-destructive border-destructive/30 bg-destructive/10 hover:bg-destructive/20"
              variant="outline"
              onClick={() => bulkMutation.mutate({ ids: [...selected], status: 'REJECTED' })}
              disabled={bulkMutation.isPending}
            >
              <X className="h-3 w-3 mr-1" /> Reject All
            </Button>
            <Button size="sm" variant="ghost" className="h-7 font-mono text-xs ml-auto" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : questions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No pending questions</p>
        ) : (
          <div className="space-y-4">
            {/* Select all row */}
            <div className="flex items-center gap-3 px-1 pb-2 border-b border-border">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              <span className="text-xs font-mono text-muted-foreground">Select all on this page</span>
            </div>

            {questions.map(q => (
              <div key={q.id} className={`p-4 rounded-lg border transition-colors ${selected.has(q.id) ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/30'}`}>
                <div className="flex items-start gap-3 mb-3">
                  <Checkbox
                    checked={selected.has(q.id)}
                    onCheckedChange={() => toggleOne(q.id)}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">{q.certification.code}</span>
                          <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${q.difficulty === 'EASY' ? 'bg-accent/10 text-accent' : q.difficulty === 'MEDIUM' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>{q.difficulty}</span>
                          <span className="text-xs text-muted-foreground">by {q.author.displayName}</span>
                        </div>
                        <h4 className="text-sm font-medium">{q.title}</h4>
                        {q.description && <p className="text-xs text-muted-foreground mt-1">{q.description}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="text-accent border-accent/30 hover:bg-accent/10 h-8" onClick={() => statusMutation.mutate({ id: q.id, status: 'APPROVED' })} disabled={statusMutation.isPending}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8" onClick={() => statusMutation.mutate({ id: q.id, status: 'REJECTED' })} disabled={statusMutation.isPending}>
                          <XCircle className="h-3 w-3 mr-1" /> Reject
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive h-8" onClick={() => { if (confirm('Delete this question permanently?')) deleteMutation.mutate(q.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1 ml-7">
                  {q.choices.map(c => (
                    <div key={c.id} className={`text-xs px-3 py-1.5 rounded ${c.isCorrect ? 'bg-accent/10 text-accent' : 'text-muted-foreground'}`}>
                      {c.label.toUpperCase()}. {c.content} {c.isCorrect && '✓'}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {data && data.meta.lastPage > 1 && (
              <div className="flex justify-center gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <span className="py-2 px-3 text-xs font-mono text-muted-foreground">Page {page}/{data.meta.lastPage}</span>
                <Button size="sm" variant="outline" disabled={page >= data.meta.lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
