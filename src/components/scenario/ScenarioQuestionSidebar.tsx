import { type ScenarioQuestion } from "@/services/scenarios";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";

interface ScenarioQuestionSidebarProps {
  questions: ScenarioQuestion[];
  activeIndex: number;
  answers: Record<string, string>;
  onNavigate: (index: number) => void;
  onAnswerChange: (questionId: string, answerId: string) => void;
  onSubmit: () => void;
}

export function ScenarioQuestionSidebar({
  questions,
  activeIndex,
  answers,
  onNavigate,
  onAnswerChange,
  onSubmit,
}: ScenarioQuestionSidebarProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set([activeIndex]),
  );

  useEffect(() => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      next.add(activeIndex);
      return next;
    });
  }, [activeIndex]);

  const toggleQuestionExpand = (index: number) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedQuestions(newExpanded);
  };

  const activeQuestion = questions[activeIndex];
  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Questions</h3>
        <div className="mb-3">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>
              Progress: {answeredCount}/{questions.length}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="flex-1 overflow-auto">
        <div className="divide-y divide-gray-200">
          {questions.map((question, index) => {
            const isActive = index === activeIndex;
            const isAnswered = answers[question.id] !== undefined;
            const isExpanded = expandedQuestions.has(index);

            return (
              <div
                key={question.id}
                className={`${isActive ? "bg-blue-50" : ""} border-l-4 ${
                  isActive ? "border-blue-600" : "border-transparent"
                }`}
              >
                {/* Question Header */}
                <button
                  onClick={() => {
                    onNavigate(index);
                    toggleQuestionExpand(index);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-start justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        Q{index + 1}
                      </span>
                      {isAnswered && (
                        <span className="inline-flex items-center justify-center w-5 h-5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {question.title}
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Question Content */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-900 mb-3">
                      {question.title}
                    </p>

                    <div className="space-y-2">
                      {question.choices.map((choice) => (
                        <label
                          key={choice.id}
                          className="flex items-start gap-3 p-2 rounded hover:bg-gray-100 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={choice.id}
                            checked={answers[question.id] === choice.id}
                            onChange={() =>
                              onAnswerChange(question.id, choice.id)
                            }
                            className="mt-1"
                          />
                          <span className="text-sm text-gray-700">
                            {choice.label}. {choice.content}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer - Submit Button */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <Button
          onClick={onSubmit}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          disabled={answeredCount === 0}
        >
          Submit Answers
        </Button>
        {answeredCount < questions.length && (
          <p className="text-xs text-gray-600 text-center mt-2">
            Answer {questions.length - answeredCount} more questions
          </p>
        )}
      </div>
    </div>
  );
}
