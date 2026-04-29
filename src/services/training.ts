import api from "./api";
import { ReviewSchedule } from "@/types/api-types";

export type { ReviewSchedule };

export const startWeaknessTraining = async (
  certificationId: string,
  questionCount = 10,
): Promise<unknown> => {
  const response = await api.post("/training/weakness/start", {
    certificationId,
    questionCount,
  });
  return response.data;
};

export const submitReview = async (
  questionId: string,
  quality: number,
): Promise<unknown> => {
  const response = await api.post("/training/review", { questionId, quality });
  return response.data;
};

export const getDueReviews = async (
  certificationId?: string,
  limit?: number,
): Promise<ReviewSchedule[]> => {
  const params = new URLSearchParams();
  if (certificationId) params.append("certificationId", certificationId);
  if (limit) params.append("limit", limit.toString());
  const response = await api.get<ReviewSchedule[]>(
    `/training/due-reviews?${params}`,
  );
  return response.data;
};
