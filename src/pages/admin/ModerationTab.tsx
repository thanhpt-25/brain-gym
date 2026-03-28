import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingQuestions, updateQuestionStatus, adminDeleteQuestion } from '@/services/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ModerationTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

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

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-mono flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Question Moderation Queue
          {data && <Badge variant="secondary" className="font-mono">{data.meta.total} pending</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : data?.data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No pending questions</p>
        ) : (
          <div className="space-y-4">
            {data?.data.map(q => (
              <div key={q.id} className="p-4 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-start justify-between gap-4 mb-3">
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
                <div className="space-y-1">
                  {q.choices.map(c => (
                    <div key={c.id} className={`text-xs px-3 py-1.5 rounded ${c.isCorrect ? 'bg-accent/10 text-accent' : 'text-muted-foreground'}`}>
                      {c.label.toUpperCase()}. {c.content} {c.isCorrect && '\u2713'}
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
