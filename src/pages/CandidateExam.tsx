import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  loadCandidateAssessment,
  startCandidateAttempt,
  submitCandidateAttempt,
  reportCandidateEvent,
  requestCandidateOtp,
  verifyCandidateOtp,
} from '@/services/assessments';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Loader2, Clock, AlertTriangle, ChevronLeft, ChevronRight,
  Send, ClipboardList, Maximize, Mail, ShieldAlert,
} from 'lucide-react';
import type { CandidateExamPayload } from '@/types/assessment-types';

type Phase = 'loading' | 'intro' | 'otp' | 'exam' | 'submitting';

const CandidateExam = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [examData, setExamData] = useState<CandidateExamPayload | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();

  const { data: assessmentInfo, error: loadError, isLoading } = useQuery({
    queryKey: ['candidate-assessment', token],
    queryFn: () => loadCandidateAssessment(token!),
    enabled: !!token,
  });

  const startMutation = useMutation({
    mutationFn: () => startCandidateAttempt(token!),
    onSuccess: (data) => {
      setExamData(data);
      setTimeLeft(data.timeLimit * 60);
      setPhase('exam');
      if (data.requireFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
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
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      navigate(`/assess/${token}/result`, { replace: true });
    },
  });

  const requestOtpMutation = useMutation({
    mutationFn: () => requestCandidateOtp(token!),
    onSuccess: () => {
      setOtpSent(true);
      startOtpCooldown();
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: () => verifyCandidateOtp(token!, otpCode),
    onSuccess: () => startMutation.mutate(),
  });

  const startOtpCooldown = () => {
    setOtpResendCooldown(60);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setOtpResendCooldown((c) => {
        if (c <= 1) { clearInterval(cooldownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  // Fix #10: useCallback so useEffect dep array is stable and doesn't stale-close
  const handleStart = useCallback(() => {
    if (assessmentInfo?.requireOtp && !assessmentInfo.otpVerifiedAt) {
      setPhase('otp');
      if (!otpSent) requestOtpMutation.mutate();
    } else {
      startMutation.mutate();
    }
  }, [assessmentInfo, otpSent, requestOtpMutation, startMutation]);

  useEffect(() => {
    if (!assessmentInfo) return;
    if (assessmentInfo.status === 'STARTED') {
      handleStart();
    } else if (assessmentInfo.status === 'SUBMITTED') {
      navigate(`/assess/${token}/result`, { replace: true });
    } else {
      setPhase('intro');
    }
  }, [assessmentInfo, handleStart, navigate, token]);

  // Timer
  useEffect(() => {
    if (phase !== 'exam' || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current); submitMutation.mutate(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // Fullscreen exit detection
  useEffect(() => {
    if (phase !== 'exam' || !examData?.requireFullscreen) return;
    const handler = () => {
      if (!document.fullscreenElement) {
        setFullscreenWarning(true);
        reportCandidateEvent(token!, 'FULLSCREEN_EXIT').catch(() => {});
      } else {
        setFullscreenWarning(false);
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [phase, examData?.requireFullscreen, token]);

  // Window blur
  useEffect(() => {
    if (phase !== 'exam') return;
    const handler = () => reportCandidateEvent(token!, 'BLUR').catch(() => {});
    window.addEventListener('blur', handler);
    return () => window.removeEventListener('blur', handler);
  }, [phase, token]);

  // Tab switch
  useEffect(() => {
    if (phase !== 'exam' || !examData?.detectTabSwitch) return;
    const handler = () => {
      if (document.hidden) reportCandidateEvent(token!, 'TAB_SWITCH').catch(() => {});
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [phase, examData?.detectTabSwitch, token]);

  // Block + report copy/paste
  useEffect(() => {
    if (phase !== 'exam' || !examData?.blockCopyPaste) return;
    const blockCopy = (e: Event) => { e.preventDefault(); reportCandidateEvent(token!, 'COPY').catch(() => {}); };
    const blockPaste = (e: Event) => { e.preventDefault(); reportCandidateEvent(token!, 'PASTE').catch(() => {}); };
    const blockCut = (e: Event) => e.preventDefault();
    document.addEventListener('copy', blockCopy);
    document.addEventListener('paste', blockPaste);
    document.addEventListener('cut', blockCut);
    return () => {
      document.removeEventListener('copy', blockCopy);
      document.removeEventListener('paste', blockPaste);
      document.removeEventListener('cut', blockCut);
    };
  }, [phase, examData?.blockCopyPaste, token]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(cooldownRef.current);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const toggleChoice = (questionId: string, choiceId: string) => {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      return { ...prev, [questionId]: current.includes(choiceId) ? [] : [choiceId] };
    });
  };

  // ─── Error ──────────────────────────────────────────────────────────────────
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

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading || phase === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── OTP ─────────────────────────────────────────────────────────────────────
  if (phase === 'otp' && assessmentInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card border-border">
          <CardContent className="p-8">
            <Mail className="h-10 w-10 text-primary mx-auto mb-4" />
            <h1 className="text-xl font-mono font-bold text-center mb-2">Verify Your Email</h1>
            <p className="text-sm text-muted-foreground text-center mb-6">
              {otpSent ? (
                <>A 6-digit code was sent to <span className="text-foreground font-mono">{assessmentInfo.candidateEmail}</span>.</>
              ) : 'Sending verification code...'}
            </p>

            <div className="space-y-4">
              <Input
                placeholder="Enter 6-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="font-mono text-center text-lg tracking-widest"
                maxLength={6}
                onKeyDown={(e) => e.key === 'Enter' && otpCode.length === 6 && verifyOtpMutation.mutate()}
              />

              {verifyOtpMutation.isError && (
                <p className="text-xs text-red-400 text-center">
                  {(verifyOtpMutation.error as any)?.response?.data?.message ?? 'Invalid or expired code'}
                </p>
              )}

              <Button
                className="w-full glow-cyan"
                onClick={() => verifyOtpMutation.mutate()}
                disabled={otpCode.length !== 6 || verifyOtpMutation.isPending || startMutation.isPending}
              >
                {(verifyOtpMutation.isPending || startMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Verify & Start
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => requestOtpMutation.mutate()}
                disabled={otpResendCooldown > 0 || requestOtpMutation.isPending}
              >
                {otpResendCooldown > 0 ? `Resend in ${otpResendCooldown}s` : 'Resend code'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Intro ────────────────────────────────────────────────────────────────────
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
              {assessmentInfo.requireFullscreen && (
                <div className="flex items-center gap-2 text-amber-400 text-xs">
                  <Maximize className="h-3.5 w-3.5" />
                  Fullscreen mode is required
                </div>
              )}
              {assessmentInfo.requireOtp && (
                <div className="flex items-center gap-2 text-blue-400 text-xs">
                  <Mail className="h-3.5 w-3.5" />
                  Email verification required
                </div>
              )}
            </div>
            <Button
              className="w-full glow-cyan"
              size="lg"
              onClick={handleStart}
              disabled={startMutation.isPending || requestOtpMutation.isPending}
            >
              {(startMutation.isPending || requestOtpMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Start Assessment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Exam ─────────────────────────────────────────────────────────────────────
  if (phase === 'exam' && examData) {
    const questions = examData.questions;
    const current = questions[currentIndex];
    const answered = Object.keys(answers).filter((k) => answers[k].length > 0).length;

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {fullscreenWarning && (
          <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-400 text-xs font-mono">
              <ShieldAlert className="h-4 w-4" />
              Fullscreen exited — this has been recorded.
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-red-500/40 text-red-400 h-7"
              onClick={() => document.documentElement.requestFullscreen().catch(() => {})}
            >
              <Maximize className="h-3 w-3 mr-1" /> Restore
            </Button>
          </div>
        )}

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
              <Button size="sm" onClick={() => setCurrentIndex((i) => i + 1)}>
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

  // ─── Submitting ───────────────────────────────────────────────────────────────
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
