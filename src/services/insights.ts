import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

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
 * Fetch behavioral insights for a user in a specific certification
 */
export async function getBehavioralInsights(
  certificationId: string,
): Promise<BehavioralInsight[]> {
  const response = await api.get<BehavioralInsight[]>(
    `/insights/behavioral?certificationId=${certificationId}`,
  );
  return response.data || [];
}

/**
 * React hook to fetch behavioral insights with caching
 * Respects feature flag gating on backend
 */
export function useBehavioralInsights(certificationId: string | undefined) {
  return useQuery({
    queryKey: ["behavioral-insights", certificationId],
    queryFn: () => getBehavioralInsights(certificationId!),
    enabled: !!certificationId,
    staleTime: 3600000, // 1 hour — insights refresh nightly
  });
}
