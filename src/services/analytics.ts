import api from './api';

export interface AnalyticsSummary {
  totalExams: number;
  totalPassed: number;
  passRate: number;
  avgScore: number;
  bestScore: number;
  totalStudyTime: number;
  totalQuestions: number;
}

export interface HistoryItem {
  id: string;
  examTitle: string;
  certification: { id: string; name: string; code: string; provider: string };
  score: number;
  totalCorrect: number;
  totalQuestions: number;
  passed: boolean;
  timeSpent: number;
  domainScores: Record<string, { correct: number; total: number }> | null;
  startedAt: string;
  submittedAt: string;
}

export interface PaginatedHistory {
  data: HistoryItem[];
  meta: { total: number; page: number; lastPage: number };
}

export interface DomainPerformance {
  domain: string;
  correct: number;
  total: number;
  percentage: number;
}

export const getAnalyticsSummary = async (certificationId?: string): Promise<AnalyticsSummary> => {
  const params = certificationId ? `?certificationId=${certificationId}` : '';
  const response = await api.get<AnalyticsSummary>(`/analytics/me/summary${params}`);
  return response.data;
};

export const getAnalyticsHistory = async (certificationId?: string, page = 1, limit = 20): Promise<PaginatedHistory> => {
  const params = new URLSearchParams();
  if (certificationId) params.append('certificationId', certificationId);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  const response = await api.get<PaginatedHistory>(`/analytics/me/history?${params}`);
  return response.data;
};

export const getAnalyticsDomains = async (certificationId?: string): Promise<DomainPerformance[]> => {
  const params = certificationId ? `?certificationId=${certificationId}` : '';
  const response = await api.get<DomainPerformance[]>(`/analytics/me/domains${params}`);
  return response.data;
};

export const getWeakTopics = async (certificationId?: string, topN = 5): Promise<DomainPerformance[]> => {
  const params = new URLSearchParams();
  if (certificationId) params.append('certificationId', certificationId);
  params.append('topN', topN.toString());
  const response = await api.get<DomainPerformance[]>(`/analytics/me/weak-topics?${params}`);
  return response.data;
};
