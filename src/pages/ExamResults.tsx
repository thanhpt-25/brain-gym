import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle2, XCircle, ChevronDown, ChevronUp, ArrowLeft,
  Trophy, Target, Clock, Filter, RotateCcw, ExternalLink, Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ExamResult, Question, Certification } from '@/types/exam';

type FilterType = 'all' | 'correct' | 'wrong' | 'skipped';

interface ExamResultsState {
  result: ExamResult;
  questions: Question[];
  cert: Certification;
}

const ExamResults = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ExamResultsState | null;

  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);

  const result = state?.result;
  const questions = state?.questions || [];
  const cert = state?.cert;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandAll) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(questions.map((q) => q.id)));
    }
    setExpandAll(!expandAll);
  };

  const correctCount = result?.questionResults.filter((r) => r.correct).length ?? 0;
  const wrongCount = result?.questionResults.filter((r) => !r.correct && r.selectedAnswers.length > 0).length ?? 0;
  const skippedCount = result?.questionResults.filter((r) => r.selectedAnswers.length === 0).length ?? 0;

  const filteredQuestions = useMemo(() => {
    if (!result) return [];
    return questions.filter((q) => {
      const qr = result.questionResults.find((r) => r.questionId === q.id);
      if (!qr) return false;
      if (filter === 'correct') return qr.correct;
      if (filter === 'wrong') return !qr.correct && qr.selectedAnswers.length > 0;
      if (filter === 'skipped') return qr.selectedAnswers.length === 0;
      return true;
    });
  }, [filter, questions, result]);

  if (!state || !result || !cert) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Không tìm thấy kết quả thi.</p>
          <Button onClick={() => navigate('/')} className="font-mono">Về trang chủ</Button>
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="min-h-screen bg-background bg-grid">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Brain className="h-6 w-6 text-primary" />
            <span className="font-mono text-lg font-bold text-gradient-cyan">Exam Results</span>
          </div>
          <span className="text-sm font-mono text-muted-foreground">{cert.code}</span>
        </div>
      </nav>

      <div className="container max-w-4xl pt-24 pb-16 space-y-6">
        {/* Score Hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`glass-card p-8 text-center ${result.passed ? 'glow-green' : ''}`}
        >
          <div className="text-5xl mb-2">{cert.icon}</div>
          <div className="text-xs font-mono text-muted-foreground mb-3">
            {cert.provider} · {cert.name}
          </div>
          <div
            className={`text-6xl font-mono font-bold mb-2 ${
              result.passed ? 'text-gradient-cyan' : 'text-gradient-warm'
            }`}
          >
            {result.percentage}%
          </div>
          <div
            className={`text-lg font-mono font-semibold mb-4 ${
              result.passed ? 'text-accent' : 'text-destructive'
            }`}
          >
            {result.passed ? '✅ PASSED' : '❌ NOT PASSED'}
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">
                {result.score}/{result.total} correct
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">{formatTime(result.timeTaken)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Pass: {cert.passingScore}%</span>
            </div>
          </div>
        </motion.div>

        {/* Domain Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass-card">
            <CardContent className="p-6">
              <h3 className="font-mono font-semibold mb-4 text-sm">Domain Breakdown</h3>
              <div className="space-y-3">
                {Object.entries(result.domainBreakdown).map(([domain, data]) => {
                  const pct = Math.round((data.correct / data.total) * 100);
                  const passing = cert.passingScore || 70;
                  return (
                    <div key={domain}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-foreground truncate mr-4">{domain}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {data.correct}/{data.total}
                          </span>
                          <span
                            className={`font-mono font-bold text-xs min-w-[36px] text-right ${
                              pct >= passing ? 'text-accent' : 'text-destructive'
                            }`}
                          >
                            {pct}%
                          </span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: 0.2 }}
                          className={`h-full rounded-full ${
                            pct >= passing ? 'bg-accent' : 'bg-destructive'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-between flex-wrap gap-3"
        >
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(
              [
                { key: 'all', label: 'All', count: questions.length },
                { key: 'correct', label: 'Correct', count: correctCount },
                { key: 'wrong', label: 'Wrong', count: wrongCount },
                { key: 'skipped', label: 'Skipped', count: skippedCount },
              ] as const
            ).map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? 'default' : 'outline'}
                className="font-mono text-xs"
                onClick={() => setFilter(f.key)}
              >
                {f.label}{' '}
                <span className="ml-1 opacity-60">{f.count}</span>
              </Button>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="font-mono text-xs" onClick={toggleExpandAll}>
            {expandAll ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" /> Collapse All
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" /> Expand All
              </>
            )}
          </Button>
        </motion.div>

        {/* Questions Review */}
        <div className="space-y-3">
          {filteredQuestions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Không có câu hỏi nào trong filter này.
            </p>
          )}
          {filteredQuestions.map((q, i) => {
            const qr = result.questionResults.find((r) => r.questionId === q.id)!;
            const globalIndex = questions.indexOf(q);
            const isExpanded = expandedIds.has(q.id);
            const wasSkipped = qr.selectedAnswers.length === 0;

            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card
                  className={`glass-card overflow-hidden transition-colors ${
                    qr.correct
                      ? 'border-accent/20 hover:border-accent/40'
                      : wasSkipped
                        ? 'border-warning/20 hover:border-warning/40'
                        : 'border-destructive/20 hover:border-destructive/40'
                  }`}
                >
                  {/* Question Header — always visible */}
                  <button
                    onClick={() => toggleExpand(q.id)}
                    className="w-full text-left p-4 flex items-center gap-3"
                  >
                    {qr.correct ? (
                      <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                    ) : wasSkipped ? (
                      <div className="h-5 w-5 rounded-full border-2 border-warning shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-snug">
                        <span className="font-mono text-muted-foreground mr-2">Q{globalIndex + 1}.</span>
                        {q.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                            q.difficulty === 'EASY'
                              ? 'bg-accent/10 text-accent'
                              : q.difficulty === 'MEDIUM'
                                ? 'bg-warning/10 text-warning'
                                : 'bg-destructive/10 text-destructive'
                          }`}
                        >
                          {q.difficulty}
                        </span>
                        {q.domain && (
                          <span className="text-[10px] text-muted-foreground">{q.domain.name}</span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-border"
                    >
                      <div className="p-4 space-y-4">
                        {q.description && (
                          <p className="text-sm text-muted-foreground">{q.description}</p>
                        )}

                        {/* Choices */}
                        <div className="space-y-2">
                          {q.choices.map((c) => {
                            const isSelected = qr.selectedAnswers.includes(c.id);
                            const isCorrect = qr.correctAnswers.includes(c.id);
                            let style = 'border-border bg-secondary/30 text-muted-foreground';
                            if (isCorrect) style = 'border-accent/40 bg-accent/10 text-accent';
                            else if (isSelected) style = 'border-destructive/40 bg-destructive/10 text-destructive';

                            return (
                              <div
                                key={c.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border text-sm transition-all ${style}`}
                              >
                                <span className="font-mono font-bold shrink-0 w-6 text-center">
                                  {c.label.toUpperCase()}
                                </span>
                                <span className="flex-1">{c.content}</span>
                                <span className="shrink-0">
                                  {isCorrect && <CheckCircle2 className="h-4 w-4 text-accent" />}
                                  {isSelected && !isCorrect && <XCircle className="h-4 w-4 text-destructive" />}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation */}
                        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                          <div className="text-xs font-mono font-semibold text-primary mb-2">
                            💡 Explanation
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">{q.explanation}</p>
                          {q.referenceUrl && (
                            <a
                              href={q.referenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                            >
                              <ExternalLink className="h-3 w-3" /> Reference
                            </a>
                          )}
                        </div>

                        {/* Tags */}
                        {q.tags && q.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {q.tags.map((tag: string) => (
                              <span
                                key={tag}
                                className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4">
          <Button variant="outline" className="flex-1 font-mono" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Home
          </Button>
          <Button variant="outline" className="flex-1 font-mono" onClick={() => navigate('/dashboard')}>
            Dashboard
          </Button>
          <Button
            className="flex-1 glow-cyan font-mono"
            onClick={() => navigate(`/exam/${cert.id}`)}
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExamResults;
