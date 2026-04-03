import api from './api';
import type {
  OrgQuestion,
  PaginatedOrgQuestions,
  OrgQuestionFilters,
  CreateOrgQuestionPayload,
} from '@/types/org-question-types';

export const getOrgQuestions = async (
  slug: string,
  filters: OrgQuestionFilters = {},
): Promise<PaginatedOrgQuestions> => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.difficulty) params.append('difficulty', filters.difficulty);
  if (filters.category) params.append('category', filters.category);
  if (filters.search) params.append('search', filters.search);
  if (filters.createdBy) params.append('createdBy', filters.createdBy);
  params.append('page', String(filters.page || 1));
  params.append('limit', String(filters.limit || 20));

  const response = await api.get<PaginatedOrgQuestions>(
    `/organizations/${slug}/questions?${params.toString()}`,
  );
  return response.data;
};

export const getOrgQuestion = async (slug: string, questionId: string): Promise<OrgQuestion> => {
  const response = await api.get<OrgQuestion>(`/organizations/${slug}/questions/${questionId}`);
  return response.data;
};

export const createOrgQuestion = async (
  slug: string,
  data: CreateOrgQuestionPayload,
): Promise<OrgQuestion> => {
  const response = await api.post<OrgQuestion>(`/organizations/${slug}/questions`, data);
  return response.data;
};

export const updateOrgQuestion = async (
  slug: string,
  questionId: string,
  data: Partial<CreateOrgQuestionPayload>,
): Promise<OrgQuestion> => {
  const response = await api.patch<OrgQuestion>(
    `/organizations/${slug}/questions/${questionId}`,
    data,
  );
  return response.data;
};

export const deleteOrgQuestion = async (slug: string, questionId: string): Promise<void> => {
  await api.delete(`/organizations/${slug}/questions/${questionId}`);
};

export const submitOrgQuestion = async (slug: string, questionId: string): Promise<OrgQuestion> => {
  const response = await api.post<OrgQuestion>(
    `/organizations/${slug}/questions/${questionId}/submit`,
  );
  return response.data;
};

export const approveOrgQuestion = async (
  slug: string,
  questionId: string,
): Promise<OrgQuestion> => {
  const response = await api.post<OrgQuestion>(
    `/organizations/${slug}/questions/${questionId}/approve`,
  );
  return response.data;
};

export const rejectOrgQuestion = async (
  slug: string,
  questionId: string,
  reason?: string,
): Promise<OrgQuestion> => {
  const response = await api.post<OrgQuestion>(
    `/organizations/${slug}/questions/${questionId}/reject`,
    reason ? { reason } : {},
  );
  return response.data;
};

export const clonePublicQuestion = async (
  slug: string,
  sourceQuestionId: string,
): Promise<OrgQuestion> => {
  const response = await api.post<OrgQuestion>(
    `/organizations/${slug}/questions/clone/${sourceQuestionId}`,
  );
  return response.data;
};
