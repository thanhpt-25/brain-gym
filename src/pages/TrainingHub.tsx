import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Calendar, Flame, Brain, ChevronLeft, Loader2,
  Zap, BookOpen, CheckCircle2, XCircle, SkipForward, Eye, Badge,
  TrendingDown, RotateCcw, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCertifications } from '@/services/certifications';
import { getQuestions } from '@/services/questions';
import { getWeakTopics } from '@/services/analytics';
import { getDueReviews, startWeaknessTraining, submitReview } from '@/services/training';
import { useAuthStore } from '@/stores/auth.store';
import { getStreakData, recordActivity } from '@/stores/streak.store';
import Navbar from '@/components/Navbar';

/* ─── helpers ─── */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type TrainingMode = 'hub' | 'weakness' | 'daily-review';

const TrainingHub = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [mode, setMode] = useState<TrainingMode>('hub');
  const [certFilter, setCertFilter] = useState('');
  const streak = getStreakData();

  const { data: certifications } = useQuery({
    queryKey: ['certifications'],
    queryFn: getCertifications,
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-mono font-bold mb-2">Đăng nhập để sử dụng Training Hub</h2>
          <Button className="glow-cyan font-mono" onClick={() => navigate('/auth')}>Đăng nhập</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Training Hub" />

      <div className="container pt-24 pb-16 space-y-8">
        {mode === 'hub' && (
          <HubView
            streak={streak}
            certifications={certifications ?? []}
            certFilter={certFilter}
            setCertFilter={setCertFilter}
            onSelectMode={setMode}
          />
        )}
        {mode === 'weakness' && (
          <WeaknessMode
            certFilter={certFilter}
            onBack={() => setMode('hub')}
          />
        )}
        {mode === 'daily-review' && (
          <DailyReviewMode
            certFilter={certFilter}
            onBack={() => setMode('hub')}
          />
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────── Hub View ─────────────────────────────── */

interface HubViewProps {
  streak: ReturnType<typeof getStreakData>;
  certifications: { id: string; code: string; name: string }[];
  certFilter: string;
  setCertFilter: (v: string) => void;
  onSelectMode: (m: TrainingMode) => void;
}

function HubView({ streak, certifications, certFilter, setCertFilter, onSelectMode }: HubViewProps) {
  const weekDays = useMemo(() => {
    const days: { label: string; active: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({
        label: d.toLocaleDateString('en', { weekday: 'short' }),
        active: dateStr <= (streak.lastActiveDate || ''),
      });
    }
    // Simple heuristic: mark recent consecutive days
    let active = streak.currentStreak;
    for (let i = days.length - 1; i >= 0 && active > 0; i--) {
      days[i].active = true;
      active--;
    }
    return days;
  }, [streak]);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Streak Card */}
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-orange-500/10 border-2 border-orange-500/30 flex items-center justify-center">
                  <Flame className="h-10 w-10 text-orange-400" />
                </div>
                {streak.currentStreak > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-xs font-mono font-bold text-background"
                  >
                    {streak.currentStreak}
                  </motion.div>
                )}
              </div>
              <div>
                <div className="text-3xl font-bold font-mono">
                  {streak.currentStreak} <span className="text-base text-muted-foreground font-normal">day streak</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Best: {streak.longestStreak} days • {streak.totalDaysActive} total days
                </div>
              </div>
            </div>

            <div className="flex gap-1.5 sm:ml-auto">
              {weekDays.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono transition-colors ${
                      d.active
                        ? 'bg-orange-500/20 border border-orange-500/40 text-orange-400'
                        : 'bg-secondary border border-border text-muted-foreground'
                    }`}
                  >
                    {d.active ? '🔥' : '·'}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cert filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-mono mr-1">Filter:</span>
        <Button
          size="sm" variant={!certFilter ? 'default' : 'outline'}
          className="font-mono text-xs" onClick={() => setCertFilter('')}
        >All</Button>
        {certifications.map(c => (
          <Button
            key={c.id} size="sm"
            variant={certFilter === c.id ? 'default' : 'outline'}
            className="font-mono text-xs" onClick={() => setCertFilter(c.id)}
          >{c.code}</Button>
        ))}
      </div>

      {/* Mode cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <ModeCard
          icon={TrendingDown}
          title="Weakness Targeting"
          desc="Tập trung vào các domain yếu nhất. Hệ thống tự động chọn câu hỏi từ những chủ đề bạn hay sai."
          accentClass="text-destructive"
          bgClass="bg-destructive/10 border-destructive/20"
          onClick={() => onSelectMode('weakness')}
        />
        <ModeCard
          icon={Calendar}
          title="Daily Review"
          desc="Ôn tập theo Spaced Repetition. 10-20 câu hỏi mỗi ngày để duy trì kiến thức lâu dài."
          accentClass="text-primary"
          bgClass="bg-primary/10 border-primary/20"
          onClick={() => onSelectMode('daily-review')}
        />
      </div>
    </motion.div>
  );
}

function ModeCard({ icon: Icon, title, desc, accentClass, bgClass, onClick }: {
  icon: any; title: string; desc: string; accentClass: string; bgClass: string; onClick: () => void;
}) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300 }}>
      <Card className="glass-card hover:border-primary/30 transition-colors cursor-pointer h-full" onClick={onClick}>
        <CardContent className="p-6 flex flex-col h-full">
          <div className={`w-12 h-12 rounded-xl ${bgClass} border flex items-center justify-center mb-4`}>
            <Icon className={`h-6 w-6 ${accentClass}`} />
          </div>
          <h3 className="text-lg font-mono font-bold mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground flex-1">{desc}</p>
          <Button className="mt-4 font-mono w-full" variant="outline">
            Start Training →
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─────────────── Shared Practice Session Component ─────────────── */

interface PracticeSessionProps {
  questions: any[];
  modeLabel: string;
  modeIcon: any;
  onBack: () => void;
  onComplete: () => void;
  isLoading: boolean;
}

function PracticeSession({ questions, modeLabel, modeIcon: ModeIcon, onBack, onComplete, isLoading }: PracticeSessionProps) {
  const [pool] = useState(() => shuffle([...questions]));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ correct: 0, wrong: 0, skipped: 0 });

  const question = pool[index];
  const isFinished = index >= pool.length;

  const correctIds = useMemo(
    () => question?.choices?.filter((c: any) => c.isCorrect).map((c: any) => c.id) || [],
    [question],
  );

  const isCorrect = useMemo(() => {
    if (!selected.length) return false;
    return correctIds.length === selected.length && correctIds.every((id: string) => selected.includes(id));
  }, [selected, correctIds]);

  const selectChoice = (choiceId: string) => {
    if (revealed) return;
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
    } catch (err) {
      console.error('Failed to submit review:', err);
    }
  };

  const next = () => {
    setSelected([]);
    setRevealed(false);
    if (index + 1 >= pool.length) {
      recordActivity();
      onComplete();
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

/* ─────────────── Weakness Targeting Mode ─────────────── */

function WeaknessMode({ certFilter, onBack }: { certFilter: string; onBack: () => void }) {
  const [session, setSession] = useState<{ questions: any[]; attemptId?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: weakTopics } = useQuery({
    queryKey: ['weak-topics-training', certFilter],
    queryFn: () => getWeakTopics(certFilter || undefined, 5),
  });

  const weakDomainNames = useMemo(() => (weakTopics ?? []).filter(d => d.percentage < 75).map(d => d.domain), [weakTopics]);

  const handleStart = async () => {
    if (!certFilter) return; // In a real app, maybe show a toast
    setLoading(true);
    try {
      const data = await startWeaknessTraining(certFilter, 10);
      setSession({ questions: data.questions, attemptId: data.attemptId });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <Button variant="ghost" className="mb-6 text-muted-foreground font-mono" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Hub
        </Button>
        <Card className="glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-4">
            <TrendingDown className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-mono font-bold mb-2">Weakness Targeting</h2>
          <p className="text-muted-foreground mb-4">Tập trung vào các chủ đề bạn hay sai nhất</p>

          {!certFilter && (
            <p className="text-xs text-warning mb-6">⚠️ Please select a certification in the Hub first.</p>
          )}

          {weakDomainNames.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-muted-foreground mb-2">Weak domains detected:</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {weakDomainNames.map(name => (
                  <span key={name} className="px-2.5 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-mono">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Button 
            className="glow-cyan font-mono" size="lg" 
            onClick={handleStart} 
            disabled={loading || !certFilter}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Target className="h-4 w-4 mr-2" />}
            Start Weakness Training
          </Button>
        </Card>
      </motion.div>
    );
  }

  return (
    <PracticeSession
      questions={session.questions}
      modeLabel="Weakness Targeting"
      modeIcon={TrendingDown}
      onBack={onBack}
      onComplete={() => {}}
      isLoading={false}
    />
  );
}

/* ─────────────── Daily Review Mode ─────────────── */

function DailyReviewMode({ certFilter, onBack }: { certFilter: string; onBack: () => void }) {
  const [started, setStarted] = useState(false);
  const DAILY_COUNT = 15;

  const { data: dueReviews, isLoading } = useQuery({
    queryKey: ['daily-review-questions', certFilter],
    queryFn: () => getDueReviews(certFilter || undefined, DAILY_COUNT),
    enabled: started,
  });

  const dailyQuestions = useMemo(() => (dueReviews ?? []).map(r => r.question), [dueReviews]);

  if (!started) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <Button variant="ghost" className="mb-6 text-muted-foreground font-mono" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Hub
        </Button>
        <Card className="glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-mono font-bold mb-2">Daily Review</h2>
          <p className="text-muted-foreground mb-2">Ôn tập mỗi ngày theo phương pháp Spaced Repetition</p>
          <p className="text-sm text-muted-foreground mb-6">
            Hệ thống tự động chọn các câu hỏi đã đến lịch ôn tập (SRS).
          </p>

          <div className="flex items-center justify-center gap-6 mb-6 text-sm">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">~10-15 phút</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-orange-400" />
              <span className="text-muted-foreground">Builds streak</span>
            </div>
          </div>

          <Button className="glow-cyan font-mono" size="lg" onClick={() => setStarted(true)}>
            <Calendar className="h-4 w-4 mr-2" /> Start Daily Review
          </Button>
        </Card>
      </motion.div>
    );
  }

  return (
    <PracticeSession
      questions={dailyQuestions}
      modeLabel="Daily Review"
      modeIcon={Calendar}
      onBack={onBack}
      onComplete={() => {}}
      isLoading={isLoading}
    />
  );
}

export default TrainingHub;
