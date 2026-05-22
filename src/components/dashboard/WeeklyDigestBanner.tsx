import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import api from "@/services/api";
import { X, AlertCircle, TrendingDown, Clock } from "lucide-react";

interface WeeklyInsight {
  id: string;
  week: string;
  userWeakArea: string;
  readingTimeMinutes: number;
  recommendedAction: string;
  generatedAt: string;
}

export function WeeklyDigestBanner() {
  const [isOptedOut, setIsOptedOut] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const { data: digest, isLoading } = useQuery({
    queryKey: ["weekly-digest"],
    queryFn: async () => {
      const response = await api.get("/insights/digest/latest");
      return response.data as WeeklyInsight;
    },
    retry: 1,
  });

  const optOutMutation = useMutation({
    mutationFn: async () => {
      await api.post("/user/settings/digest-opt-out", {
        optOut: true,
      });
    },
    onSuccess: () => {
      setIsOptedOut(true);
    },
  });

  if (isLoading || !digest || isOptedOut) {
    return null;
  }

  return (
    <div className="relative mb-6 overflow-hidden rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm">
      {/* Close button */}
      <button
        onClick={() => optOutMutation.mutate()}
        className="absolute top-4 right-4 p-1 hover:bg-amber-100 rounded transition-colors"
        aria-label="Dismiss and opt-out"
        title="Click to dismiss and opt-out of weekly digests"
      >
        <X className="h-4 w-4 text-amber-600" />
      </button>

      {/* Banner content */}
      <div className="pr-8">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 mb-1">
              Weekly Learning Insight
            </h3>
            <p className="text-sm text-amber-800 mb-3">
              This week you struggled with{" "}
              <span className="font-medium">{digest.userWeakArea}</span> when
              studying for more than{" "}
              <span className="font-medium">{digest.readingTimeMinutes} min</span>.
            </p>

            {/* Quick stats */}
            <div className="flex gap-4 mb-3">
              <div className="flex items-center gap-1 text-xs text-amber-700">
                <TrendingDown className="h-4 w-4" />
                {digest.userWeakArea}
              </div>
              <div className="flex items-center gap-1 text-xs text-amber-700">
                <Clock className="h-4 w-4" />
                {digest.readingTimeMinutes}+ minutes
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm px-3 py-1 rounded hover:bg-amber-100 text-amber-700 font-medium transition-colors"
              >
                {showDetails ? "Hide" : "View"} Recommendation
              </button>
              <button
                onClick={() => optOutMutation.mutate()}
                disabled={optOutMutation.isPending}
                className="text-sm px-3 py-1 rounded hover:bg-amber-100 text-amber-700 transition-colors disabled:opacity-50"
              >
                Opt-out
              </button>
            </div>

            {/* Expandable recommendation */}
            {showDetails && (
              <div className="mt-3 p-3 bg-white rounded border border-amber-100">
                <p className="text-sm text-gray-700">
                  {digest.recommendedAction}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
