import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Flag, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttemptQuestion, StartAttemptResponse, TimerMode } from '@/types/api-types';

interface ExamSessionProps {
  attemptData: StartAttemptResponse;
  questions: AttemptQuestion[];
  currentIndex: number;
  setCurrentIndex: (val: number | ((prev: number) => number)) => void;
  answers: Record<string, string[]>;
  selectAnswer: (qId: string, cId: string) => void;
  marked: Set<string>;
  toggleMark: (qId: string) => void;
  timeLeft: number;
  totalSeconds: number;
  onSubmit: () => void;
}

function getTimerClass(timeLeft: number, totalSeconds: number, timerMode?: TimerMode): string {
  if (timerMode === 'RELAXED') return 'text-muted-foreground';
  if (timerMode === 'ACCELERATED') {
    const ratio = totalSeconds > 0 ? timeLeft / totalSeconds : 1;
    if (ratio <= 0.25) return 'text-destructive animate-pulse';
    if (ratio <= 0.5) return 'text-orange-400';
    return 'text-foreground';
  }
  // STRICT (default)
  return timeLeft < 300 ? 'text-destructive animate-pulse' : 'text-foreground';
}

export function ExamSession({
  attemptData,
  questions,
  currentIndex,
  setCurrentIndex,
  answers,
  selectAnswer,
  marked,
  toggleMark,
  timeLeft,
  totalSeconds,
  onSubmit
}: ExamSessionProps) {
  const currentQuestion = questions[currentIndex];
  const timerMode = attemptData?.timerMode;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!currentQuestion) return null;

  const timerClass = getTimerClass(timeLeft, totalSeconds, timerMode);
  const isAccelerated = timerMode === 'ACCELERATED';
  const showOrangeWarning = isAccelerated && totalSeconds > 0 && timeLeft / totalSeconds <= 0.5 && timeLeft / totalSeconds > 0.25;

  return (
    <div className="flex-1 flex flex-col">
      {/* Accelerated mode banner */}
      {isAccelerated && (
        <div className="bg-orange-500/10 border-b border-orange-500/30 px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-mono text-orange-400">
          <Zap className="h-3 w-3" />
          Accelerated Mode — Time pressure active
          {showOrangeWarning && <span className="ml-2 text-orange-300 font-semibold">· Halfway through your time!</span>}
        </div>
      )}

      {/* Top Bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-muted-foreground">{attemptData?.certification?.code}</span>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm font-mono text-foreground">Q{currentIndex + 1}/{questions.length}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 font-mono text-sm ${timerClass}`}>
              <Clock className="h-4 w-4" />
              {formatTime(timeLeft)}
            </div>
            <Button size="sm" variant="destructive" onClick={onSubmit} className="font-mono">
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
                const isMarkedQ = marked.has(q.id);
                const isCurrent = i === currentIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(i)}
                    className={`w-8 h-8 rounded text-xs font-mono font-semibold transition-all ${isCurrent ? 'bg-primary text-primary-foreground' :
                      isMarkedQ ? 'bg-warning/20 text-warning border border-warning/30' :
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
}
