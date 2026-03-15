import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQuestionById, voteQuestion } from '@/services/questions';
import { getComments, createComment, deleteComment, Comment } from '@/services/comments';
import { reportQuestion, ReportReason } from '@/services/reports';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Brain, ChevronLeft, ThumbsUp, ThumbsDown, MessageSquare, Flag, Trash2, Reply, Loader2, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'WRONG_ANSWER', label: 'Wrong answer' },
  { value: 'OUTDATED', label: 'Outdated content' },
  { value: 'DUPLICATE', label: 'Duplicate question' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate content' },
];

const QuestionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();

  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('WRONG_ANSWER');
  const [reportDesc, setReportDesc] = useState('');

  const { data: question, isLoading } = useQuery({
    queryKey: ['question', id],
    queryFn: () => getQuestionById(id!),
    enabled: !!id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => getComments(id!),
    enabled: !!id,
  });

  const voteMutation = useMutation({
    mutationFn: ({ value }: { value: number }) => voteQuestion(id!, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['question', id] }),
    onError: () => toast.error('Đăng nhập để vote'),
  });

  const commentMutation = useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId?: string }) =>
      createComment(id!, content, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      setCommentText('');
      setReplyTo(null);
      setReplyText('');
    },
    onError: () => toast.error('Đăng nhập để bình luận'),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', id] }),
  });

  const reportMutation = useMutation({
    mutationFn: () => reportQuestion(id!, reportReason, reportDesc || undefined),
    onSuccess: () => {
      toast.success('Báo cáo đã được gửi');
      setReportOpen(false);
      setReportDesc('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Không thể gửi báo cáo'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        Question not found
      </div>
    );
  }

  const q = question as any;
  const userVote: number | null = q.userVote ?? null;

  const handleVote = (value: number) => {
    if (!isAuthenticated) { toast.error('Đăng nhập để vote'); return; }
    voteMutation.mutate({ value: userVote === value ? 0 : value });
  };

  const handleComment = () => {
    if (!commentText.trim()) return;
    commentMutation.mutate({ content: commentText.trim() });
  };

  const handleReply = (parentId: string) => {
    if (!replyText.trim()) return;
    commentMutation.mutate({ content: replyText.trim(), parentId });
  };

  const renderComment = (c: Comment, isReply = false) => (
    <div key={c.id} className={`${isReply ? 'ml-8 border-l border-border pl-4' : ''}`}>
      <div className="flex items-start gap-3 py-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-mono text-primary shrink-0">
          {c.user.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{c.user.displayName}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(c.createdAt).toLocaleDateString('vi-VN')}
            </span>
          </div>
          <p className="text-sm text-foreground/90">{c.content}</p>
          <div className="flex items-center gap-3 mt-2">
            {!isReply && isAuthenticated && (
              <button
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
              >
                <Reply className="h-3 w-3" /> Reply
              </button>
            )}
            {(user?.id === c.user.id || user?.role === 'ADMIN') && (
              <button
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                onClick={() => deleteCommentMutation.mutate(c.id)}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            )}
          </div>
          {/* Reply input */}
          {replyTo === c.id && (
            <div className="flex gap-2 mt-3">
              <Textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="min-h-[60px] text-sm bg-secondary/50 border-border"
              />
              <Button size="sm" onClick={() => handleReply(c.id)} disabled={commentMutation.isPending}>
                <Send className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
      {/* Replies */}
      {c.replies?.map(r => renderComment(r, true))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <Brain className="h-6 w-6 text-primary" />
            <span className="font-mono text-lg font-bold text-gradient-cyan">CertGym</span>
          </div>
        </div>
      </nav>

      <div className="container max-w-4xl pt-24 pb-16">
        <Button variant="ghost" className="mb-6 text-muted-foreground" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Question Card */}
          <div className="glass-card p-6 mb-6">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                q.difficulty === 'EASY' ? 'bg-accent/10 text-accent' :
                q.difficulty === 'MEDIUM' ? 'bg-warning/10 text-warning' :
                'bg-destructive/10 text-destructive'
              }`}>{q.difficulty}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
                {q.questionType}
              </span>
              {q.certification && (
                <span className="text-xs text-muted-foreground font-mono">{q.certification.code}</span>
              )}
              {q.domain && (
                <span className="text-xs text-muted-foreground">· {q.domain.name}</span>
              )}
            </div>

            {/* Title & Description */}
            <h1 className="text-xl font-medium mb-2">{q.title}</h1>
            {q.description && <p className="text-sm text-muted-foreground mb-4">{q.description}</p>}

            {/* Code Snippet */}
            {q.codeSnippet && (
              <pre className="p-4 rounded-lg bg-secondary/80 text-sm font-mono overflow-x-auto mb-4">{q.codeSnippet}</pre>
            )}

            {/* Choices */}
            <div className="space-y-2 mb-6">
              {q.choices?.map((c: any) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-lg border flex gap-3 ${
                    c.isCorrect ? 'border-accent/50 bg-accent/10' : 'border-border bg-secondary/50'
                  }`}
                >
                  <span className="font-mono text-muted-foreground uppercase font-semibold">{c.label}.</span>
                  <span className="flex-1">{c.content}</span>
                  {c.isCorrect && <span className="text-accent text-sm">✓</span>}
                </div>
              ))}
            </div>

            {/* Explanation */}
            {q.explanation && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm mb-6">
                <strong className="text-primary block mb-1">Explanation</strong>
                {q.explanation}
              </div>
            )}

            {q.referenceUrl && (
              <a href={q.referenceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                📎 Reference
              </a>
            )}

            {/* Tags */}
            {q.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {q.tags.map((t: any) => (
                  <span key={t.tagId || t.tag?.id} className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                    {t.tag?.name || t.name}
                  </span>
                ))}
              </div>
            )}

            {/* Author */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
              <span>by {q.author?.displayName}</span>
              <span>· {new Date(q.createdAt).toLocaleDateString('vi-VN')}</span>
            </div>
          </div>

          {/* Actions Bar: Vote + Report */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-1 glass-card px-3 py-2">
              <button
                onClick={() => handleVote(1)}
                className={`p-1.5 rounded hover:bg-accent/10 transition-colors ${userVote === 1 ? 'text-accent' : 'text-muted-foreground'}`}
              >
                <ThumbsUp className="h-4 w-4" />
              </button>
              <span className="text-sm font-mono min-w-[2rem] text-center">
                {(q.upvotes || 0) - (q.downvotes || 0)}
              </span>
              <button
                onClick={() => handleVote(-1)}
                className={`p-1.5 rounded hover:bg-destructive/10 transition-colors ${userVote === -1 ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                <ThumbsDown className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span>{q._count?.comments ?? comments.length}</span>
            </div>

            {isAuthenticated && (
              <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive transition-colors">
                    <Flag className="h-4 w-4" /> Report
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-mono">Report Question</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Select value={reportReason} onValueChange={v => setReportReason(v as ReportReason)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REPORT_REASONS.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={reportDesc}
                      onChange={e => setReportDesc(e.target.value)}
                      placeholder="Additional details (optional)"
                      className="min-h-[80px]"
                    />
                    <Button
                      className="w-full"
                      variant="destructive"
                      onClick={() => reportMutation.mutate()}
                      disabled={reportMutation.isPending}
                    >
                      {reportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Submit Report
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Comments Section */}
          <div className="glass-card p-6">
            <h3 className="font-mono font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Discussion ({comments.length})
            </h3>

            {/* New comment form */}
            {isAuthenticated ? (
              <div className="flex gap-2 mb-6">
                <Textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="min-h-[60px] bg-secondary/50 border-border"
                />
                <Button onClick={handleComment} disabled={commentMutation.isPending || !commentText.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-6">
                <button className="text-primary hover:underline" onClick={() => navigate('/auth')}>Đăng nhập</button> để bình luận.
              </p>
            )}

            {/* Comments list */}
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Chưa có bình luận nào.</p>
            ) : (
              <div className="divide-y divide-border">
                {comments.map(c => renderComment(c))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default QuestionDetail;
