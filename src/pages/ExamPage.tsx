import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCertificationById } from "@/services/certifications";
import { getQuestions } from "@/services/questions";
import {
  startAttempt,
  submitAttempt,
  checkAnswer,
  getActiveAttempt,
  getAttemptState,
  getAttemptResult,
  abandonAttempt,
  AttemptState,
  StartAttemptResponse,
  AttemptResult,
  AttemptQuestion,
  CheckAnswerResponse,
} from "@/services/attempts";
import { createPracticeExam } from "@/services/exams";
import { captureWord } from "@/services/flashcards";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ExamIntro } from "@/components/exam/ExamIntro";
import { ExamSession } from "@/components/exam/ExamSession";
import { ExamResult } from "@/components/exam/ExamResult";
import { WordCaptureTooltip } from "@/components/exam/WordCaptureTooltip";
import { useTimer } from "@/hooks/useTimer";
import { useAutosave } from "@/hooks/useAutosave";
import { useQuestionTimer } from "@/hooks/useQuestionTimer";
import { useTextSelection } from "@/hooks/useTextSelection";
import { attemptDeadline, getPracticeExamPlan } from "@/lib/exam-plan";
import type { FeedbackMode, TimerMode } from "@/types/api-types";
import {
  loadFeedbackModePreference,
  saveFeedbackModePreference,
  supportsInteractive,
} from "@/lib/exam-feedback-mode";

type ExamPhase = "intro" | "loading" | "exam" | "result";

interface LocationState {
  attemptData?: StartAttemptResponse;
}

const ExamPage = () => {
  const { certId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const passedAttempt = (location.state as LocationState)?.attemptData;

  const { data: cert, isLoading: certLoading } = useQuery({
    queryKey: ["certification", certId],
    queryFn: () => getCertificationById(certId!),
    enabled: !!certId,
  });

  const { data: questionsData } = useQuery({
    queryKey: ["questions-count", certId],
    queryFn: () => getQuestions(certId, 1, 1),
    enabled: !!certId,
  });

  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<ExamPhase>(
    passedAttempt ? "exam" : "intro",
  );
  const [attemptData, setAttemptData] = useState<StartAttemptResponse | null>(
    passedAttempt ?? null,
  );
  const [totalSeconds, setTotalSeconds] = useState<number>(
    passedAttempt ? passedAttempt.timeLimit * 60 : 0,
  );
  const [deadline, setDeadline] = useState<number | null>(() =>
    // location.state survives reloads, so its serverNow may be stale: skip
    // the skew correction until the server sync below refreshes it.
    passedAttempt
      ? attemptDeadline({ ...passedAttempt, serverNow: undefined })
      : null,
  );
  const [selectedTimerMode, setSelectedTimerMode] =
    useState<TimerMode>("STRICT");
  const [selectedFeedbackMode, setSelectedFeedbackMode] =
    useState<FeedbackMode>(loadFeedbackModePreference);
  // Interactive is unavailable with Time Pressure; the stored preference is
  // kept so it comes back when another timer mode is picked.
  const effectiveFeedbackMode: FeedbackMode = supportsInteractive(
    selectedTimerMode,
  )
    ? selectedFeedbackMode
    : "END_OF_EXAM";
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<AttemptResult | null>(null);
  // INTERACTIVE mode: revealed answers (locked) keyed by questionId.
  const [feedback, setFeedback] = useState<
    Record<string, CheckAnswerResponse>
  >({});
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const questions: AttemptQuestion[] = attemptData?.questions ?? [];
  const poolSize = questionsData?.meta?.total ?? 0;
  const plan = getPracticeExamPlan(poolSize, selectedTimerMode);
  const isInteractive = attemptData?.feedbackMode === "INTERACTIVE";

  // Answers/flags are saved as the learner goes (END_OF_EXAM only;
  // INTERACTIVE answers are saved when checked).
  const {
    status: saveStatus,
    queue: queueSave,
    flush: flushSaves,
    cancel: cancelSaves,
  } = useAutosave(
    attemptData?.attemptId ?? null,
    phase === "exam" && !isInteractive,
  );

  // Time actually spent on each question (for the pace analysis).
  const { secondsOn, seed: seedQuestionTimes } = useQuestionTimer(
    questions[currentIndex]?.id ?? null,
    phase === "exam",
  );

  const { data: activeAttempt, refetch: refetchActive } = useQuery({
    queryKey: ["active-attempt", cert?.id],
    queryFn: async () => (await getActiveAttempt(cert!.id)) ?? null,
    enabled: !!cert?.id && phase === "intro",
  });

  /** Load an attempt (fresh or resumed) into the exam screen. */
  const applyAttempt = useCallback(
    (attempt: StartAttemptResponse, saved?: AttemptState) => {
      const restoredAnswers: Record<string, string[]> = {};
      const restoredMarks = new Set<string>();
      const restoredTimes: Record<string, number> = {};
      for (const a of saved?.answers ?? []) {
        if (a.selectedChoices.length) restoredAnswers[a.questionId] = a.selectedChoices;
        if (a.isMarked) restoredMarks.add(a.questionId);
        if (a.timeSpent) restoredTimes[a.questionId] = a.timeSpent;
      }
      seedQuestionTimes(restoredTimes);
      const restoredFeedback: Record<string, CheckAnswerResponse> = {};
      for (const c of saved?.checked ?? []) {
        restoredFeedback[c.questionId] = c;
        restoredAnswers[c.questionId] = c.selectedChoiceIds;
      }
      // Pick up at the first question not answered yet.
      const firstOpen = attempt.questions.findIndex(
        (q) => !restoredAnswers[q.id]?.length,
      );

      setAttemptData(attempt);
      setTotalSeconds(attempt.timeLimit * 60);
      setDeadline(attemptDeadline(attempt));
      setAnswers(restoredAnswers);
      setMarked(restoredMarks);
      setFeedback(restoredFeedback);
      setCurrentIndex(saved && firstOpen > 0 ? firstOpen : 0);
      setResult(null);
      setPhase("exam");
    },
    [seedQuestionTimes],
  );

  /**
   * Continue an attempt from the server's copy. Returns false when the
   * attempt can't be continued (it was submitted, expired or abandoned).
   */
  const loadSavedAttempt = useCallback(
    async (attemptId: string): Promise<boolean> => {
      const state = await getAttemptState(attemptId);
      if (!state) throw new Error("No attempt state");
      if (state.status === "IN_PROGRESS" && state.questions) {
        applyAttempt(state as StartAttemptResponse, state);
        return true;
      }
      if (state.status === "SUBMITTED") {
        // Time ran out while away: the server graded the saved answers.
        const res = await getAttemptResult(attemptId);
        setResult(res);
        setPhase("result");
        toast.info("Time ran out — your saved answers were graded.");
        return true;
      }
      return false;
    },
    [applyAttempt],
  );

  // Arriving with an attempt in the location state (exam library, share
  // link) — also after a reload: sync with the server so saved answers and
  // the real deadline are restored.
  const syncedPassedAttempt = useRef(false);
  useEffect(() => {
    if (!passedAttempt || syncedPassedAttempt.current) return;
    syncedPassedAttempt.current = true;
    loadSavedAttempt(passedAttempt.attemptId)
      .then((ok) => {
        if (!ok) {
          toast.info("This attempt has already ended.");
          setAttemptData(null);
          setPhase("intro");
        }
      })
      .catch(() => {
        // Keep the attempt we were handed; autosave/submit still work.
      });
  }, [passedAttempt, loadSavedAttempt]);

  const handleSubmit = useCallback(async () => {
    if (!attemptData) return;
    setPhase("loading");
    try {
      // The payload carries every answer; drop pending autosaves so none
      // lands after the attempt is graded.
      await cancelSaves();
      const payload = {
        answers: questions.map((q) => ({
          questionId: q.id,
          selectedChoices: answers[q.id] || [],
          isMarked: marked.has(q.id),
          timeSpent: secondsOn(q.id),
        })),
      };
      const res = await submitAttempt(attemptData.attemptId, payload);
      setResult(res);
      setPhase("result");
      queryClient.invalidateQueries({ queryKey: ["active-attempt"] });
    } catch (err: unknown) {
      toast.error("Failed to submit exam");
      setPhase("exam");
    }
  }, [attemptData, answers, questions, marked, cancelSaves, queryClient, secondsOn]);

  const handleExpire = useCallback(() => {
    toast.info("Time's up — submitting your exam.");
    handleSubmit();
  }, [handleSubmit]);

  const { timeLeft } = useTimer({
    deadline,
    isActive: phase === "exam",
    onExpire: handleExpire,
  });

  // Leaving mid-exam: ask first (answers are saved, but the clock keeps running).
  useEffect(() => {
    if (phase !== "exam") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      void flushSaves();
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase, flushSaves]);

  const { selection, clearSelection } = useTextSelection(phase === "exam");

  const startExam = async (
    timerMode: TimerMode = selectedTimerMode,
    feedbackMode: FeedbackMode = effectiveFeedbackMode,
  ) => {
    if (!cert) return;
    setPhase("loading");
    try {
      // Starting over replaces the attempt that was left unfinished.
      if (activeAttempt) {
        await abandonAttempt(activeAttempt.attemptId).catch(() => undefined);
      }
      const examPlan = getPracticeExamPlan(poolSize, timerMode);
      // A private draw weighted by the certification's domains, favouring
      // questions the learner hasn't seen or got wrong.
      const exam = await createPracticeExam({
        certificationId: cert.id,
        questionCount: examPlan.questionCount,
        timeLimit: examPlan.timeLimit,
        timerMode,
      });

      const attempt = await startAttempt(exam.id, { feedbackMode });
      applyAttempt(attempt);
    } catch (err: unknown) {
      toast.error("Failed to start exam");
      setPhase("intro");
    }
  };

  const resumeExam = async () => {
    if (!activeAttempt) return;
    setPhase("loading");
    try {
      if (!(await loadSavedAttempt(activeAttempt.attemptId))) {
        toast.info("This attempt has already ended.");
        setPhase("intro");
        refetchActive();
      }
    } catch {
      toast.error("Could not resume the exam");
      setPhase("intro");
    }
  };

  const discardActive = async () => {
    if (!activeAttempt) return;
    try {
      await abandonAttempt(activeAttempt.attemptId);
    } catch {
      // Already closed — the refetch below reflects that.
    }
    refetchActive();
  };

  const selectAnswer = (questionId: string, choiceId: string) => {
    // A checked answer is locked (the server rejects changes too).
    if (feedback[questionId]) return;
    const current = answers[questionId] || [];
    const question = questions.find((q) => q.id === questionId);
    let next: string[];
    if (question?.questionType === "MULTIPLE") {
      if (current.includes(choiceId)) {
        next = current.filter((id) => id !== choiceId);
      } else if (
        question.selectCount &&
        current.length >= question.selectCount
      ) {
        // "Choose N": deselect one before picking another.
        return;
      } else {
        next = [...current, choiceId];
      }
    } else {
      next = [choiceId];
    }
    setAnswers((prev) => ({ ...prev, [questionId]: next }));
    queueSave({
      questionId,
      selectedChoices: next,
      isMarked: marked.has(questionId),
      timeSpent: secondsOn(questionId),
    });
  };

  /**
   * Move to another question. The one being left is saved with its time so
   * far when it already has an answer or flag (unanswered questions are not
   * written, so an untouched attempt still counts as abandoned).
   */
  const goToQuestion = (value: number | ((prev: number) => number)) => {
    const leaving = questions[currentIndex];
    if (
      leaving &&
      !isInteractive &&
      (answers[leaving.id]?.length || marked.has(leaving.id))
    ) {
      queueSave({
        questionId: leaving.id,
        selectedChoices: answers[leaving.id] || [],
        isMarked: marked.has(leaving.id),
        timeSpent: secondsOn(leaving.id),
      });
    }
    setCurrentIndex(value);
  };

  const handleCheck = async (questionId: string) => {
    const selectedChoices = answers[questionId] || [];
    if (
      !attemptData ||
      checkingId ||
      feedback[questionId] ||
      selectedChoices.length === 0
    )
      return;
    setCheckingId(questionId);
    try {
      const res = await checkAnswer(attemptData.attemptId, {
        questionId,
        selectedChoices,
        isMarked: marked.has(questionId),
        timeSpent: secondsOn(questionId),
      });
      setFeedback((prev) => ({ ...prev, [questionId]: res }));
    } catch (err: unknown) {
      const response = (
        err as {
          response?: {
            status?: number;
            data?: { result?: CheckAnswerResponse };
          };
        }
      )?.response;
      const stored = response?.data?.result;
      if (response?.status === 409 && stored) {
        // Already checked (e.g. the page was reloaded): restore the verdict
        // and the answer the server locked.
        setFeedback((prev) => ({ ...prev, [questionId]: stored }));
        setAnswers((prev) => ({
          ...prev,
          [questionId]: stored.selectedChoiceIds,
        }));
      } else {
        toast.error("Could not check answer. Please try again.");
      }
    } finally {
      setCheckingId(null);
    }
  };

  const handleFeedbackModeChange = (mode: FeedbackMode) => {
    setSelectedFeedbackMode(mode);
    saveFeedbackModePreference(mode);
  };

  const toggleMark = (questionId: string) => {
    const isMarked = !marked.has(questionId);
    setMarked((prev) => {
      const next = new Set(prev);
      if (isMarked) next.add(questionId);
      else next.delete(questionId);
      return next;
    });
    queueSave({
      questionId,
      selectedChoices: answers[questionId] || [],
      isMarked,
      timeSpent: secondsOn(questionId),
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
        context:
          currentQuestion.title +
          (currentQuestion.description
            ? " " + currentQuestion.description
            : ""),
      });
      toast.success(`Saved "${selection.text}" for review`);
      clearSelection();
    } catch (err) {
      toast.error("Failed to capture word");
    }
  };

  if (certLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cert)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        Certification not found
      </div>
    );

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-background bg-grid flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-mono">
            Preparing your exam...
          </p>
        </div>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <ExamIntro
        cert={cert}
        questionCount={plan.questionCount}
        timeLimitMinutes={plan.effectiveMinutes}
        activeAttempt={activeAttempt ?? null}
        onResume={resumeExam}
        onDiscardActive={discardActive}
        timerMode={selectedTimerMode}
        onTimerModeChange={setSelectedTimerMode}
        feedbackMode={effectiveFeedbackMode}
        onFeedbackModeChange={handleFeedbackModeChange}
        onBack={() => navigate("/")}
        onStart={() => startExam(selectedTimerMode, effectiveFeedbackMode)}
      />
    );
  }

  if (phase === "result" && result) {
    return (
      <ExamResult
        result={result}
        onRetry={() => {
          setPhase("intro");
          setResult(null);
        }}
        onHome={() => navigate("/")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {attemptData && (
        <ExamSession
          attemptData={attemptData}
          questions={questions}
          currentIndex={currentIndex}
          setCurrentIndex={goToQuestion}
          answers={answers}
          selectAnswer={selectAnswer}
          marked={marked}
          toggleMark={toggleMark}
          timeLeft={timeLeft}
          totalSeconds={totalSeconds}
          onSubmit={handleSubmit}
          saveStatus={isInteractive ? undefined : saveStatus}
          feedback={feedback}
          checkingId={checkingId}
          onCheck={handleCheck}
        />
      )}

      {phase === "exam" && (
        <WordCaptureTooltip selection={selection} onCapture={handleCapture} />
      )}
    </div>
  );
};

export default ExamPage;
