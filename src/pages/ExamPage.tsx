import { useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCertificationById } from '@/services/certifications';
import { getQuestions } from '@/services/questions';
import { startAttempt, submitAttempt, StartAttemptResponse, AttemptResult, AttemptQuestion } from '@/services/attempts';
import { createExam } from '@/services/exams';
import { captureWord } from '@/services/flashcards';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ExamIntro } from '@/components/exam/ExamIntro';
import { ExamSession } from '@/components/exam/ExamSession';
import { ExamResult } from '@/components/exam/ExamResult';
import { WordCaptureTooltip } from '@/components/exam/WordCaptureTooltip';
import { useTimer } from '@/hooks/useTimer';
import { useTextSelection } from '@/hooks/useTextSelection';
import type { TimerMode } from '@/types/api-types';

type ExamPhase = 'intro' | 'loading' | 'exam' | 'result';

interface LocationState {
  attemptData?: StartAttemptResponse;
}

const ExamPage = () => {
  const { certId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const passedAttempt = (location.state as LocationState)?.attemptData;

  const { data: cert, isLoading: certLoading } = useQuery({
    queryKey: ['certification', certId],
    queryFn: () => getCertificationById(certId!),
    enabled: !!certId,
  });

  const { data: questionsData } = useQuery({
    queryKey: ['questions-count', certId],
    queryFn: () => getQuestions(certId, 1, 1),
    enabled: !!certId,
  });

  const [phase, setPhase] = useState<ExamPhase>(passedAttempt ? 'exam' : 'intro');
  const [attemptData, setAttemptData] = useState<StartAttemptResponse | null>(passedAttempt ?? null);
  const [totalSeconds, setTotalSeconds] = useState<number>(passedAttempt ? passedAttempt.timeLimit * 60 : 0);
  const [selectedTimerMode, setSelectedTimerMode] = useState<TimerMode>('STRICT');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<AttemptResult | null>(null);

  const questions: AttemptQuestion[] = attemptData?.questions ?? [];
  const questionCount = questionsData?.meta?.total ?? 0;

  const handleSubmit = useCallback(async () => {
    if (!attemptData) return;
    setPhase('loading');
    try {
      const payload = {
        answers: questions.map(q => ({
          questionId: q.id,
          selectedChoices: answers[q.id] || [],
          isMarked: marked.has(q.id),
        })),
      };
      const res = await submitAttempt(attemptData.attemptId, payload);
      setResult(res);
      setPhase('result');
    } catch (err: unknown) {
      toast.error('Failed to submit exam');
      setPhase('exam');
    }
  }, [attemptData, answers, questions, marked]);

  const { timeLeft, setTimeLeft } = useTimer({
    initialSeconds: passedAttempt ? passedAttempt.timeLimit * 60 : 0,
    isActive: phase === 'exam',
    onExpire: handleSubmit,
  });

  const { selection, clearSelection } = useTextSelection(phase === 'exam');

  const startExam = async (timerMode: TimerMode = selectedTimerMode) => {
    if (!cert) return;
    setPhase('loading');
    try {
      const exam = await createExam({
        title: `${cert.code} Practice Exam`,
        certificationId: cert.id,
        questionCount: Math.min(questionCount, 65),
        timeLimit: 130,
        timerMode,
      });

      const attempt = await startAttempt(exam.id);
      setAttemptData(attempt);
      const secs = attempt.timeLimit * 60;
      setTotalSeconds(secs);
      setTimeLeft(secs);
      setAnswers({});
      setMarked(new Set());
      setCurrentIndex(0);
      setResult(null);
      setPhase('exam');
    } catch (err: unknown) {
      toast.error('Failed to start exam');
      setPhase('intro');
    }
  };

  const selectAnswer = (questionId: string, choiceId: string) => {
    setAnswers(prev => {
      const current = prev[questionId] || [];
      const question = questions.find(q => q.id === questionId);
      const isMultiple = question?.questionType === 'MULTIPLE';
      if (isMultiple) {
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

  const handleCapture = async () => {
    if (!selection || !attemptData || !questions[currentIndex]) return;
    const currentQuestion = questions[currentIndex];
    
    try {
      await captureWord({
        word: selection.text,
        examAttemptId: attemptData.attemptId,
        questionId: currentQuestion.id,
        context: currentQuestion.title + (currentQuestion.description ? " " + currentQuestion.description : ""),
      });
      toast.success(`Saved "${selection.text}" for review`);
      clearSelection();
    } catch (err) {
      toast.error('Failed to capture word');
    }
  };

  if (certLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cert) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Certification not found</div>;

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-background bg-grid flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-mono">Preparing your exam...</p>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <ExamIntro
        cert={cert}
        questionCount={questionCount}
        timerMode={selectedTimerMode}
        onTimerModeChange={setSelectedTimerMode}
        onBack={() => navigate('/')}
        onStart={() => startExam(selectedTimerMode)}
      />
    );
  }

  if (phase === 'result' && result) {
    return <ExamResult result={result} onRetry={() => { setPhase('intro'); setResult(null); }} onHome={() => navigate('/')} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {attemptData && (
        <ExamSession
          attemptData={attemptData}
          questions={questions}
          currentIndex={currentIndex}
          setCurrentIndex={setCurrentIndex}
          answers={answers}
          selectAnswer={selectAnswer}
          marked={marked}
          toggleMark={toggleMark}
          timeLeft={timeLeft}
          totalSeconds={totalSeconds}
          onSubmit={handleSubmit}
        />
      )}
      
      {phase === 'exam' && (
        <WordCaptureTooltip selection={selection} onCapture={handleCapture} />
      )}
    </div>
  );
};

export default ExamPage;
