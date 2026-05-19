import { useParams, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  submitScenarioAttempt,
  type ScenarioAttemptResult,
} from "@/services/scenarios";
import { ScenarioReader } from "@/components/scenario/ScenarioReader";
import { ScenarioTimer } from "@/components/scenario/ScenarioTimer";

export function ScenarioExam() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const submitMutation = useMutation({
    mutationFn: (data: Record<string, string>) => {
      if (!scenarioId) throw new Error("Scenario ID not found");
      return submitScenarioAttempt(scenarioId, data);
    },
    onSuccess: (result: ScenarioAttemptResult) => {
      setTimeout(() => {
        navigate(`/scenarios/${scenarioId}/results`, {
          state: { result, scenarioId },
        });
      }, 1000);
    },
    onError: (error: Error) => {
      console.error("Failed to submit scenario:", error);
    },
  });

  const handleSubmit = (submittedAnswers: Record<string, string>) => {
    submitMutation.mutate(submittedAnswers);
  };

  const handleTimeOut = () => {
    submitMutation.mutate(answers);
  };

  if (!scenarioId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">Scenario not found</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Timer - Fixed to top */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-10">
        <ScenarioTimer onTimeOut={handleTimeOut} />
      </div>

      {/* Main Content - Offset by timer height */}
      <div className="pt-16 h-screen overflow-hidden">
        <ScenarioReader
          scenarioId={scenarioId}
          onSubmit={handleSubmit}
          answers={answers}
          onAnswerChange={(questionId, answerId) => {
            setAnswers((prev) => ({
              ...prev,
              [questionId]: answerId,
            }));
          }}
        />
      </div>

      {/* Loading Overlay */}
      {submitMutation.isPending && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
            <p className="text-gray-900 font-semibold">Submitting answers...</p>
          </div>
        </div>
      )}
    </div>
  );
}
