import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getScenario, type Scenario } from "@/services/scenarios";
import { ScenarioPassage } from "./ScenarioPassage";
import { ScenarioQuestionSidebar } from "./ScenarioQuestionSidebar";

interface ScenarioReaderProps {
  scenarioId: string;
  onSubmit?: (answers: Record<string, string>) => void;
  answers?: Record<string, string>;
  onAnswerChange?: (questionId: string, answerId: string) => void;
}

export function ScenarioReader({
  scenarioId,
  onSubmit,
  answers: externalAnswers,
  onAnswerChange,
}: ScenarioReaderProps) {
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [internalAnswers, setInternalAnswers] = useState<
    Record<string, string>
  >({});
  const answers = externalAnswers ?? internalAnswers;

  const {
    data: scenario,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["scenario", scenarioId],
    queryFn: () => getScenario(scenarioId),
    enabled: !!scenarioId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <p className="text-gray-600">Loading scenario...</p>
        </div>
      </div>
    );
  }

  if (error || !scenario) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 font-semibold">Failed to load scenario</p>
          <p className="text-gray-600 text-sm mt-2">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  const handleAnswerChange = (questionId: string, answerId: string) => {
    if (onAnswerChange) {
      onAnswerChange(questionId, answerId);
    } else {
      setInternalAnswers((prev) => ({
        ...prev,
        [questionId]: answerId,
      }));
    }
  };

  const handleNavigateQuestion = (index: number) => {
    setActiveQuestionIndex(index);
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(answers);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <ScenarioPassage passage={scenario.passage} />
      </div>

      {/* Sidebar with Questions */}
      <ScenarioQuestionSidebar
        questions={scenario.questions}
        activeIndex={activeQuestionIndex}
        answers={answers}
        onNavigate={handleNavigateQuestion}
        onAnswerChange={handleAnswerChange}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
