import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface ScenarioTimerProps {
  timeLimit?: number;
  onTimeOut?: () => void;
}

export function ScenarioTimer({
  timeLimit = 900,
  onTimeOut,
}: ScenarioTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);

  useEffect(() => {
    if (timeRemaining <= 0) {
      onTimeOut?.();
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;
        if (newTime === 0) {
          onTimeOut?.();
        }
        return Math.max(0, newTime);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, onTimeOut]);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isWarning = timeRemaining <= 300; // 5 minutes
  const isCritical = timeRemaining <= 60; // 1 minute

  const formatTime = () => {
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  return (
    <div className="px-6 py-3 flex items-center justify-between">
      <div className="flex-1">
        <h1 className="text-xl font-semibold text-gray-900">Scenario Exam</h1>
      </div>

      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
          isCritical
            ? "bg-red-100 text-red-700"
            : isWarning
              ? "bg-yellow-100 text-yellow-700"
              : "bg-gray-100 text-gray-700"
        }`}
      >
        <Clock className="w-5 h-5" />
        <span className="font-mono font-semibold text-lg">{formatTime()}</span>
      </div>
    </div>
  );
}
