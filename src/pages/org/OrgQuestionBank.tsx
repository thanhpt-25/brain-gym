import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2, Send, CheckCircle2, XCircle,
  BookOpen, Copy, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrgStore } from '@/stores/org.store';
import { useAuthStore } from '@/stores/auth.store';
import {
  getOrgQuestions, submitOrgQuestion, approveOrgQuestion,
  rejectOrgQuestion, deleteOrgQuestion,
} from '@/services/org-questions';
import { getCertifications } from '@/services/certifications';
import CloneQuestionDialog from '@/components/org/CloneQuestionDialog';
import type { OrgQuestionStatus, OrgQuestionFilters } from '@/types/org-question-types';

const statusColors: Record<OrgQuestionStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  UNDER_REVIEW: 'bg-amber-500/20 text-amber-400',
  APPROVED: 'bg-emerald-500/20 text-emerald-400',
  REJECTED: 'bg-red-500/20 text-red-400',
};

const difficultyColors: Record<string, string> = {
  EASY: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  MEDIUM: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  HARD: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const OrgQuestionBank = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const user = useAuthStore((s) => s.user);
  const slug = currentOrg?.slug || '';
  const myRole = currentOrg?.myRole;
  const canReview = myRole === 'OWNER' || myRole === 'ADMIN';

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [certFilter, setCertFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [cloneOpen, setCloneOpen] = useState(false);

  const { data: certifications = [] } = useQuery({
    queryKey: ['certifications'],
    queryFn: getCertifications,
  });

  const filters: OrgQuestionFilters = {
    page,
    limit: 20,
    ...(statusFilter !== 'all' ? { status: statusFilter as OrgQuestionStatus } : {}),
    ...(difficultyFilter !== 'all' ? { difficulty: difficultyFilter } : {}),
    ...(certFilter !== 'all' ? { certificationId: certFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['org-questions', slug, filters],
    queryFn: () => getOrgQuestions(slug, filters),
    enabled: !!slug,
  });

  const submitMutation = useMutation({
    mutationFn: (qId: string) => submitOrgQuestion(slug, qId),
    onSuccess: () => { toast.success('Submitted for review'); queryClient.invalidateQueries({ queryKey: ['org-questions', slug] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const approveMutation = useMutation({
    mutationFn: (qId: string) => approveOrgQuestion(slug, qId),
    onSuccess: () => { toast.success('Question approved'); queryClient.invalidateQueries({ queryKey: ['org-questions', slug] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: (qId: string) => rejectOrgQuestion(slug, qId),
    onSuccess: () => { toast.success('Question rejected'); queryClient.invalidateQueries({ queryKey: ['org-questions', slug] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (qId: string) => deleteOrgQuestion(slug, qId),
    onSuccess: () => { toast.success('Question deleted'); queryClient.invalidateQueries({ queryKey: ['org-questions', slug] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const questions = data?.data || [];
  const meta = data?.meta;

  const handleTabChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-mono font-bold">Question Bank</h1>
          <p className="text-sm text-muted-foreground font-mono">
            {meta?.total ?? 0} questions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCloneOpen(true)}>
            <Copy className="h-4 w-4 mr-1.5" /> Clone Public
          </Button>
          <Button size="sm" className="glow-cyan" onClick={() => navigate(`/org/${slug}/questions/new`)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Question
          </Button>
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs value={statusFilter} onValueChange={handleTabChange}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="all" className="font-mono text-xs">All</TabsTrigger>
          <TabsTrigger value="DRAFT" className="font-mono text-xs">Draft</TabsTrigger>
          <TabsTrigger value="UNDER_REVIEW" className="font-mono text-xs">Under Review</TabsTrigger>
          <TabsTrigger value="APPROVED" className="font-mono text-xs">Approved</TabsTrigger>
          <TabsTrigger value="REJECTED" className="font-mono text-xs">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10 bg-muted border-border"
          />
        </div>
        <Select value={difficultyFilter} onValueChange={(v) => { setDifficultyFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] bg-muted border-border">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="EASY">Easy</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HARD">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={certFilter} onValueChange={(v) => { setCertFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] bg-muted border-border">
            <SelectValue placeholder="Certification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Certs</SelectItem>
            {certifications.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Questions List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-mono">No questions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => {
            const isAuthor = q.createdBy === user?.id;
            return (
              <Card
                key={q.id}
                className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/org/${slug}/questions/${q.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-mono font-medium truncate">{q.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] border-0 ${statusColors[q.status]}`}>
                          {q.status.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${difficultyColors[q.difficulty] || ''}`}>
                          {q.difficulty}
                        </Badge>
                        {q.certification && (
                          <Badge variant="outline" className="text-[10px] text-primary">{q.certification.code}</Badge>
                        )}
                        {q.category && (
                          <Badge variant="outline" className="text-[10px]">{q.category}</Badge>
                        )}
                        {q.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] text-muted-foreground">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      {q.author && (
                        <p className="text-xs text-muted-foreground mt-1">
                          by {q.author.displayName} · v{q.version}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border" onClick={(e) => e.stopPropagation()}>
                        {isAuthor && q.status === 'DRAFT' && (
                          <DropdownMenuItem className="font-mono text-xs" onClick={() => submitMutation.mutate(q.id)}>
                            <Send className="h-3 w-3 mr-2" /> Submit for Review
                          </DropdownMenuItem>
                        )}
                        {canReview && q.status === 'UNDER_REVIEW' && (
                          <>
                            <DropdownMenuItem className="font-mono text-xs" onClick={() => approveMutation.mutate(q.id)}>
                              <CheckCircle2 className="h-3 w-3 mr-2" /> Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem className="font-mono text-xs" onClick={() => rejectMutation.mutate(q.id)}>
                              <XCircle className="h-3 w-3 mr-2" /> Reject
                            </DropdownMenuItem>
                          </>
                        )}
                        {(isAuthor || canReview) && (q.status === 'DRAFT' || q.status === 'REJECTED') && (
                          <DropdownMenuItem
                            className="font-mono text-xs"
                            onClick={() => navigate(`/org/${slug}/questions/${q.id}/edit`)}
                          >
                            <Pencil className="h-3 w-3 mr-2" /> Edit
                          </DropdownMenuItem>
                        )}
                        {(isAuthor || canReview) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="font-mono text-xs text-destructive"
                              onClick={() => {
                                if (window.confirm('Delete this question?')) deleteMutation.mutate(q.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3 mr-2" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.lastPage > 1 && (
        <div className="flex items-center justify-center gap-2">
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

      {/* Clone Dialog */}
      <CloneQuestionDialog open={cloneOpen} onOpenChange={setCloneOpen} />
    </div>
  );
};

export default OrgQuestionBank;
