import { useQuery } from "@tanstack/react-query";
import api from "./api";

export interface ReadinessSignals {
  srsCoverage: number;
  recentAccuracy14d: number;
  domainSpread: number;
  timePressure: number;
}

export interface ReadinessScore {
  id: string;
  userId: string;
  certificationId: string;
  /** 0–100 composite readiness score */
  score: number;
  /** 0–0.95 statistical confidence */
  confidence: number;
  attempts: number;
  signals: ReadinessSignals;
  computedAt: string;
}

/**
 * Fetch the readiness score for a certification.
 * Returns null when the backend responds with 404 (not enough data yet).
 */
export async function getReadiness(
  certificationId: string,
): Promise<ReadinessScore | null> {
  try {
    const response = await api.get<ReadinessScore>(
      `/readiness/${certificationId}`,
    );
    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as { response?: { status: number } };
      if (axiosError.response?.status === 404) {
        return null;
      }
    }
    throw error;
  }
}

/**
 * TanStack Query hook for readiness score.
 * Disabled when certificationId is undefined.
 * Data is considered fresh for 60 seconds.
 */
export function useReadiness(certificationId: string | undefined) {
  return useQuery({
    queryKey: ["readiness", certificationId],
    queryFn: () => getReadiness(certificationId!),
    enabled: !!certificationId,
    staleTime: 60_000,
  });
}
