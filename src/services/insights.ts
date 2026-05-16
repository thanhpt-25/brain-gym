import { useQuery } from "@tanstack/react-query";
import api from "./api";

export interface BehavioralInsight {
  id: string;
  userId: string;
  certificationId: string;
  kind:
    | "slow_on_long_stems"
    | "accuracy_decline_after_30min"
    | "domain_streak_break";
  severity: "low" | "medium" | "high";
  details: Record<string, unknown>;
  generatedFor: string;
  createdAt: string;
}

/**
 * Fetch behavioral insights for a certification.
 * Returns an empty array if no insights are available.
 */
export async function getBehavioralInsights(
  certificationId: string,
): Promise<BehavioralInsight[]> {
  try {
    const response = await api.get<BehavioralInsight[]>(
      `/insights/behavioral?certificationId=${certificationId}`,
    );
    return response.data || [];
  } catch (error: unknown) {
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as { response?: { status: number } };
      if (axiosError.response?.status === 404) {
        return [];
      }
    }
    throw error;
  }
}

/**
 * TanStack Query hook for behavioral insights.
 * Disabled when certificationId is undefined.
 * Data is considered fresh for 1 hour (insights refresh nightly on backend).
 */
export function useBehavioralInsights(certificationId: string | undefined) {
  return useQuery({
    queryKey: ["behavioral-insights", certificationId],
    queryFn: () => getBehavioralInsights(certificationId!),
    enabled: !!certificationId,
    staleTime: 3600000, // 1 hour
  });
}
