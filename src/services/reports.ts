import api from './api';

export type ReportReason = 'WRONG_ANSWER' | 'OUTDATED' | 'DUPLICATE' | 'INAPPROPRIATE';

export interface Report {
  id: string;
  reason: ReportReason;
  description?: string;
  status: string;
  createdAt: string;
  user: { id: string; displayName: string; avatarUrl: string | null };
  question: { id: string; title: string };
}

export const reportQuestion = async (questionId: string, reason: ReportReason, description?: string): Promise<Report> => {
  const response = await api.post<Report>(`/questions/${questionId}/report`, { reason, description });
  return response.data;
};
