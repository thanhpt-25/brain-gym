import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '@/stores/org.store';
import { useAuthStore } from '@/stores/auth.store';
import {
  getOrgQuestion, submitOrgQuestion, approveOrgQuestion,
  rejectOrgQuestion, deleteOrgQuestion,
} from '@/services/org-questions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, Loader2, Send, CheckCircle2, XCircle,
  Pencil, Trash2, BookOpen, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import type { OrgQuestionStatus } from '@/types/org-question-types';

const statusColors: Record<OrgQuestionStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  UNDER_REVIEW: 'bg-amber-500/20 text-amber-400',
  APPROVED: 'bg-emerald-500/20 text-emerald-400',
  REJECTED: 'bg-red-500/20 text-red-400',
};

const difficultyColors: Record<string, string> = {
  EASY: 'bg-emerald-500/20 text-emerald-400',
  MEDIUM: 'bg-amber-500/20 text-amber-400',
  HARD: 'bg-red-500/20 text-red-400',
};

const OrgQuestionDetail = () => {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const user = useAuthStore((s) => s.user);
  const slug = currentOrg?.slug || '';
  const myRole = currentOrg?.myRole;
  const canReview = myRole === 'OWNER' || myRole === 'ADMIN';

  const { data: question, isLoading } = useQuery({
    queryKey: ['org-question', slug, questionId],
    queryFn: () => getOrgQuestion(slug, questionId!),
    enabled: !!slug && !!questionId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['org-question', slug, questionId] });
    queryClient.invalidateQueries({ queryKey: ['org-questions', slug] });
  };

  const submitMutation = useMutation({
    mutationFn: () => submitOrgQuestion(slug, questionId!),
    onSuccess: () => { toast.success('Submitted for review'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveOrgQuestion(slug, questionId!),
    onSuccess: () => { toast.success('Question approved'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectOrgQuestion(slug, questionId!),
    onSuccess: () => { toast.success('Question rejected'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteOrgQuestion(slug, questionId!),
    onSuccess: () => {
      toast.success('Question deleted');
      queryClient.invalidateQueries({ queryKey: ['org-questions', slug] });
      navigate(`/org/${slug}/questions`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="text-center py-12 text-muted-foreground font-mono">
        Question not found
      </div>
    );
  }

  const isAuthor = question.createdBy === user?.id;
  const canEdit = (isAuthor || canReview) && (question.status === 'DRAFT' || question.status === 'REJECTED');
  const canSubmit = isAuthor && question.status === 'DRAFT';
  const canApproveReject = canReview && question.status === 'UNDER_REVIEW';
  const canDelete = isAuthor || canReview;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${slug}/questions`)}>
        <ChevronLeft className="h-4 w-4 mr-1" /> Back to Questions
      </Button>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Question Card */}
        <div className="glass-card p-6 mb-6">
          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge className={`text-xs border-0 ${statusColors[question.status]}`}>
              {question.status.replace('_', ' ')}
            </Badge>
            <Badge className={`text-xs border-0 ${difficultyColors[question.difficulty] || ''}`}>
              {question.difficulty}
            </Badge>
            <Badge variant="outline" className="text-xs">{question.questionType}</Badge>
            {question.category && (
              <Badge variant="outline" className="text-xs">{question.category}</Badge>
            )}
            {question.isScenario && (
              <Badge variant="outline" className="text-xs text-accent border-accent/30">
                <BookOpen className="h-3 w-3 mr-1" /> Scenario
              </Badge>
            )}
            {question.isTrapQuestion && (
              <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                <AlertTriangle className="h-3 w-3 mr-1" /> Trap
              </Badge>
            )}
            <span className="text-xs text-muted-foreground font-mono ml-auto">v{question.version}</span>
          </div>

          {/* Title */}
          <h1 className="text-xl font-medium mb-4">{question.title}</h1>

          {/* Description / Scenario */}
          {question.isScenario && question.description ? (
            <div className="p-5 rounded-xl bg-accent/5 border border-accent/20 mb-6 relative overflow-hidden">
              <div className="flex items-center gap-2 text-accent font-mono text-[10px] uppercase tracking-widest mb-3">
                <BookOpen className="h-3 w-3" /> Technical Scenario
              </div>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {question.description}
              </p>
            </div>
          ) : (
            question.description && (
              <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap">{question.description}</p>
            )
          )}

          {/* Code Snippet */}
          {question.codeSnippet && (
            <pre className="p-4 rounded-lg bg-secondary/80 text-sm font-mono overflow-x-auto mb-4">
              {question.codeSnippet}
            </pre>
          )}

          {/* Choices */}
          <div className="space-y-2 mb-6">
            {question.choices
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((c) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-lg border flex gap-3 ${
                    c.isCorrect ? 'border-accent/50 bg-accent/10' : 'border-border bg-secondary/50'
                  }`}
                >
                  <span className="font-mono text-muted-foreground uppercase font-semibold">{c.label}.</span>
                  <span className="flex-1">{c.content}</span>
                  {c.isCorrect && <span className="text-accent text-sm">correct</span>}
                </div>
              ))}
          </div>

          {/* Explanation */}
          {question.explanation && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm mb-6">
              <strong className="text-primary block mb-1">Explanation</strong>
              <p className="whitespace-pre-wrap">{question.explanation}</p>
            </div>
          )}

          {/* Reference URL */}
          {question.referenceUrl && (
            <a
              href={question.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-4"
            >
              <ExternalLink className="h-3 w-3" /> Reference
            </a>
          )}

          {/* Tags */}
          {question.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {question.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs font-mono">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Author & date */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
            {question.author && <span>by {question.author.displayName}</span>}
            <span>· {new Date(question.createdAt).toLocaleDateString('en-US')}</span>
            {question.sourceQuestionId && (
              <Badge variant="outline" className="text-[10px] ml-auto">Cloned</Badge>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {canSubmit && (
            <Button
              size="sm"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              <Send className="h-4 w-4 mr-1.5" /> Submit for Review
            </Button>
          )}
          {canApproveReject && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-1.5" /> Reject
              </Button>
            </>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/org/${slug}/questions/${questionId}/edit`)}
            >
              <Pencil className="h-4 w-4 mr-1.5" /> Edit
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
              onClick={() => {
                if (window.confirm('Delete this question?')) deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default OrgQuestionDetail;
