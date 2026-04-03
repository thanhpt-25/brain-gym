import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getQuestions } from '@/services/questions';
import { clonePublicQuestion } from '@/services/org-questions';
import { useOrgStore } from '@/stores/org.store';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface CloneQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CloneQuestionDialog = ({ open, onOpenChange }: CloneQuestionDialogProps) => {
  const queryClient = useQueryClient();
  const slug = useOrgStore((s) => s.currentOrg?.slug) || '';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['public-questions', search, page],
    queryFn: () => getQuestions(undefined, page, 10, undefined, 'APPROVED'),
    enabled: open,
  });

  const cloneMutation = useMutation({
    mutationFn: (sourceId: string) => clonePublicQuestion(slug, sourceId),
    onSuccess: () => {
      toast.success('Question cloned to your org');
      queryClient.invalidateQueries({ queryKey: ['org-questions', slug] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Clone failed'),
  });

  const questions = data?.data || [];
  const meta = data?.meta;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-mono">Clone Public Question</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search public questions..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10 bg-muted border-border"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : questions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 font-mono">
              No questions found
            </p>
          ) : (
            questions.map((q) => (
              <div
                key={q.id}
                className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-mono truncate">{q.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">
                      {q.difficulty}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {q.questionType}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={cloneMutation.isPending}
                  onClick={() => cloneMutation.mutate(q.id)}
                >
                  <Copy className="h-3 w-3 mr-1" /> Clone
                </Button>
              </div>
            ))
          )}
        </div>

        {meta && meta.lastPage > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono text-muted-foreground">
              {page} / {meta.lastPage}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.lastPage}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CloneQuestionDialog;
