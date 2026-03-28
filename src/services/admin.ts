import api from './api';

// ==================== Types ====================

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  points: number;
  suspendedUntil: string | null;
  banReason: string | null;
  createdAt: string;
  _count: { questions: number; examAttempts: number };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; lastPage: number };
}

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

export interface AdminReport {
  id: string;
  reason: string;
  description?: string;
  status: string;
  createdAt: string;
  user: { id: string; displayName: string; avatarUrl: string | null };
  question: { id: string; title: string; certificationId?: string };
}

export interface DashboardData {
  users: { total: number; newLast7d: number; newLast30d: number };
  questions: { draft: number; pending: number; approved: number; rejected: number; total: number };
  exams: { total: number };
  attempts: { total: number };
  reports: { pending: number };
  providers: { total: number };
  certifications: { total: number };
  aiGeneration: { pending: number; processing: number; completed: number; failed: number };
}

export interface Provider {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  _count?: { certifications: number };
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: any;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; displayName: string; email: string };
}

// ==================== Dashboard ====================

export const getDashboard = async (): Promise<DashboardData> => {
  const response = await api.get<DashboardData>('/admin/dashboard');
  return response.data;
};

// ==================== Users ====================

export const getUsers = async (search?: string, page = 1, limit = 20): Promise<PaginatedResponse<AdminUser>> => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  const response = await api.get<PaginatedResponse<AdminUser>>(`/users?${params}`);
  return response.data;
};

export const updateUserRole = async (userId: string, role: string) => {
  const response = await api.put(`/users/${userId}/role`, { role });
  return response.data;
};

export const suspendUser = async (userId: string, reason: string, suspendedUntil?: string) => {
  const response = await api.put(`/users/${userId}/suspend`, { reason, suspendedUntil });
  return response.data;
};

export const banUser = async (userId: string, reason: string) => {
  const response = await api.put(`/users/${userId}/ban`, { reason });
  return response.data;
};

export const reactivateUser = async (userId: string) => {
  const response = await api.put(`/users/${userId}/reactivate`);
  return response.data;
};

export const adjustUserPoints = async (userId: string, amount: number, reason?: string) => {
  const response = await api.put(`/users/${userId}/points`, { amount, reason });
  return response.data;
};

// ==================== Question Moderation ====================

export const getPendingQuestions = async (page = 1, limit = 20): Promise<PaginatedResponse<PendingQuestion>> => {
  const response = await api.get<PaginatedResponse<PendingQuestion>>(`/questions/queue/pending?page=${page}&limit=${limit}`);
  return response.data;
};

export const updateQuestionStatus = async (questionId: string, status: string) => {
  const response = await api.put(`/questions/${questionId}/status`, { status });
  return response.data;
};

export const adminUpdateQuestion = async (questionId: string, data: any) => {
  const response = await api.put(`/questions/${questionId}/admin`, data);
  return response.data;
};

export const adminDeleteQuestion = async (questionId: string) => {
  const response = await api.delete(`/questions/${questionId}`);
  return response.data;
};

export const getAdminQuestions = async (params: {
  certificationId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
}): Promise<PaginatedResponse<any>> => {
  const searchParams = new URLSearchParams();
  if (params.certificationId) searchParams.append('certificationId', params.certificationId);
  if (params.status) searchParams.append('status', params.status);
  if (params.search) searchParams.append('search', params.search);
  if (params.page) searchParams.append('page', params.page.toString());
  if (params.limit) searchParams.append('limit', params.limit.toString());
  if (params.includeDeleted) searchParams.append('includeDeleted', 'true');
  const response = await api.get(`/questions/admin/all?${searchParams}`);
  return response.data;
};

// ==================== Reports ====================

export const getReports = async (status?: string, page = 1, limit = 20): Promise<PaginatedResponse<AdminReport>> => {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  const response = await api.get<PaginatedResponse<AdminReport>>(`/reports?${params}`);
  return response.data;
};

export const updateReportStatus = async (reportId: string, status: string) => {
  const response = await api.put(`/reports/${reportId}`, { status });
  return response.data;
};

// ==================== Providers ====================

export const getProviders = async (includeInactive = false): Promise<Provider[]> => {
  const response = await api.get<Provider[]>(`/providers?includeInactive=${includeInactive}`);
  return response.data;
};

export const createProvider = async (data: { name: string; slug: string; logoUrl?: string; website?: string; description?: string; sortOrder?: number }): Promise<Provider> => {
  const response = await api.post<Provider>('/providers', data);
  return response.data;
};

export const updateProvider = async (id: string, data: Partial<Provider>): Promise<Provider> => {
  const response = await api.put<Provider>(`/providers/${id}`, data);
  return response.data;
};

export const deleteProvider = async (id: string): Promise<Provider> => {
  const response = await api.delete<Provider>(`/providers/${id}`);
  return response.data;
};

// ==================== Admin Exams ====================

export const getAdminExams = async (params: { page?: number; limit?: number; visibility?: string }): Promise<PaginatedResponse<any>> => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append('page', params.page.toString());
  if (params.limit) searchParams.append('limit', params.limit.toString());
  if (params.visibility) searchParams.append('visibility', params.visibility);
  const response = await api.get(`/admin/exams?${searchParams}`);
  return response.data;
};

// ==================== AI Generation ====================

export const getAdminGenerationJobs = async (params: { page?: number; limit?: number; status?: string }): Promise<PaginatedResponse<any>> => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append('page', params.page.toString());
  if (params.limit) searchParams.append('limit', params.limit.toString());
  if (params.status) searchParams.append('status', params.status);
  const response = await api.get(`/admin/generation-jobs?${searchParams}`);
  return response.data;
};

// ==================== Audit Logs ====================

export const getAuditLogs = async (params: {
  action?: string;
  targetType?: string;
  userId?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<AuditLogEntry>> => {
  const searchParams = new URLSearchParams();
  if (params.action) searchParams.append('action', params.action);
  if (params.targetType) searchParams.append('targetType', params.targetType);
  if (params.userId) searchParams.append('userId', params.userId);
  if (params.page) searchParams.append('page', params.page.toString());
  if (params.limit) searchParams.append('limit', params.limit.toString());
  const response = await api.get(`/admin/audit-logs?${searchParams}`);
  return response.data;
};

// ==================== Domains ====================

export const getAdminDomains = async (params: { certificationId?: string; page?: number; limit?: number }): Promise<PaginatedResponse<any>> => {
  const searchParams = new URLSearchParams();
  if (params.certificationId) searchParams.append('certificationId', params.certificationId);
  if (params.page) searchParams.append('page', params.page.toString());
  if (params.limit) searchParams.append('limit', params.limit.toString());
  const response = await api.get(`/admin/domains?${searchParams}`);
  return response.data;
};

export const createDomain = async (data: { name: string; certificationId: string; description?: string; weight?: number }) => {
  const response = await api.post('/admin/domains', data);
  return response.data;
};

export const updateDomain = async (id: string, data: { name?: string; description?: string; weight?: number }) => {
  const response = await api.put(`/admin/domains/${id}`, data);
  return response.data;
};

export const deleteDomain = async (id: string) => {
  const response = await api.delete(`/admin/domains/${id}`);
  return response.data;
};

export const reorderDomains = async (certificationId: string, orderedIds: string[]) => {
  const response = await api.put('/admin/domains/reorder', { certificationId, orderedIds });
  return response.data;
};

// ==================== Tags ====================

export const getAdminTags = async (certificationId?: string): Promise<any[]> => {
  const params = certificationId ? `?certificationId=${certificationId}` : '';
  const response = await api.get(`/tags${params}`);
  return response.data;
};

export const createTag = async (data: { name: string; certificationId?: string }) => {
  const response = await api.post('/tags', data);
  return response.data;
};

export const updateTag = async (id: string, data: { name: string }) => {
  const response = await api.put(`/tags/${id}`, data);
  return response.data;
};

export const deleteTag = async (id: string) => {
  const response = await api.delete(`/tags/${id}`);
  return response.data;
};

export const mergeTags = async (data: { sourceIds: string[]; targetId: string }) => {
  const response = await api.post('/tags/merge', data);
  return response.data;
};

// ==================== Badges ====================

export const getAdminBadges = async (): Promise<any[]> => {
  const response = await api.get('/admin/badges');
  return response.data;
};

export const createBadge = async (data: { name: string; description?: string; iconUrl?: string; criteria?: any }) => {
  const response = await api.post('/admin/badges', data);
  return response.data;
};

export const updateBadge = async (id: string, data: { name?: string; description?: string; iconUrl?: string; criteria?: any }) => {
  const response = await api.put(`/admin/badges/${id}`, data);
  return response.data;
};

export const deleteBadge = async (id: string) => {
  const response = await api.delete(`/admin/badges/${id}`);
  return response.data;
};

export const awardBadge = async (badgeId: string, userId: string) => {
  const response = await api.post(`/admin/badges/${badgeId}/award`, { userId });
  return response.data;
};

export const revokeBadge = async (badgeId: string, userId: string) => {
  const response = await api.delete(`/admin/badges/${badgeId}/awards/${userId}`);
  return response.data;
};

// ==================== Source Materials ====================

export const getAdminSourceMaterials = async (params: { page?: number; limit?: number }): Promise<PaginatedResponse<any>> => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append('page', params.page.toString());
  if (params.limit) searchParams.append('limit', params.limit.toString());
  const response = await api.get(`/admin/source-materials?${searchParams}`);
  return response.data;
};

export const deleteSourceMaterial = async (id: string) => {
  const response = await api.delete(`/admin/source-materials/${id}`);
  return response.data;
};

// ==================== Exam Visibility ====================

export const updateExamVisibility = async (id: string, visibility: string) => {
  const response = await api.patch(`/admin/exams/${id}/visibility`, { visibility });
  return response.data;
};
