import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCertificationById } from '@/services/certifications';
import { getQuestions } from '@/services/questions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Eye, CheckCircle2, XCircle, SkipForward, RotateCcw, BookOpen, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const StudyMode = () => {
  const { certId } = useParams();
  const navigate = useNavigate();

  const { data: cert } = useQuery({
    queryKey: ['certification', certId],
    queryFn: () => getCertificationById(certId!),
    enabled: !!certId,
  });

  const { data: questionsData, isLoading } = useQuery({
    queryKey: ['study-questions', certId],
    queryFn: () => getQuestions(certId, 1, 100),
    enabled: !!certId,
  });

  const allQuestions = useMemo(() => questionsData?.data ?? [], [questionsData]);

  const [pool, setPool] = useState<typeof allQuestions>([]);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ correct: 0, wrong: 0, skipped: 0 });

  const startStudy = () => {
    setPool(shuffle([...allQuestions]));
    setIndex(0);
    setSelected([]);
    setRevealed(false);
    setStats({ correct: 0, wrong: 0, skipped: 0 });
    setStarted(true);
  };

  const question = pool[index];
  const isFinished = started && index >= pool.length;

  const correctIds = useMemo(
    () => question?.choices?.filter((c: any) => c.isCorrect).map((c: any) => c.id) || [],
    [question]
  );

  const isCorrect = useMemo(() => {
    if (!selected.length) return false;
    return correctIds.length === selected.length && correctIds.every((id: string) => selected.includes(id));
  }, [selected, correctIds]);

  const selectChoice = (choiceId: string) => {
    if (revealed) return;
    const multiCorrect = correctIds.length > 1;
    if (multiCorrect) {
      setSelected(prev => prev.includes(choiceId) ? prev.filter(id => id !== choiceId) : [...prev, choiceId]);
    } else {
      setSelected([choiceId]);
    }
  };

  const reveal = () => {
    setRevealed(true);
    if (selected.length > 0) {
      setStats(prev => isCorrect ? { ...prev, correct: prev.correct + 1 } : { ...prev, wrong: prev.wrong + 1 });
    } else {
      setStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
    }
  };

  const next = () => {
    setSelected([]);
    setRevealed(false);
    setIndex(prev => prev + 1);
  };

  if (!cert && !isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Certification not found</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const total = stats.correct + stats.wrong + stats.skipped;
  const accuracy = total > 0 ? Math.round((stats.correct / total) * 100) : 0;

  // Not started yet — show start screen
  if (!started) {
    return (
      <div className="min-h-screen bg-background bg-grid">
        <div className="container max-w-2xl py-20">
          <Button variant="ghost" className="mb-8 text-muted-foreground" onClick={() => navigate('/')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 text-center">
            <BookOpen className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-mono font-bold mb-2">Study Mode</h2>
            <p className="text-muted-foreground mb-2">{cert?.name}</p>
            <p className="text-sm text-muted-foreground mb-6">{allQuestions.length} questions available</p>
            {allQuestions.length === 0 ? (
              <p className="text-sm text-destructive font-mono">No questions available for this certification yet.</p>
            ) : (
              <Button className="glow-cyan font-mono" size="lg" onClick={startStudy}>
                <BookOpen className="h-4 w-4 mr-2" /> Start Studying
              </Button>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // Finished screen
  if (isFinished) {
    return (
      <div className="min-h-screen bg-background bg-grid">
        <div className="container max-w-2xl py-20">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 text-center">
            <BookOpen className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-mono font-bold mb-2">Session Complete!</h2>
            <p className="text-muted-foreground mb-6">Bạn đã hoàn thành {pool.length} câu hỏi</p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                <div className="text-2xl font-mono font-bold text-accent">{stats.correct}</div>
                <div className="text-xs text-muted-foreground">Correct</div>
              </div>
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="text-2xl font-mono font-bold text-destructive">{stats.wrong}</div>
                <div className="text-xs text-muted-foreground">Wrong</div>
              </div>
              <div className="p-4 rounded-lg bg-secondary border border-border">
                <div className="text-2xl font-mono font-bold text-muted-foreground">{stats.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
            </div>

            <div className="text-3xl font-mono font-bold text-gradient-cyan mb-6">{accuracy}% Accuracy</div>

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1 font-mono" onClick={() => navigate('/')}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Home
              </Button>
              <Button className="flex-1 glow-cyan font-mono" onClick={startStudy}>
                <RotateCcw className="h-4 w-4 mr-1" /> Study Again
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grid">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-muted-foreground">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-mono text-foreground">Study Mode</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">{cert?.code}</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-accent">{stats.correct}✓</span>
            <span className="text-destructive">{stats.wrong}✗</span>
            <span className="text-muted-foreground">{index + 1}/{pool.length}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-secondary">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${((index + 1) / pool.length) * 100}%` }} />
      </div>

      <div className="container max-w-3xl py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
          >
            {/* Question card */}
            <div className="glass-card p-6 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                  question.difficulty === 'EASY' ? 'bg-accent/10 text-accent' :
                  question.difficulty === 'MEDIUM' ? 'bg-warning/10 text-[hsl(var(--warning))]' :
                  'bg-destructive/10 text-destructive'
                }`}>{question.difficulty}</span>
                <span className="text-xs text-muted-foreground">{question.domain?.name}</span>
                {correctIds.length > 1 && (
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">Multi-select</Badge>
                )}
              </div>

              <h2 className="text-lg font-medium mb-1">{question.title}</h2>
              {question.description && (
                <p className="text-sm text-muted-foreground mb-4">{question.description}</p>
              )}

              <div className="space-y-2 mt-5">
                {question.choices.map((choice: any) => {
                  const isSelected = selected.includes(choice.id);
                  const isRight = choice.isCorrect;

                  let style = 'border-border bg-secondary/50 text-foreground hover:border-primary/30 cursor-pointer';
                  if (revealed) {
                    if (isRight) style = 'border-accent/50 bg-accent/10 text-foreground';
                    else if (isSelected && !isRight) style = 'border-destructive/50 bg-destructive/10 text-foreground';
                    else style = 'border-border bg-secondary/30 text-muted-foreground';
                  } else if (isSelected) {
                    style = 'border-primary bg-primary/10 text-foreground';
                  }

                  return (
                    <button
                      key={choice.id}
                      onClick={() => selectChoice(choice.id)}
                      disabled={revealed}
                      className={`w-full text-left p-4 rounded-lg border transition-all text-sm flex items-center gap-3 ${style}`}
                    >
                      <span className="font-mono font-semibold text-muted-foreground w-5">{choice.label.toUpperCase()}.</span>
                      <span className="flex-1">{choice.content}</span>
                      {revealed && isRight && <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />}
                      {revealed && isSelected && !isRight && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Explanation (revealed) */}
            <AnimatePresence>
              {revealed && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-5 mb-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                    ) : selected.length > 0 ? (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ) : (
                      <SkipForward className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className={`font-mono font-semibold text-sm ${
                      isCorrect ? 'text-accent' : selected.length > 0 ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {isCorrect ? 'Correct!' : selected.length > 0 ? 'Incorrect' : 'Skipped'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{question.explanation}</p>
                  {question.referenceUrl && (
                    <a href={question.referenceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-2 inline-block">
                      Reference →
                    </a>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex gap-3">
              {!revealed ? (
                <Button className="flex-1 glow-cyan font-mono" onClick={reveal}>
                  <Eye className="h-4 w-4 mr-2" />
                  {selected.length > 0 ? 'Check Answer' : 'Show Answer'}
                </Button>
              ) : (
                <Button className="flex-1 glow-cyan font-mono" onClick={next}>
                  Next Question <SkipForward className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default StudyMode;
