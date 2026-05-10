import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import {
  getPassLikelihoodStatus,
  submitPassLikelihood,
  PassLikelihoodStatus,
} from "../../services/surveys";

interface PassLikelihoodSurveyBannerProps {
  certificationId: string;
}

export function PassLikelihoodSurveyBanner({
  certificationId,
}: PassLikelihoodSurveyBannerProps) {
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: status, isLoading, isError } = useQuery<PassLikelihoodStatus>({
    queryKey: ["pass-likelihood-status", certificationId],
    queryFn: () => getPassLikelihoodStatus(certificationId),
    enabled: !!certificationId,
  });

  const { mutate: submit, isPending, isSuccess } = useMutation({
    mutationFn: (score: number) => submitPassLikelihood(certificationId, score),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["pass-likelihood-status", certificationId],
      });
      setSelectedScore(null);
    },
  });

  if (isLoading) {
    return null;
  }

  // Prevent rendering if there's an error fetching status or already submitted
  if (isError || !status || status.submitted || isSuccess) {
    return null;
  }

  return (
    <Alert className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
      <AlertTitle className="text-blue-900 dark:text-blue-100">
        How confident are you?
      </AlertTitle>
      <AlertDescription className="text-blue-800 dark:text-blue-200">
        <p className="mb-4">
          On a scale of 1-10, how likely are you to pass this certification on
          your first attempt?
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
            <button
              key={score}
              onClick={() => setSelectedScore(score)}
              className={`px-3 py-2 rounded border transition-colors ${
                selectedScore === score
                  ? "bg-blue-600 text-white border-blue-600 dark:bg-blue-500"
                  : "bg-white border-gray-200 text-gray-700 hover:border-blue-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
              }`}
              disabled={isPending}
              aria-pressed={selectedScore === score}
            >
              {score}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            if (selectedScore !== null) {
              submit(selectedScore);
            }
          }}
          disabled={selectedScore === null || isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {isPending ? "Submitting..." : "Submit"}
        </button>
      </AlertDescription>
    </Alert>
  );
}
