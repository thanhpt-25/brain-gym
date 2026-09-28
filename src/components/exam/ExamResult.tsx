import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Check,
  Share2,
  Timer,
  RotateCcw,
  Target,
  BrainCircuit,
  TrendingUp,
} from 'lucide-react';
import { addMissedToReview, getAttemptInsights } from '@/services/attempts';
import type { PracticeSetup } from '@/lib/exam-plan';
import { Button } from '@/components/ui/button';
import { AttemptResult, MistakeType } from '@/types/api-types';
import { toast } from 'sonner';
import MarkdownContent from '@/components/ui/MarkdownContent';

interface ExamResultProps {
  result: AttemptResult;
  onRetry: () => void;
  onHome: () => void;
  /** Start a follow-up practice session (retry missed, drill a domain). */
  onStartPractice?: (
    setup: Partial<PracticeSetup> & { sourceAttemptId?: string },
  ) => void;
}

const MISTAKE_HINTS: Partial<Record<MistakeType, string>> = {
  CARELESS: 'Likely careless — answered very quickly',
  TIME_PRESSURE: 'Likely time pressure — well over the target pace',
};

/** 75 → "1m 15s", 42 → "42s". */
function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

/**
 * Where the time went: average pace against the pace needed to finish on
 * time, and the questions that took longest.
 */
function TimeAnalysis({ result }: { result: AttemptResult }) {
  const timed = result.questionResults
    .map((qr, index) => ({ qr, index }))
    .filter(({ qr }) => typeof qr.timeSpent === 'number');
  if (timed.length === 0) return null;

  const total = timed.reduce((sum, { qr }) => sum + (qr.timeSpent ?? 0), 0);
  const average = total / timed.length;
  const target = result.targetSecondsPerQuestion ?? null;
  const slowest = [...timed]
    .sort((a, b) => (b.qr.timeSpent ?? 0) - (a.qr.timeSpent ?? 0))
    .slice(0, 3)
    .filter(({ qr }) => (qr.timeSpent ?? 0) > 0);
  const quickWrong = timed.filter(
    ({ qr }) => qr.suggestedMistakeType === 'CARELESS',
  ).length;
  const overPace = target
    ? timed.filter(({ qr }) => (qr.timeSpent ?? 0) > target).length
    : 0;

  return (
    <section className="glass-card p-6 mb-6" aria-labelledby="time-analysis">
      <h3 id="time-analysis" className="font-mono font-semibold mb-4 flex items-center gap-2">
        <Timer className="h-4 w-4" aria-hidden="true" /> Time Analysis
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-secondary text-center">
          <div className="text-lg font-mono font-bold">{formatDuration(average)}</div>
          <div className="text-xs text-muted-foreground">Avg per question</div>
        </div>
        {target !== null && (
          <div className="p-3 rounded-lg bg-secondary text-center">
            <div className="text-lg font-mono font-bold">{formatDuration(target)}</div>
            <div className="text-xs text-muted-foreground">Target pace</div>
          </div>
        )}
        {target !== null && (
          <div className="p-3 rounded-lg bg-secondary text-center">
            <div className={`text-lg font-mono font-bold ${overPace > 0 ? 'text-warning' : ''}`}>
              {overPace}
            </div>
            <div className="text-xs text-muted-foreground">Over target pace</div>
          </div>
        )}
      </div>
      {slowest.length > 0 && (
        <div className="text-sm">
          <div className="text-muted-foreground mb-1">Took longest:</div>
          <ul className="space-y-1">
            {slowest.map(({ qr, index }) => (
              <li key={qr.questionId} className="flex gap-2">
                <span className="font-mono text-muted-foreground w-10">Q{index + 1}</span>
                <span className="flex-1 truncate">{qr.title}</span>
                <span className="font-mono">{formatDuration(qr.timeSpent ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {quickWrong > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {quickWrong} wrong answer{quickWrong > 1 ? 's were' : ' was'} given in under 10 seconds —
          slowing down may win easy points.
        </p>
      )}
    </section>
  );
}

function likelihoodTone(pct: number) {
  if (pct >= 70) return 'text-accent';
  if (pct >= 40) return 'text-warning';
  return 'text-destructive';
}

/**
 * What to do next: estimated chance to pass, one-click follow-ups on the
 * mistakes and the weakest domain, and the per-domain trend.
 */
function NextSteps({
  result,
  onStartPractice,
}: {
  result: AttemptResult;
  onStartPractice?: ExamResultProps['onStartPractice'];
}) {
  const { data: insights } = useQuery({
    queryKey: ['attempt-insights', result.attemptId],
    queryFn: () => getAttemptInsights(result.attemptId),
    enabled: !!result.attemptId && result.status === 'SUBMITTED',
  });
  const review = useMutation({
    mutationFn: () => addMissedToReview(result.attemptId),
    onSuccess: (r) =>
      toast.success(
        `${r.added} question${r.added === 1 ? '' : 's'} added to your review queue`,
      ),
    onError: () => toast.error('Could not add questions to your review queue'),
  });
  if (!insights) return null;

  const { readiness, trend, weakestDomain, missedCount } = insights;
  const domainNames = [
    ...new Set(trend.flatMap((t) => Object.keys(t.domainScores ?? {}))),
  ].sort();

  return (
    <section className="glass-card p-6 mb-6" aria-labelledby="next-steps">
      <h3 id="next-steps" className="font-mono font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4" aria-hidden="true" /> Next Steps
      </h3>

      {readiness.passLikelihood !== null && (
        <div className="p-4 rounded-lg bg-secondary mb-4 flex items-center gap-4" data-testid="pass-likelihood">
          <div className={`text-3xl font-mono font-bold ${likelihoodTone(readiness.passLikelihood)}`}>
            {readiness.passLikelihood}%
          </div>
          <div className="text-sm">
            <div className="font-medium">Estimated chance to pass</div>
            <div className="text-xs text-muted-foreground">
              A {readiness.examLength}-question exam at a {readiness.passingScore}% pass mark,
              based on your latest answers to {readiness.basedOnQuestions} questions. An estimate,
              not a guarantee.
            </div>
          </div>
        </div>
      )}

      {onStartPractice && (
        <div className="flex flex-wrap gap-2 mb-4">
          {missedCount > 0 && (
            <Button
              variant="outline"
              className="font-mono"
              onClick={() =>
                onStartPractice({
                  mode: 'REVIEW',
                  sessionSize: Math.min(30, Math.max(10, missedCount)),
                  sourceAttemptId: result.attemptId,
                })
              }
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Retry missed ({missedCount})
            </Button>
          )}
          {weakestDomain && (
            <Button
              variant="outline"
              className="font-mono"
              onClick={() =>
                onStartPractice({
                  mode: 'QUICK_DRILL',
                  sessionSize: 10,
                  domainIds: [weakestDomain.domainId],
                })
              }
            >
              <Target className="h-4 w-4 mr-1" /> Drill {weakestDomain.name} ({weakestDomain.percentage}%)
            </Button>
          )}
        </div>
      )}
      {missedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="font-mono"
            disabled={review.isPending || review.isSuccess}
            onClick={() => review.mutate()}
          >
            <BrainCircuit className="h-4 w-4 mr-1" />
            {review.isSuccess
              ? 'Added to review queue'
              : `Add ${missedCount} missed to spaced review`}
          </Button>
          {review.isSuccess && (
            <Link to="/training" className="text-primary text-xs underline">
              Open review queue
            </Link>
          )}
        </div>
      )}

      {trend.length > 1 && domainNames.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs font-mono" aria-label="Domain trend">
            <caption className="text-left text-muted-foreground mb-2">
              Your last {trend.length} attempts (oldest → latest)
            </caption>
            <thead>
              <tr>
                <th scope="col" className="text-left font-normal text-muted-foreground pr-3">Domain</th>
                {trend.map((t, i) => (
                  <th key={t.attemptId} scope="col" className="font-normal text-muted-foreground px-2 text-right">
                    #{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="text-left font-normal pr-3">Overall</th>
                {trend.map((t) => (
                  <td key={t.attemptId} className="px-2 text-right">{t.score}%</td>
                ))}
              </tr>
              {domainNames.map((name) => (
                <tr key={name}>
                  <th scope="row" className="text-left font-normal pr-3 truncate max-w-[12rem]">{name}</th>
                  {trend.map((t) => {
                    const d = t.domainScores?.[name];
                    return (
                      <td key={t.attemptId} className="px-2 text-right">
                        {d && d.total > 0 ? `${Math.round((d.correct / d.total) * 100)}%` : '–'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ExamResult({ result, onRetry, onHome, onStartPractice }: ExamResultProps) {
  const [copied, setCopied] = useState(false);
  const passingScore =
    result.passingScore ??
    (result.certification as { passingScore?: number } | undefined)?.passingScore ??
    70;
  const passed = result.passed ?? result.percentage >= passingScore;

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
              {result.totalCorrect}/{result.totalQuestions} correct · {formatTime(result.timeSpent)} · Pass mark {passingScore}%
            </div>
            {result.feedbackMode === 'INTERACTIVE' && (
              <span className="inline-block mt-3 text-xs px-2 py-0.5 rounded-full font-mono bg-primary/10 text-primary border border-primary/20">
                Interactive
              </span>
            )}
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
                        <span className={`font-mono ${pct >= passingScore ? 'text-accent' : 'text-destructive'}`}>{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct >= passingScore ? 'bg-accent' : 'bg-destructive'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <NextSteps result={result} onStartPractice={onStartPractice} />

          <TimeAnalysis result={result} />

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
                        {typeof qr.timeSpent === 'number' && (
                          <span className="ml-2 text-xs font-mono text-muted-foreground" title="Time spent">
                            · {formatDuration(qr.timeSpent)}
                          </span>
                        )}
                      </div>
                      {!qr.correct && !qr.mistakeType && qr.suggestedMistakeType && MISTAKE_HINTS[qr.suggestedMistakeType] && (
                        <div className="mb-2 inline-block text-[11px] px-2 py-0.5 rounded-full font-mono bg-warning/10 text-warning border border-warning/20">
                          {MISTAKE_HINTS[qr.suggestedMistakeType]}
                        </div>
                      )}
                      {qr.codeSnippet && (
                        <pre className="p-3 rounded bg-secondary/80 text-xs font-mono overflow-x-auto mb-2">
                          <code>{qr.codeSnippet}</code>
                        </pre>
                      )}
                      {qr.imageUrl && (
                        <img
                          src={qr.imageUrl}
                          alt="Question illustration"
                          loading="lazy"
                          className="max-w-full max-h-64 rounded border border-border mb-2"
                        />
                      )}
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
                        <div className="mt-2 text-muted-foreground">
                          <MarkdownContent size="text-xs">{qr.explanation}</MarkdownContent>
                        </div>
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
