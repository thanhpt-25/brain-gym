import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  loadCandidateAssessment, startCandidateAttempt,
  submitCandidateAttempt, reportCandidateEvent,
} from '@/services/assessments';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Clock, AlertTriangle, ChevronLeft, ChevronRight,
  Send, ClipboardList, CheckCircle2,
} from 'lucide-react';
import type { CandidateExamPayload, CandidateQuestion, CandidateSubmitResult } from '@/types/assessment-types';

const CandidateExam = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<'loading' | 'intro' | 'exam' | 'submitting'>('loading');
  const [examData, setExamData] = useState<CandidateExamPayload | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const tabSwitchReported = useRef(false);

  // Load assessment info
  const { data: assessmentInfo, error: loadError, isLoading } = useQuery({
    queryKey: ['candidate-assessment', token],
    queryFn: () => loadCandidateAssessment(token!),
    enabled: !!token,
  });

  useEffect(() => {
    if (assessmentInfo) {
      if (assessmentInfo.status === 'STARTED') {
        // Resume
        handleStart();
      } else if (assessmentInfo.status === 'SUBMITTED') {
        navigate(`/assess/${token}/result`, { replace: true });
      } else {
        setPhase('intro');
      }
    }
  }, [assessmentInfo]);

  const startMutation = useMutation({
    mutationFn: () => startCandidateAttempt(token!),
    onSuccess: (data) => {
      setExamData(data);
      setTimeLeft(data.timeLimit * 60);
      setPhase('exam');
    },
    onError: () => setPhase('intro'),
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      const payload = (examData?.questions ?? []).map((q) => ({
        questionId: q.id,
        selectedChoices: answers[q.id] ?? [],
      }));
      return submitCandidateAttempt(token!, payload);
    },
    onSuccess: () => {
      navigate(`/assess/${token}/result`, { replace: true });
    },
  });

  const handleStart = () => {
    startMutation.mutate();
  };

  // Timer
  useEffect(() => {
    if (phase !== 'exam' || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          submitMutation.mutate();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // Anti-cheat: tab switch detection
  useEffect(() => {
    if (phase !== 'exam' || !examData?.detectTabSwitch) return;
    const handler = () => {
      if (document.hidden) {
        reportCandidateEvent(token!, 'tab_switch').catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [phase, examData?.detectTabSwitch, token]);

  // Anti-cheat: block copy/paste
  useEffect(() => {
    if (phase !== 'exam' || !examData?.blockCopyPaste) return;
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('copy', block);
    document.addEventListener('paste', block);
    document.addEventListener('cut', block);
    return () => {
      document.removeEventListener('copy', block);
      document.removeEventListener('paste', block);
      document.removeEventListener('cut', block);
    };
  }, [phase, examData?.blockCopyPaste]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const toggleChoice = (questionId: string, choiceId: string) => {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      const exists = current.includes(choiceId);
      // For now, treat all as single choice (toggle)
      return { ...prev, [questionId]: exists ? [] : [choiceId] };
    });
  };

  // Error state
  if (loadError) {
    const msg = (loadError as any)?.response?.data?.message || 'This assessment link is invalid or has expired.';
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card border-border">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
            <h1 className="text-xl font-mono font-bold mb-2">Unable to Load Assessment</h1>
            <p className="text-sm text-muted-foreground">{msg}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading
  if (isLoading || phase === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Intro
  if (phase === 'intro' && assessmentInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full bg-card border-border">
          <CardContent className="p-8">
            <ClipboardList className="h-10 w-10 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-mono font-bold text-center mb-2">
              {assessmentInfo.title}
            </h1>
            {assessmentInfo.candidateName && (
              <p className="text-center text-muted-foreground text-sm mb-4">
                Welcome, {assessmentInfo.candidateName}
              </p>
            )}
            {assessmentInfo.description && (
              <p className="text-sm text-muted-foreground mb-6">{assessmentInfo.description}</p>
            )}
            <div className="space-y-2 mb-6 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Questions</span>
                <span>{assessmentInfo.questionCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time Limit</span>
                <span>{assessmentInfo.timeLimit} minutes</span>
              </div>
              {assessmentInfo.detectTabSwitch && (
                <div className="flex items-center gap-2 text-amber-400 text-xs mt-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Tab switching will be monitored
                </div>
              )}
            </div>
            <Button
              className="w-full glow-cyan"
              size="lg"
              onClick={handleStart}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Start Assessment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Exam
  if (phase === 'exam' && examData) {
    const questions = examData.questions;
    const current = questions[currentIndex];
    const answered = Object.keys(answers).filter((k) => answers[k].length > 0).length;

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <span className="text-sm font-mono text-muted-foreground">
              {currentIndex + 1} / {questions.length}
            </span>
            <span className="text-sm font-mono font-bold flex items-center gap-1.5">
              <Clock className={`h-4 w-4 ${timeLeft < 60 ? 'text-red-400' : 'text-primary'}`} />
              {formatTime(timeLeft)}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {answered} answered
            </span>
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
          {current && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-mono font-medium leading-relaxed">
                  {current.title}
                </h2>
                {current.description && (
                  <p className="text-sm text-muted-foreground mt-2">{current.description}</p>
                )}
              </div>

              <div className="space-y-2">
                {current.choices.map((choice) => {
                  const selected = (answers[current.id] ?? []).includes(choice.id);
                  return (
                    <button
                      key={choice.id}
                      onClick={() => toggleChoice(current.id, choice.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors text-sm font-mono ${
                        selected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-card hover:border-primary/30'
                      }`}
                    >
                      <span className="font-bold mr-2">{choice.label}.</span>
                      {choice.content}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom navigation */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => i - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>

            {currentIndex < questions.length - 1 ? (
              <Button
                size="sm"
                onClick={() => setCurrentIndex((i) => i + 1)}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                className="glow-cyan"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1.5" />
                )}
                Submit
              </Button>
            )}
          </div>

          {/* Question navigation dots */}
          <div className="flex gap-1 justify-center mt-2 flex-wrap">
            {questions.map((q, i) => {
              const hasAnswer = (answers[q.id] ?? []).length > 0;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-6 h-6 rounded text-[10px] font-mono transition-colors ${
                    i === currentIndex
                      ? 'bg-primary text-primary-foreground'
                      : hasAnswer
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Submitting
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-sm font-mono text-muted-foreground">Submitting your answers...</p>
      </div>
    </div>
  );
};

export default CandidateExam;
