import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Check, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttemptResult } from '@/types/api-types';
import { toast } from 'sonner';

interface ExamResultProps {
  result: AttemptResult;
  onRetry: () => void;
  onHome: () => void;
}

export function ExamResult({ result, onRetry, onHome }: ExamResultProps) {
  const [copied, setCopied] = useState(false);
  const passed = result.percentage >= 70;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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
                          const isSelected = qr.selectedAnswers.includes(c.id || '');
                          const isCorrect = qr.correctAnswers.includes(c.id || '');
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

          <div className="flex gap-4 items-center">
            <Button variant="outline" className="flex-1 font-mono" onClick={onHome}>Back Home</Button>
            <Button
              variant="outline"
              className="font-mono"
              onClick={() => {
                const url = `${window.location.origin}/exam-results?score=${result.percentage}&total=${result.totalQuestions}&correct=${result.totalCorrect}&cert=${result.certification?.code || ''}`;
                navigator.clipboard.writeText(url);
                setCopied(true);
                toast.success('Result link copied!');
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
              Share
            </Button>
            <Button className="flex-1 glow-cyan font-mono" onClick={onRetry}>Retry Exam</Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
