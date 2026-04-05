import api from './api';
import type {
  Assessment,
  AssessmentResults,
  PaginatedAssessments,
  CreateAssessmentPayload,
  UpdateAssessmentPayload,
  InviteCandidatePayload,
  AssessmentStatus,
  CandidateExamInfo,
  CandidateExamPayload,
  CandidateSubmitResult,
  CandidateAnswerPayload,
} from '@/types/assessment-types';

const base = (slug: string) => `/organizations/${slug}/assessments`;

// ─── Admin endpoints ────────────────────────────────────────────────────────

export const getAssessments = async (
  slug: string,
  page = 1,
  limit = 20,
): Promise<PaginatedAssessments> => {
  const res = await api.get<PaginatedAssessments>(
    `${base(slug)}?page=${page}&limit=${limit}`,
  );
  return res.data;
};

export const getAssessment = async (
  slug: string,
  aid: string,
): Promise<Assessment> => {
  const res = await api.get<Assessment>(`${base(slug)}/${aid}`);
  return res.data;
};

export const createAssessment = async (
  slug: string,
  data: CreateAssessmentPayload,
): Promise<Assessment> => {
  const res = await api.post<Assessment>(base(slug), data);
  return res.data;
};

export const updateAssessment = async (
  slug: string,
  aid: string,
  data: UpdateAssessmentPayload,
): Promise<Assessment> => {
  const res = await api.patch<Assessment>(`${base(slug)}/${aid}`, data);
  return res.data;
};

export const updateAssessmentStatus = async (
  slug: string,
  aid: string,
  status: AssessmentStatus,
): Promise<Assessment> => {
  const res = await api.patch<Assessment>(`${base(slug)}/${aid}/status`, { status });
  return res.data;
};

export const inviteCandidates = async (
  slug: string,
  aid: string,
  data: InviteCandidatePayload,
): Promise<{ invited: number }> => {
  const res = await api.post<{ invited: number }>(`${base(slug)}/${aid}/invite`, data);
  return res.data;
};

export const getAssessmentResults = async (
  slug: string,
  aid: string,
): Promise<AssessmentResults> => {
  const res = await api.get<AssessmentResults>(`${base(slug)}/${aid}/results`);
  return res.data;
};

export const exportAssessmentCsv = async (slug: string, aid: string): Promise<string> => {
  const res = await api.get<string>(`${base(slug)}/${aid}/results/export`, {
    responseType: 'text',
  });
  return res.data;
};

// ─── Candidate endpoints (public, no auth) ──────────────────────────────────

export const loadCandidateAssessment = async (
  token: string,
): Promise<CandidateExamInfo> => {
  const res = await api.get<CandidateExamInfo>(`/assessments/take/${token}`);
  return res.data;
};

export const startCandidateAttempt = async (
  token: string,
): Promise<CandidateExamPayload> => {
  const res = await api.post<CandidateExamPayload>(`/assessments/take/${token}/start`);
  return res.data;
};

export const submitCandidateAttempt = async (
  token: string,
  answers: CandidateAnswerPayload[],
): Promise<CandidateSubmitResult> => {
  const res = await api.post<CandidateSubmitResult>(
    `/assessments/take/${token}/submit`,
    { answers },
  );
  return res.data;
};

export const reportCandidateEvent = async (
  token: string,
  eventType: string,
): Promise<void> => {
  await api.post(`/assessments/take/${token}/event`, { eventType });
};
