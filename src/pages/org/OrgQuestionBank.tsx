import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2, Send, CheckCircle2, XCircle,
  BookOpen, Copy, Loader2, ChevronLeft, ChevronRight, Upload, Download,
  FileText, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { useOrgStore } from '@/stores/org.store';
import { useAuthStore } from '@/stores/auth.store';
import {
  getOrgQuestions, submitOrgQuestion, approveOrgQuestion,
  rejectOrgQuestion, deleteOrgQuestion, createOrgQuestion,
} from '@/services/org-questions';
import { getCertifications } from '@/services/certifications';
import CloneQuestionDialog from '@/components/org/CloneQuestionDialog';
import type { OrgQuestionStatus, OrgQuestionFilters, CreateOrgQuestionPayload } from '@/types/org-question-types';

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

interface CsvRow {
  title: string;
  description?: string;
  difficulty: string;
  category?: string;
  tags?: string;
  explanation?: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct: string;
  _error?: string;
}

const CSV_TEMPLATE_HEADERS = 'title,description,difficulty,category,tags,explanation,choice_a,choice_b,choice_c,choice_d,correct';
const CSV_TEMPLATE_EXAMPLE = '"What does IAM stand for?","Identity and Access Management is a framework","MEDIUM","Security","iam,aws","IAM = Identity and Access Management","Identity and Access Management","Infrastructure and Access Management","Internet and Application Management","Independent Access Module","A"';

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

  // Reject modal state
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // CSV import state
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvProgress, setCsvProgress] = useState({ done: 0, total: 0, errors: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Separate query for review queue badge count
  const { data: reviewData } = useQuery({
    queryKey: ['org-questions', slug, { status: 'UNDER_REVIEW', page: 1, limit: 1 }],
    queryFn: () => getOrgQuestions(slug, { status: 'UNDER_REVIEW', page: 1, limit: 1 }),
    enabled: !!slug && canReview,
  });
  const reviewCount = reviewData?.meta?.total ?? 0;

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
    mutationFn: ({ qId, reason }: { qId: string; reason?: string }) =>
      rejectOrgQuestion(slug, qId, reason),
    onSuccess: () => {
      toast.success('Question rejected');
      queryClient.invalidateQueries({ queryKey: ['org-questions', slug] });
      setRejectTargetId(null);
      setRejectReason('');
    },
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

  const openRejectModal = (qId: string) => {
    setRejectTargetId(qId);
    setRejectReason('');
  };

  const handleRejectConfirm = () => {
    if (!rejectTargetId) return;
    rejectMutation.mutate({ qId: rejectTargetId, reason: rejectReason || undefined });
  };

  // CSV helpers
  const downloadTemplate = () => {
    const blob = new Blob(
      [`${CSV_TEMPLATE_HEADERS}\n${CSV_TEMPLATE_EXAMPLE}`],
      { type: 'text/csv' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'question_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validateCsvRow = (row: any, index: number): CsvRow => {
    const errors: string[] = [];
    if (!row.title?.trim()) errors.push('title required');
    if (!['EASY', 'MEDIUM', 'HARD'].includes((row.difficulty || '').toUpperCase())) errors.push('difficulty must be EASY/MEDIUM/HARD');
    if (!row.choice_a?.trim()) errors.push('choice_a required');
    if (!row.choice_b?.trim()) errors.push('choice_b required');
    if (!['A', 'B', 'C', 'D'].includes((row.correct || '').toUpperCase())) errors.push('correct must be A/B/C/D');
    return {
      ...row,
      difficulty: (row.difficulty || 'MEDIUM').toUpperCase(),
      correct: (row.correct || 'A').toUpperCase(),
      _error: errors.length ? `Row ${index + 2}: ${errors.join(', ')}` : undefined,
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validated = (results.data as any[]).map((row, i) => validateCsvRow(row, i));
        setCsvRows(validated);
      },
    });
  };

  const rowToPayload = (row: CsvRow): CreateOrgQuestionPayload => {
    const choiceMap: Record<string, string> = {
      A: row.choice_a,
      B: row.choice_b,
      C: row.choice_c || '',
      D: row.choice_d || '',
    };
    const choices = (['A', 'B', 'C', 'D'] as const)
      .filter((l) => choiceMap[l])
      .map((l) => ({ label: l, content: choiceMap[l], isCorrect: row.correct === l }));

    return {
      title: row.title.trim(),
      description: row.description?.trim() || undefined,
      difficulty: row.difficulty,
      category: row.category?.trim() || undefined,
      tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      explanation: row.explanation?.trim() || undefined,
      choices,
    };
  };

  const handleCsvImport = async () => {
    const validRows = csvRows.filter((r) => !r._error);
    if (!validRows.length) return;
    setCsvImporting(true);
    setCsvProgress({ done: 0, total: validRows.length, errors: 0 });
    let errors = 0;
    for (let i = 0; i < validRows.length; i++) {
      try {
        await createOrgQuestion(slug, rowToPayload(validRows[i]));
      } catch {
        errors++;
      }
      setCsvProgress({ done: i + 1, total: validRows.length, errors });
    }
    setCsvImporting(false);
    queryClient.invalidateQueries({ queryKey: ['org-questions', slug] });
    toast.success(`Imported ${validRows.length - errors} questions${errors ? `, ${errors} failed` : ''}`);
    if (!errors) {
      setCsvOpen(false);
      setCsvRows([]);
      setCsvFileName('');
    }
  };

  const validRowCount = csvRows.filter((r) => !r._error).length;
  const errorRowCount = csvRows.filter((r) => !!r._error).length;

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
          <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Import CSV
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
          <TabsTrigger value="UNDER_REVIEW" className="font-mono text-xs">
            Under Review
            {canReview && reviewCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-amber-500 text-black rounded-full font-bold leading-none">
                {reviewCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="APPROVED" className="font-mono text-xs">Approved</TabsTrigger>
          <TabsTrigger value="REJECTED" className="font-mono text-xs">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Review Queue Banner */}
      {statusFilter === 'UNDER_REVIEW' && canReview && reviewCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-mono">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {reviewCount} question{reviewCount !== 1 ? 's' : ''} awaiting your review
        </div>
      )}

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
            const showInlineReview = canReview && q.status === 'UNDER_REVIEW';
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
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Inline approve/reject for review queue */}
                      {showInlineReview && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-mono"
                            onClick={() => approveMutation.mutate(q.id)}
                            disabled={approveMutation.isPending}
                          >
                            {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10 font-mono"
                            onClick={() => openRejectModal(q.id)}
                          >
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border">
                          {isAuthor && q.status === 'DRAFT' && (
                            <DropdownMenuItem className="font-mono text-xs" onClick={() => submitMutation.mutate(q.id)}>
                              <Send className="h-3 w-3 mr-2" /> Submit for Review
                            </DropdownMenuItem>
                          )}
                          {!showInlineReview && canReview && q.status === 'UNDER_REVIEW' && (
                            <>
                              <DropdownMenuItem className="font-mono text-xs" onClick={() => approveMutation.mutate(q.id)}>
                                <CheckCircle2 className="h-3 w-3 mr-2" /> Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem className="font-mono text-xs" onClick={() => openRejectModal(q.id)}>
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

      {/* Reject Reason Modal */}
      <Dialog open={!!rejectTargetId} onOpenChange={(open) => { if (!open) { setRejectTargetId(null); setRejectReason(''); } }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">Reject Question</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground font-mono">
              Optionally provide a reason so the author can improve the question.
            </p>
            <Textarea
              placeholder="e.g. The answer choices are ambiguous..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="bg-muted border-border font-mono text-sm resize-none"
              rows={4}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setRejectTargetId(null); setRejectReason(''); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Modal */}
      <Dialog open={csvOpen} onOpenChange={(open) => { if (!open && !csvImporting) { setCsvOpen(false); setCsvRows([]); setCsvFileName(''); } }}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono flex items-center gap-2">
              <Upload className="h-4 w-4" /> Import Questions from CSV
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Template download */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                <FileText className="h-4 w-4" />
                Need a template?
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Download Template
              </Button>
            </div>

            {/* File drop zone */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) {
                  setCsvFileName(file.name);
                  Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                      const validated = (results.data as any[]).map((row, i) => validateCsvRow(row, i));
                      setCsvRows(validated);
                    },
                  });
                }
              }}
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              {csvFileName ? (
                <p className="text-sm font-mono text-primary">{csvFileName}</p>
              ) : (
                <p className="text-sm text-muted-foreground font-mono">
                  Drop a CSV file here or click to browse
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Preview table */}
            {csvRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">{csvRows.length} row{csvRows.length !== 1 ? 's' : ''} parsed</span>
                  <div className="flex gap-3">
                    {validRowCount > 0 && <span className="text-emerald-400">{validRowCount} valid</span>}
                    {errorRowCount > 0 && <span className="text-red-400">{errorRowCount} error{errorRowCount !== 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 text-muted-foreground font-medium">#</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Title</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Difficulty</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Correct</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, i) => (
                        <tr key={i} className={row._error ? 'bg-red-500/5' : 'hover:bg-muted/30'}>
                          <td className="p-2 text-muted-foreground">{i + 1}</td>
                          <td className="p-2 max-w-[200px] truncate">{row.title || '—'}</td>
                          <td className="p-2">{row.difficulty || '—'}</td>
                          <td className="p-2">{row.correct || '—'}</td>
                          <td className="p-2">
                            {row._error ? (
                              <span className="text-red-400 text-[10px]">{row._error}</span>
                            ) : (
                              <span className="text-emerald-400">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Import progress */}
            {csvImporting && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span>Importing...</span>
                  <span>{csvProgress.done} / {csvProgress.total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${(csvProgress.done / csvProgress.total) * 100}%` }}
                  />
                </div>
                {csvProgress.errors > 0 && (
                  <p className="text-xs text-red-400 font-mono">{csvProgress.errors} failed</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setCsvOpen(false); setCsvRows([]); setCsvFileName(''); }}
              disabled={csvImporting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="glow-cyan"
              onClick={handleCsvImport}
              disabled={validRowCount === 0 || csvImporting}
            >
              {csvImporting
                ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                : <Upload className="h-4 w-4 mr-1" />}
              Import {validRowCount > 0 ? `${validRowCount} Question${validRowCount !== 1 ? 's' : ''}` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrgQuestionBank;
