import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Lock, Loader2, RotateCcw, ArrowRight } from "lucide-react";
import { getQuestions } from "@/services/questions";
import { Button } from "@/components/ui/button";
import { Certification } from "@/types/exam";
import { AuthPromptDialog } from "@/components/landing/AuthPromptDialog";

interface TryItQuizProps {
  certifications: Certification[];
}

const QUIZ_LENGTH = 5;

/**
 * A no-signup, 5-question taste of the real exam experience, using the
 * public GET /questions endpoint (same one StudyMode uses). Explanations
 * come back redacted for anonymous requests — that redaction is used here as
 * the hook into the sign-up flow rather than hidden away.
 */
export function TryItQuiz({ certifications }: TryItQuizProps) {
  const [certId, setCertId] = useState<string | undefined>(undefined);
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  const activeCertId = certId ?? certifications[0]?.id;

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["try-it-quiz", activeCertId],
    queryFn: () => getQuestions(activeCertId, 1, QUIZ_LENGTH),
    enabled: !!activeCertId && started,
  });

  const questions = useMemo(() => data?.data ?? [], [data]);
  const correctCount = questions.filter(
    (q) => answers[q.id] && q.choices.find((c) => c.label === answers[q.id])?.isCorrect,
  ).length;
  const isComplete = questions.length > 0 && currentIndex >= questions.length;
  const current = questions[currentIndex];
  const currentAnswer = current ? answers[current.id] : undefined;

  const selectAnswer = (questionId: string, label: string) => {
    if (answers[questionId]) return;
    setAnswers((prev) => ({ ...prev, [questionId]: label }));
  };

  const restart = () => {
    setAnswers({});
    setCurrentIndex(0);
    refetch();
  };

  if (!started) {
    return (
      <div className="glass-card p-8 text-center max-w-xl mx-auto">
        <h3 className="font-mono font-semibold text-lg mb-2">
          Try 5 questions — no account needed
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          See exactly what a real practice exam feels like before you sign up.
        </p>
        {certifications.length > 0 && (
          <select
            value={activeCertId}
            onChange={(e) => setCertId(e.target.value)}
            className="mb-6 w-full max-w-xs mx-auto block rounded-md border border-border bg-secondary px-3 py-2 text-sm font-mono"
          >
            {certifications.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <Button
          size="lg"
          className="glow-cyan font-mono"
          onClick={() => setStarted(true)}
          disabled={!activeCertId}
        >
          Start free quiz
        </Button>
      </div>
    );
  }

  if (isLoading || isFetching) {
    return (
      <div className="glass-card p-10 flex flex-col items-center gap-3 max-w-xl mx-auto">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading questions…</p>
      </div>
    );
  }

  if (isError || questions.length === 0) {
    return (
      <div className="glass-card p-8 text-center max-w-xl mx-auto">
        <p className="text-sm text-muted-foreground mb-4">
          Couldn't load a preview quiz right now.
        </p>
        <Button variant="outline" onClick={() => refetch()} className="font-mono">
          Try again
        </Button>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="glass-card p-8 text-center max-w-xl mx-auto glow-cyan">
        <div className="text-4xl font-bold font-mono text-gradient-cyan mb-2">
          {correctCount}/{questions.length}
        </div>
        <p className="text-muted-foreground mb-6">
          {correctCount === questions.length
            ? "Perfect score. Imagine what you'll do with the full question bank."
            : "Create a free account to see full explanations and track your readiness."}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            size="lg"
            className="glow-cyan font-mono"
            onClick={() => setAuthPromptOpen(true)}
          >
            Create free account
          </Button>
          <Button variant="outline" className="font-mono" onClick={restart}>
            <RotateCcw className="mr-2 h-4 w-4" /> Try another 5
          </Button>
        </div>
        <AuthPromptDialog
          open={authPromptOpen}
          onOpenChange={setAuthPromptOpen}
          redirectTo="/dashboard"
          title="Nice work — keep the streak going"
          description="Create a free account to unlock full explanations, save this score, and get a personalized readiness track."
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
        <span>
          Question {currentIndex + 1} of {questions.length}
        </span>
        <span>{correctCount} correct so far</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
          animate={{ width: `${(currentIndex / questions.length) * 100}%` }}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="glass-card p-6"
        >
          <h4 className="font-mono font-semibold mb-4">{current.title}</h4>
          <div className="space-y-2">
            {current.choices.map((choice) => {
              const isPicked = currentAnswer === choice.label;
              const showCorrectness = !!currentAnswer;
              return (
                <button
                  key={choice.label}
                  onClick={() => selectAnswer(current.id, choice.label)}
                  disabled={showCorrectness}
                  className={`w-full text-left px-4 py-3 rounded-md border text-sm transition-colors flex items-center justify-between gap-3 ${
                    showCorrectness && choice.isCorrect
                      ? "border-accent/50 bg-accent/10"
                      : showCorrectness && isPicked && !choice.isCorrect
                        ? "border-destructive/50 bg-destructive/10"
                        : "border-border hover:border-primary/40"
                  }`}
                >
                  <span>{choice.content}</span>
                  {showCorrectness && choice.isCorrect && (
                    <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                  )}
                  {showCorrectness && isPicked && !choice.isCorrect && (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
          {currentAnswer && (
            <div className="mt-4 pt-4 border-t border-border">
              {current.explanation?.toLowerCase().includes("log in to view") ? (
                <button
                  onClick={() => setAuthPromptOpen(true)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Sign up free to see the full explanation
                </button>
              ) : (
                <p className="text-sm text-muted-foreground">{current.explanation}</p>
              )}
              <Button
                className="mt-4 font-mono"
                onClick={() => setCurrentIndex((i) => i + 1)}
              >
                {currentIndex + 1 === questions.length ? "See results" : "Next question"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <AuthPromptDialog
        open={authPromptOpen}
        onOpenChange={setAuthPromptOpen}
        redirectTo="/dashboard"
      />
    </div>
  );
}
