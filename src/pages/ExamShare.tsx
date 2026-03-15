import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getExamByShareCode } from '@/services/exams';
import { startAttempt } from '@/services/attempts';
import { Button } from '@/components/ui/button';
import { Brain, Clock, FileText, Loader2, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { useState } from 'react';

const ExamShare = () => {
  const { shareCode } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [starting, setStarting] = useState(false);

  const { data: exam, isLoading, error } = useQuery({
    queryKey: ['exam-share', shareCode],
    queryFn: () => getExamByShareCode(shareCode!),
    enabled: !!shareCode,
  });

  const handleStart = async () => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: `/exams/share/${shareCode}` } });
      return;
    }
    if (!exam) return;
    setStarting(true);
    try {
      const attempt = await startAttempt(exam.id);
      navigate(`/exam/${attempt.certification.id}`, { state: { attemptData: attempt } });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to start exam');
    } finally {
      setStarting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-mono font-bold mb-2">Exam not found</h2>
          <p className="text-muted-foreground mb-4">This share link may be invalid or expired.</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grid">
      <div className="container max-w-lg py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 text-center">
          <Brain className="h-10 w-10 text-primary mx-auto mb-4" />
          <div className="text-xs font-mono text-muted-foreground mb-1">{exam.certification?.name}</div>
          <h1 className="text-2xl font-mono font-bold mb-2">{exam.title}</h1>
          {exam.description && <p className="text-sm text-muted-foreground mb-6">{exam.description}</p>}

          <div className="flex justify-center gap-6 mb-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><FileText className="h-4 w-4" /> {exam.questionCount} questions</span>
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {exam.timeLimit} min</span>
          </div>

          <Button className="w-full glow-cyan font-mono" size="lg" onClick={handleStart} disabled={starting}>
            {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {isAuthenticated ? 'Start Exam' : 'Login to Start'}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default ExamShare;
