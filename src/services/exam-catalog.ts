import api from './api';
import type {
  ExamCatalogItem,
  LearningTrack,
  OrgExamAssignment,
  MyAssignment,
  PaginatedCatalogItems,
  CreateCatalogItemPayload,
  UpdateCatalogItemPayload,
  AssignExamPayload,
  CreateTrackPayload,
  UpdateTrackPayload,
  CatalogListFilters,
} from '@/types/exam-catalog-types';
import type { StartAttemptResponse } from './attempts';

const base = (slug: string) => `/organizations/${slug}`;

// ─── Catalog Items ────────────────────────────────────────────────────────────

export const getCatalogItems = async (
  slug: string,
  filters: CatalogListFilters = {},
): Promise<PaginatedCatalogItems> => {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.trackId) params.append('trackId', filters.trackId);
  params.append('page', String(filters.page ?? 1));
  params.append('limit', String(filters.limit ?? 20));
  const res = await api.get<PaginatedCatalogItems>(
    `${base(slug)}/catalog?${params.toString()}`,
  );
  return res.data;
};

export const getCatalogItemsManage = async (
  slug: string,
  filters: CatalogListFilters = {},
): Promise<PaginatedCatalogItems> => {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.trackId) params.append('trackId', filters.trackId);
  params.append('page', String(filters.page ?? 1));
  params.append('limit', String(filters.limit ?? 20));
  const res = await api.get<PaginatedCatalogItems>(
    `${base(slug)}/catalog/manage?${params.toString()}`,
  );
  return res.data;
};

export const getCatalogItem = async (
  slug: string,
  cid: string,
): Promise<ExamCatalogItem> => {
  const res = await api.get<ExamCatalogItem>(`${base(slug)}/catalog/${cid}`);
  return res.data;
};

export const createCatalogItem = async (
  slug: string,
  data: CreateCatalogItemPayload,
): Promise<ExamCatalogItem> => {
  const res = await api.post<ExamCatalogItem>(`${base(slug)}/catalog`, data);
  return res.data;
};

export const updateCatalogItem = async (
  slug: string,
  cid: string,
  data: UpdateCatalogItemPayload,
): Promise<ExamCatalogItem> => {
  const res = await api.patch<ExamCatalogItem>(`${base(slug)}/catalog/${cid}`, data);
  return res.data;
};

export const deleteCatalogItem = async (slug: string, cid: string): Promise<void> => {
  await api.delete(`${base(slug)}/catalog/${cid}`);
};

export const assignExam = async (
  slug: string,
  cid: string,
  data: AssignExamPayload,
): Promise<OrgExamAssignment> => {
  const res = await api.post<OrgExamAssignment>(`${base(slug)}/catalog/${cid}/assign`, data);
  return res.data;
};

export const startCatalogExam = async (
  slug: string,
  cid: string,
): Promise<StartAttemptResponse> => {
  const res = await api.post<StartAttemptResponse>(`${base(slug)}/catalog/${cid}/start`);
  return res.data;
};

// ─── Learning Tracks ──────────────────────────────────────────────────────────

export const getTracks = async (slug: string): Promise<LearningTrack[]> => {
  const res = await api.get<LearningTrack[]>(`${base(slug)}/tracks`);
  return res.data;
};

export const createTrack = async (
  slug: string,
  data: CreateTrackPayload,
): Promise<LearningTrack> => {
  const res = await api.post<LearningTrack>(`${base(slug)}/tracks`, data);
  return res.data;
};

export const updateTrack = async (
  slug: string,
  tid: string,
  data: UpdateTrackPayload,
): Promise<LearningTrack> => {
  const res = await api.patch<LearningTrack>(`${base(slug)}/tracks/${tid}`, data);
  return res.data;
};

export const deleteTrack = async (slug: string, tid: string): Promise<void> => {
  await api.delete(`${base(slug)}/tracks/${tid}`);
};

// ─── My Assignments ───────────────────────────────────────────────────────────

export const getMyAssignments = async (slug: string): Promise<MyAssignment[]> => {
  const res = await api.get<MyAssignment[]>(`${base(slug)}/my-assignments`);
  return res.data;
};
