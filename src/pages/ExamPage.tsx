import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sampleQuestions, certifications } from '@/data/mockData';
import { ExamResult, Question } from '@/types/exam';
import { Button } from '@/components/ui/button';
import { Clock, Flag, ChevronLeft, ChevronRight, Brain, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ExamPhase = 'intro' | 'exam' | 'result';

const ExamPage = () => {
  const { certId } = useParams();
  const navigate = useNavigate();
  const cert = certifications.find(c => c.id === certId);
  const questions = useMemo(() => sampleQuestions.filter(q => q.certificationId === certId), [certId]);

  const [phase, setPhase] = useState<ExamPhase>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const currentQuestion = questions[currentIndex];

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

  const startExam = () => {
    setPhase('exam');
    setTimeLeft((cert?.timeMinutes || 10) * 60);
    setStartTime(Date.now());
    setAnswers({});
    setMarked(new Set());
    setCurrentIndex(0);
    setResult(null);
  };

  const selectAnswer = (questionId: string, choiceId: string) => {
    setAnswers(prev => {
      const current = prev[questionId] || [];
      const question = questions.find(q => q.id === questionId);
      if (question && question.correctAnswers.length > 1) {
        // Multiple correct answers
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

  const handleSubmit = useCallback(() => {
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    const domainBreakdown: Record<string, { correct: number; total: number }> = {};
    const questionResults: ExamResult['questionResults'] = [];
    let correct = 0;

    questions.forEach(q => {
      const selected = answers[q.id] || [];
      const isCorrect = q.correctAnswers.length === selected.length &&
        q.correctAnswers.every(a => selected.includes(a));
      if (isCorrect) correct++;

      if (!domainBreakdown[q.domain]) domainBreakdown[q.domain] = { correct: 0, total: 0 };
      domainBreakdown[q.domain].total++;
      if (isCorrect) domainBreakdown[q.domain].correct++;

      questionResults.push({
        questionId: q.id,
        correct: isCorrect,
        selectedAnswers: selected,
        correctAnswers: q.correctAnswers,
      });
    });

    const percentage = Math.round((correct / questions.length) * 100);
    setResult({
      score: correct,
      total: questions.length,
      percentage,
      passed: percentage >= (cert?.passingScore || 70),
      domainBreakdown,
      questionResults,
      timeTaken,
    });
    setPhase('result');
  }, [answers, questions, startTime, cert]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!cert) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Certification not found</div>;

  // INTRO
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-background bg-grid">
        <div className="container max-w-2xl py-20">
          <Button variant="ghost" className="mb-8 text-muted-foreground" onClick={() => navigate('/')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
            <div className="text-4xl mb-4">{cert.icon}</div>
            <div className="text-sm font-mono text-muted-foreground mb-1">{cert.provider} · {cert.code}</div>
            <h1 className="text-2xl font-mono font-bold mb-2">{cert.name}</h1>
            <p className="text-muted-foreground mb-6">{cert.description}</p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 rounded-lg bg-secondary">
                <div className="text-xl font-mono font-bold text-foreground">{questions.length}</div>
                <div className="text-xs text-muted-foreground">Questions</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary">
                <div className="text-xl font-mono font-bold text-foreground">{cert.timeMinutes}m</div>
                <div className="text-xs text-muted-foreground">Time Limit</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary">
                <div className="text-xl font-mono font-bold text-foreground">{cert.passingScore}%</div>
                <div className="text-xs text-muted-foreground">Pass Score</div>
              </div>
            </div>

            <div className="mb-6">
              <div className="text-sm font-mono font-semibold mb-2">Domains</div>
              <div className="flex flex-wrap gap-2">
                {cert.domains.map(d => (
                  <span key={d} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">{d}</span>
                ))}
              </div>
            </div>

            <Button className="w-full glow-cyan font-mono" size="lg" onClick={startExam}>
              <Brain className="h-4 w-4 mr-2" /> Start Exam
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  // RESULT
  if (phase === 'result' && result) {
    return (
      <div className="min-h-screen bg-background bg-grid">
        <div className="container max-w-3xl py-12">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            {/* Score */}
            <div className={`glass-card p-8 text-center mb-6 ${result.passed ? 'glow-green' : ''}`}>
              <div className={`text-6xl font-mono font-bold mb-2 ${result.passed ? 'text-gradient-cyan' : 'text-gradient-warm'}`}>
                {result.percentage}%
              </div>
              <div className={`text-lg font-mono font-semibold mb-1 ${result.passed ? 'text-accent' : 'text-destructive'}`}>
                {result.passed ? '✅ PASSED' : '❌ NOT PASSED'}
              </div>
              <div className="text-sm text-muted-foreground">
                {result.score}/{result.total} correct · {formatTime(result.timeTaken)}
              </div>
            </div>

            {/* Domain Breakdown */}
            <div className="glass-card p-6 mb-6">
              <h3 className="font-mono font-semibold mb-4">Domain Breakdown</h3>
              <div className="space-y-3">
                {Object.entries(result.domainBreakdown).map(([domain, data]) => {
                  const pct = Math.round((data.correct / data.total) * 100);
                  return (
                    <div key={domain}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-foreground">{domain}</span>
                        <span className={`font-mono ${pct >= (cert?.passingScore || 70) ? 'text-accent' : 'text-destructive'}`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct >= (cert?.passingScore || 70) ? 'bg-accent' : 'bg-destructive'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Question Review */}
            <div className="glass-card p-6 mb-6">
              <h3 className="font-mono font-semibold mb-4">Question Review</h3>
              <div className="space-y-4">
                {questions.map((q, i) => {
                  const qr = result.questionResults.find(r => r.questionId === q.id)!;
                  return (
                    <div key={q.id} className={`p-4 rounded-lg border ${qr.correct ? 'border-accent/30 bg-accent/5' : 'border-destructive/30 bg-destructive/5'}`}>
                      <div className="flex items-start gap-3">
                        {qr.correct ? (
                          <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="text-sm font-medium mb-2">
                            <span className="text-muted-foreground mr-2">Q{i + 1}.</span>
                            {q.title}
                          </div>
                          <div className="space-y-1">
                            {q.choices.map(c => {
                              const isSelected = qr.selectedAnswers.includes(c.id);
                              const isCorrect = qr.correctAnswers.includes(c.id);
                              return (
                                <div
                                  key={c.id}
                                  className={`text-xs px-3 py-1.5 rounded ${
                                    isCorrect ? 'bg-accent/10 text-accent' :
                                    isSelected ? 'bg-destructive/10 text-destructive' :
                                    'text-muted-foreground'
                                  }`}
                                >
                                  {c.id.toUpperCase()}. {c.text}
                                  {isCorrect && ' ✓'}
                                  {isSelected && !isCorrect && ' ✗'}
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 italic">{q.explanation}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1 font-mono" onClick={() => navigate('/')}>Back Home</Button>
              <Button className="flex-1 glow-cyan font-mono" onClick={startExam}>Retry Exam</Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // EXAM
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-muted-foreground">{cert.code}</span>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                      currentQuestion.difficulty === 'easy' ? 'bg-accent/10 text-accent' :
                      currentQuestion.difficulty === 'medium' ? 'bg-warning/10 text-warning' :
                      'bg-destructive/10 text-destructive'
                    }`}>{currentQuestion.difficulty}</span>
                    <span className="text-xs text-muted-foreground">{currentQuestion.domain}</span>
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
                        className={`w-full text-left p-4 rounded-lg border transition-all text-sm ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border bg-secondary/50 text-foreground hover:border-primary/30'
                        }`}
                      >
                        <span className="font-mono font-semibold mr-3 text-muted-foreground">{choice.id.toUpperCase()}</span>
                        {choice.text}
                      </button>
                    );
                  })}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mt-6">
                  {currentQuestion.tags.map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">{tag}</span>
                  ))}
                </div>
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
                    className={`w-8 h-8 rounded text-xs font-mono font-semibold transition-all ${
                      isCurrent ? 'bg-primary text-primary-foreground' :
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
