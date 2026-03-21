import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, ChevronLeft, Loader2, CheckCircle2,
  XCircle, SkipForward, Eye, RotateCcw, Flame
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { submitReview } from '@/services/training';
import { saveAnswer } from '@/services/attempts';
import { recordActivity } from '@/stores/streak.store';
import { Question } from '@/types/api-types';
import { LucideIcon } from 'lucide-react';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface PracticeSessionProps {
  questions: Question[];
  attemptId?: string;
  modeLabel: string;
  modeIcon: LucideIcon;
  onBack: () => void;
  onComplete: (stats: { correct: number; wrong: number; skipped: number }) => void;
  isLoading: boolean;
}

export function PracticeSession({ questions, attemptId, modeLabel, modeIcon: ModeIcon, onBack, onComplete, isLoading }: PracticeSessionProps) {
  const [pool] = useState(() => shuffle([...questions]));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ correct: 0, wrong: 0, skipped: 0 });

  const question = pool[index];
  const isFinished = index >= pool.length && pool.length > 0;

  const correctIds = useMemo(
    () => question?.choices?.filter((c) => c.isCorrect).map((c) => c.id || '') || [],
    [question],
  );

  const isCorrect = useMemo(() => {
    if (!selected.length) return false;
    return correctIds.length === selected.length && correctIds.every((id: string) => selected.includes(id));
  }, [selected, correctIds]);

  const selectChoice = (choiceId: string | undefined) => {
    if (!choiceId || revealed) return;
    if (correctIds.length > 1) {
      setSelected(prev => prev.includes(choiceId) ? prev.filter(id => id !== choiceId) : [...prev, choiceId]);
    } else {
      setSelected([choiceId]);
    }
  };

  const reveal = async () => {
    setRevealed(true);
    let quality = 1; // Default for skipped
    if (selected.length > 0) {
      if (isCorrect) {
        setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
        quality = 5;
      } else {
        setStats(prev => ({ ...prev, wrong: prev.wrong + 1 }));
        quality = 0;
      }
    } else {
      setStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
    }

    try {
      await submitReview(question.id, quality);
      if (attemptId) {
        await saveAnswer(attemptId, { questionId: question.id, selectedChoices: selected });
      }
    } catch (err) {
      console.error('Failed to submit review:', err);
    }
  };

  const next = () => {
    setSelected([]);
    setRevealed(false);
    if (index + 1 >= pool.length) {
      recordActivity();
      onComplete(stats);
    }
    setIndex(prev => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (pool.length === 0) {
    return (
      <div className="text-center py-20">
        <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-mono font-bold mb-2">Không có câu hỏi phù hợp</h3>
        <p className="text-sm text-muted-foreground mb-4">Hãy hoàn thành vài bài thi trước để hệ thống xác định điểm yếu.</p>
        <Button variant="outline" className="font-mono" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>
      </div>
    );
  }

  const total = stats.correct + stats.wrong + stats.skipped;
  const accuracy = total > 0 ? Math.round((stats.correct / total) * 100) : 0;

  if (isFinished) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto">
        <Card className="glass-card p-8 text-center">
          <ModeIcon className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-mono font-bold mb-2">Session Complete!</h2>
          <p className="text-muted-foreground mb-6">{pool.length} câu hỏi đã hoàn thành</p>

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

          <div className="text-3xl font-mono font-bold text-gradient-cyan mb-2">{accuracy}% Accuracy</div>
          <div className="flex items-center justify-center gap-2 text-sm text-orange-400 mb-6">
            <Flame className="h-4 w-4" /> Streak updated!
          </div>

          <div className="flex gap-4">
            <Button variant="outline" className="flex-1 font-mono" onClick={onBack}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Hub
            </Button>
            <Button className="flex-1 glow-cyan font-mono" onClick={() => { setIndex(0); setSelected([]); setRevealed(false); setStats({ correct: 0, wrong: 0, skipped: 0 }); }}>
              <RotateCcw className="h-4 w-4 mr-1" /> Again
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <ModeIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-mono">{modeLabel}</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-accent">{stats.correct}✓</span>
          <span className="text-destructive">{stats.wrong}✗</span>
          <span className="text-muted-foreground">{index + 1}/{pool.length}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1 bg-secondary rounded-full mb-6 overflow-hidden">
        <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${((index + 1) / pool.length) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          <Card className="glass-card p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                question.difficulty === 'EASY' ? 'bg-accent/10 text-accent' :
                question.difficulty === 'MEDIUM' ? 'bg-warning/10 text-[hsl(var(--warning))]' :
                'bg-destructive/10 text-destructive'
              }`}>{question.difficulty}</span>
              <span className="text-xs text-muted-foreground">{question.domain?.name}</span>
              {correctIds.length > 1 && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-primary/30 text-primary font-mono">Multi-select</span>
              )}
            </div>

            <h2 className="text-lg font-medium mb-1">{question.title}</h2>
            {question.description && (
              <p className="text-sm text-muted-foreground mb-4">{question.description}</p>
            )}

            <div className="space-y-2 mt-5">
              {question.choices.map((choice) => {
                const isSelected = selected.includes(choice.id || '');
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
          </Card>

          {/* Explanation */}
          <AnimatePresence>
            {revealed && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="glass-card p-5 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    {isCorrect ? <CheckCircle2 className="h-5 w-5 text-accent" /> :
                      selected.length > 0 ? <XCircle className="h-5 w-5 text-destructive" /> :
                      <SkipForward className="h-5 w-5 text-muted-foreground" />}
                    <span className={`font-mono font-semibold text-sm ${
                      isCorrect ? 'text-accent' : selected.length > 0 ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {isCorrect ? 'Correct!' : selected.length > 0 ? 'Incorrect' : 'Skipped'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{question.explanation}</p>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3 max-w-3xl mx-auto">
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
  );
}
