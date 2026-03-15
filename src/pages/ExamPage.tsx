import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCertificationById } from '@/services/certifications';
import { getQuestions } from '@/services/questions';
import { startAttempt, submitAttempt, StartAttemptResponse, AttemptResult, AttemptQuestion } from '@/services/attempts';
import { createExam } from '@/services/exams';
import { Button } from '@/components/ui/button';
import { Clock, Flag, ChevronLeft, ChevronRight, Brain, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

type ExamPhase = 'intro' | 'loading' | 'exam' | 'result';

const ExamPage = () => {
  const { certId } = useParams();
  const navigate = useNavigate();

  const { data: cert, isLoading: certLoading } = useQuery({
    queryKey: ['certification', certId],
    queryFn: () => getCertificationById(certId!),
    enabled: !!certId,
  });

  const { data: questionsData } = useQuery({
    queryKey: ['questions-count', certId],
    queryFn: () => getQuestions(certId, 1, 1),
    enabled: !!certId,
  });

  const [phase, setPhase] = useState<ExamPhase>('intro');
  const [attemptData, setAttemptData] = useState<StartAttemptResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<AttemptResult | null>(null);

  const questions: AttemptQuestion[] = attemptData?.questions ?? [];
  const currentQuestion = questions[currentIndex];
  const questionCount = questionsData?.meta?.total ?? 0;

  // Timer
  useEffect(() => {
    if (phase !== 'exam') return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const startExam = async () => {
    if (!cert) return;
    setPhase('loading');
    try {
      // Create an exam from available questions, then start attempt
      const exam = await createExam({
        title: `${cert.code} Practice Exam`,
        certificationId: cert.id,
        questionCount: Math.min(questionCount, 65),
        timeLimit: 130,
      });

      const attempt = await startAttempt(exam.id);
      setAttemptData(attempt);
      setTimeLeft(attempt.timeLimit * 60);
      setAnswers({});
      setMarked(new Set());
      setCurrentIndex(0);
      setResult(null);
      setPhase('exam');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to start exam');
      setPhase('intro');
    }
  };

  const selectAnswer = (questionId: string, choiceId: string) => {
    setAnswers(prev => {
      const current = prev[questionId] || [];
      const question = questions.find(q => q.id === questionId);
      const isMultiple = question?.questionType === 'MULTIPLE';
      if (isMultiple) {
        return {
          ...prev,
          [questionId]: current.includes(choiceId)
            ? current.filter(id => id !== choiceId)
            : [...current, choiceId],
        };
      }
      return { ...prev, [questionId]: [choiceId] };
    });
  };

  const toggleMark = (questionId: string) => {
    setMarked(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleSubmit = useCallback(async () => {
    if (!attemptData) return;
    setPhase('loading');
    try {
      const payload = {
        answers: questions.map(q => ({
          questionId: q.id,
          selectedChoices: answers[q.id] || [],
          isMarked: marked.has(q.id),
        })),
      };
      const res = await submitAttempt(attemptData.attemptId, payload);
      setResult(res);
      setPhase('result');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit exam');
      setPhase('exam');
    }
  }, [attemptData, answers, questions, marked]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (certLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cert) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Certification not found</div>;

  // LOADING
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-background bg-grid flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-mono">Preparing your exam...</p>
        </div>
      </div>
    );
  }

  // INTRO
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-background bg-grid">
        <div className="container max-w-2xl py-20">
          <Button variant="ghost" className="mb-8 text-muted-foreground" onClick={() => navigate('/')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
            <div className="text-sm font-mono text-muted-foreground mb-1">{cert.provider} · {cert.code}</div>
            <h1 className="text-2xl font-mono font-bold mb-2">{cert.name}</h1>
            <p className="text-muted-foreground mb-6">{cert.description}</p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 rounded-lg bg-secondary">
                <div className="text-xl font-mono font-bold text-foreground">{questionCount}</div>
                <div className="text-xs text-muted-foreground">Questions</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary">
                <div className="text-xl font-mono font-bold text-foreground">130m</div>
                <div className="text-xs text-muted-foreground">Time Limit</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary">
                <div className="text-xl font-mono font-bold text-foreground">70%</div>
                <div className="text-xs text-muted-foreground">Pass Score</div>
              </div>
            </div>

            {cert.domains && cert.domains.length > 0 && (
              <div className="mb-6">
                <div className="text-sm font-mono font-semibold mb-2">Domains</div>
                <div className="flex flex-wrap gap-2">
                  {cert.domains.map((d: any) => (
                    <span key={d.id} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">{d.name}</span>
                  ))}
                </div>
              </div>
            )}

            {questionCount === 0 ? (
              <p className="text-sm text-destructive font-mono text-center py-4">No approved questions available for this certification yet.</p>
            ) : (
              <Button className="w-full glow-cyan font-mono" size="lg" onClick={startExam}>
                <Brain className="h-4 w-4 mr-2" /> Start Exam
              </Button>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // RESULT
  if (phase === 'result' && result) {
    const passed = result.percentage >= 70;
    return (
      <div className="min-h-screen bg-background bg-grid">
        <div className="container max-w-3xl py-12">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            {/* Score */}
            <div className={`glass-card p-8 text-center mb-6 ${passed ? 'glow-green' : ''}`}>
              <div className={`text-6xl font-mono font-bold mb-2 ${passed ? 'text-gradient-cyan' : 'text-gradient-warm'}`}>
                {result.percentage}%
              </div>
              <div className={`text-lg font-mono font-semibold mb-1 ${passed ? 'text-accent' : 'text-destructive'}`}>
                {passed ? '✅ PASSED' : '❌ NOT PASSED'}
              </div>
              <div className="text-sm text-muted-foreground">
                {result.totalCorrect}/{result.totalQuestions} correct · {formatTime(result.timeSpent)}
              </div>
            </div>

            {/* Domain Breakdown */}
            {result.domainScores && (
              <div className="glass-card p-6 mb-6">
                <h3 className="font-mono font-semibold mb-4">Domain Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(result.domainScores).map(([domain, data]) => {
                    const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                    return (
                      <div key={domain}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-foreground">{domain}</span>
                          <span className={`font-mono ${pct >= 70 ? 'text-accent' : 'text-destructive'}`}>{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 70 ? 'bg-accent' : 'bg-destructive'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Question Review */}
            <div className="glass-card p-6 mb-6">
              <h3 className="font-mono font-semibold mb-4">Question Review</h3>
              <div className="space-y-4">
                {result.questionResults.map((qr, i) => (
                  <div key={qr.questionId} className={`p-4 rounded-lg border ${qr.correct ? 'border-accent/30 bg-accent/5' : 'border-destructive/30 bg-destructive/5'}`}>
                    <div className="flex items-start gap-3">
                      {qr.correct ? (
                        <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="text-sm font-medium mb-2">
                          <span className="text-muted-foreground mr-2">Q{i + 1}.</span>
                          {qr.title}
                        </div>
                        <div className="space-y-1">
                          {qr.choices.map(c => {
                            const isSelected = qr.selectedAnswers.includes(c.id);
                            const isCorrect = qr.correctAnswers.includes(c.id);
                            return (
                              <div
                                key={c.id}
                                className={`text-xs px-3 py-1.5 rounded ${isCorrect ? 'bg-accent/10 text-accent' :
                                  isSelected ? 'bg-destructive/10 text-destructive' :
                                    'text-muted-foreground'
                                  }`}
                              >
                                {c.label.toUpperCase()}. {c.content}
                                {isCorrect && ' ✓'}
                                {isSelected && !isCorrect && ' ✗'}
                              </div>
                            );
                          })}
                        </div>
                        {qr.explanation && (
                          <p className="text-xs text-muted-foreground mt-2 italic">{qr.explanation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1 font-mono" onClick={() => navigate('/')}>Back Home</Button>
              <Button className="flex-1 glow-cyan font-mono" onClick={() => { setPhase('intro'); setResult(null); }}>Retry Exam</Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // EXAM
  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-muted-foreground">{attemptData?.certification?.code}</span>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm font-mono text-foreground">Q{currentIndex + 1}/{questions.length}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 font-mono text-sm ${timeLeft < 300 ? 'text-destructive animate-pulse-glow' : 'text-foreground'}`}>
              <Clock className="h-4 w-4" />
              {formatTime(timeLeft)}
            </div>
            <Button size="sm" variant="destructive" onClick={handleSubmit} className="font-mono">
              Submit
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 container py-6 flex gap-6">
        {/* Question */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${currentQuestion.difficulty === 'EASY' ? 'bg-accent/10 text-accent' :
                      currentQuestion.difficulty === 'MEDIUM' ? 'bg-warning/10 text-warning' :
                        'bg-destructive/10 text-destructive'
                      }`}>{currentQuestion.difficulty}</span>
                    <span className="text-xs text-muted-foreground">{currentQuestion.domain?.name || 'Unknown'}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMark(currentQuestion.id)}
                    className={marked.has(currentQuestion.id) ? 'text-warning' : 'text-muted-foreground'}
                  >
                    <Flag className="h-4 w-4" />
                  </Button>
                </div>

                <h2 className="text-lg font-medium mb-2">{currentQuestion.title}</h2>
                {currentQuestion.description && (
                  <p className="text-sm text-muted-foreground mb-4">{currentQuestion.description}</p>
                )}

                <div className="space-y-3 mt-6">
                  {currentQuestion.choices.map(choice => {
                    const isSelected = (answers[currentQuestion.id] || []).includes(choice.id);
                    return (
                      <button
                        key={choice.id}
                        onClick={() => selectAnswer(currentQuestion.id, choice.id)}
                        className={`w-full text-left p-4 rounded-lg border transition-all text-sm ${isSelected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-secondary/50 text-foreground hover:border-primary/30'
                          }`}
                      >
                        <span className="font-mono font-semibold mr-3 text-muted-foreground">{choice.label.toUpperCase()}</span>
                        {choice.content}
                      </button>
                    );
                  })}
                </div>

                {currentQuestion.tags && currentQuestion.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-6">
                    {currentQuestion.tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(i => i - 1)}
                  className="font-mono"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <Button
                  variant="outline"
                  disabled={currentIndex === questions.length - 1}
                  onClick={() => setCurrentIndex(i => i + 1)}
                  className="font-mono"
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Question Navigator */}
        <div className="hidden lg:block w-56 shrink-0">
          <div className="glass-card p-4 sticky top-20">
            <div className="text-sm font-mono font-semibold mb-3">Questions</div>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, i) => {
                const isAnswered = !!answers[q.id]?.length;
                const isMarked = marked.has(q.id);
                const isCurrent = i === currentIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(i)}
                    className={`w-8 h-8 rounded text-xs font-mono font-semibold transition-all ${isCurrent ? 'bg-primary text-primary-foreground' :
                      isMarked ? 'bg-warning/20 text-warning border border-warning/30' :
                        isAnswered ? 'bg-accent/20 text-accent' :
                          'bg-secondary text-muted-foreground hover:bg-secondary/80'
                      }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-accent/20" /> Answered</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-warning/20 border border-warning/30" /> Flagged</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-secondary" /> Unanswered</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamPage;
