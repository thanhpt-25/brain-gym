import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, ArrowLeft, Clock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScenarioLeaderboard } from "@/components/scenario/ScenarioLeaderboard";
import type { ScenarioAttemptResult } from "@/services/scenarios";

interface ScenarioResultsState {
  result: ScenarioAttemptResult;
  scenarioId: string;
}

export function ScenarioResults() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ScenarioResultsState | null;

  const result = state?.result;
  const scenarioId = state?.scenarioId;

  if (!result || !scenarioId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-600">Results not found</p>
          <Button onClick={() => navigate("/")} className="font-mono">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const correctCount = Object.values(result.answers).filter(
    (answer) => answer.correct,
  ).length;
  const totalQuestions = Object.keys(result.answers).length;
  const percentage = Math.round((correctCount / totalQuestions) * 100);
  const passed = percentage >= 70;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-gray-600"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-mono text-lg font-bold text-gray-900">
              Scenario Results
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto pt-24 pb-16 px-6 space-y-6">
        {/* Score Hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-8 rounded-lg text-center border ${
            passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
          }`}
        >
          <div className="text-5xl mb-3">{passed ? "✅" : "❌"}</div>
          <div className="text-6xl font-mono font-bold mb-2 text-gray-900">
            {percentage}%
          </div>
          <div
            className={`text-lg font-mono font-semibold mb-4 ${
              passed ? "text-green-700" : "text-red-700"
            }`}
          >
            {passed ? "PASSED" : "NOT PASSED"}
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <Award className="h-4 w-4 text-gray-600" />
              <span className="text-gray-600">
                {correctCount}/{totalQuestions} correct
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-gray-600" />
              <span className="text-gray-600">
                {formatTime(result.timeSpent)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ScenarioLeaderboard scenarioId={scenarioId} />
        </motion.div>

        {/* Explanation */}
        {result.reasoningTrace && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardContent className="p-6">
                <h3 className="font-mono font-semibold mb-4 text-gray-900">
                  Feedback
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {result.reasoningTrace}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Question Review */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <h3 className="font-mono font-semibold text-gray-900">
            Question Review
          </h3>
          {Object.entries(result.answers).map(([questionId, answer], idx) => (
            <Card key={questionId}>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {answer.correct ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-mono text-sm font-semibold text-gray-900">
                      Q{idx + 1}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Your answer: {answer.selectedAnswer}
                    </div>
                    {!answer.correct && (
                      <div className="text-sm text-green-600 mt-1">
                        Correct answer: {answer.correctAnswer}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </motion.div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 flex-wrap">
          <Button
            variant="outline"
            className="flex-1 font-mono"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Home
          </Button>
          <Button
            variant="outline"
            className="flex-1 font-mono"
            onClick={() => navigate(`/scenarios/${scenarioId}`)}
          >
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
