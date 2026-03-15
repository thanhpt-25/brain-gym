import api from './api';

// Users
export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  points: number;
  createdAt: string;
  _count: { questions: number; examAttempts: number };
}

export interface PaginatedUsers {
  data: AdminUser[];
  meta: { total: number; page: number; lastPage: number };
}

export const getUsers = async (search?: string, page = 1, limit = 20): Promise<PaginatedUsers> => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  const response = await api.get<PaginatedUsers>(`/users?${params}`);
  return response.data;
};

export const updateUserRole = async (userId: string, role: string) => {
  const response = await api.put(`/users/${userId}/role`, { role });
  return response.data;
};

// Question moderation
export interface PendingQuestion {
  id: string;
  title: string;
  description?: string;
  difficulty: string;
  questionType: string;
  status: string;
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
  certification: { id: string; name: string; code: string };
  domain?: { id: string; name: string };
  choices: { id: string; label: string; content: string; isCorrect: boolean }[];
}

export interface PaginatedPendingQuestions {
  data: PendingQuestion[];
  meta: { total: number; page: number; lastPage: number };
}

export const getPendingQuestions = async (page = 1, limit = 20): Promise<PaginatedPendingQuestions> => {
  const response = await api.get<PaginatedPendingQuestions>(`/questions/queue/pending?page=${page}&limit=${limit}`);
  return response.data;
};

export const updateQuestionStatus = async (questionId: string, status: string) => {
  const response = await api.put(`/questions/${questionId}/status`, { status });
  return response.data;
};

// Reports
export interface AdminReport {
  id: string;
  reason: string;
  description?: string;
  status: string;
  createdAt: string;
  user: { id: string; displayName: string; avatarUrl: string | null };
  question: { id: string; title: string; certificationId?: string };
}

export interface PaginatedReports {
  data: AdminReport[];
  meta: { total: number; page: number; lastPage: number };
}

export const getReports = async (status?: string, page = 1, limit = 20): Promise<PaginatedReports> => {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  const response = await api.get<PaginatedReports>(`/reports?${params}`);
  return response.data;
};

export const updateReportStatus = async (reportId: string, status: string) => {
  const response = await api.put(`/reports/${reportId}`, { status });
  return response.data;
};
