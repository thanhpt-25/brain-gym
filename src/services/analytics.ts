import api from './api';
import {
  AnalyticsSummary,
  HistoryItem,
  DomainPerformance,
  ReadinessScore,
  MistakePatterns,
  PaginatedResponse,
} from '@/types/api-types';

export type { AnalyticsSummary, HistoryItem, DomainPerformance, ReadinessScore, MistakePatterns };

export type PaginatedHistory = PaginatedResponse<HistoryItem>;

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

export const getReadiness = async (certificationId: string): Promise<ReadinessScore> => {
  const response = await api.get<ReadinessScore>(`/analytics/readiness/${certificationId}`);
  return response.data;
};

export const updateMistakeType = async (answerId: string, mistakeType: string): Promise<any> => {
  const response = await api.patch(`/analytics/answers/${answerId}/mistake-type`, { mistakeType });
  return response.data;
};

export const getMistakePatterns = async (certificationId?: string): Promise<MistakePatterns> => {
  const params = certificationId ? `?certificationId=${certificationId}` : '';
  const response = await api.get<MistakePatterns>(`/analytics/mistake-patterns${params}`);
  return response.data;
};
