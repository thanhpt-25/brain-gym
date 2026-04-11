import type { PaginatedResponse } from './api-types';

export type OrgQuestionStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export interface OrgQuestionChoice {
  id: string;
  label: string;
  content: string;
  isCorrect: boolean;
  sortOrder: number;
}

export interface OrgQuestion {
  id: string;
  orgId: string;
  createdBy: string;
  sourceQuestionId: string | null;
  title: string;
  description: string | null;
  questionType: string;
  difficulty: string;
  explanation: string | null;
  referenceUrl: string | null;
  codeSnippet: string | null;
  isScenario: boolean;
  isTrapQuestion: boolean;
  status: OrgQuestionStatus;
  category: string | null;
  tags: string[];
  certificationId: string | null;
  certification?: { id: string; name: string; code: string } | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  choices: OrgQuestionChoice[];
  author?: { id: string; displayName: string; avatarUrl: string | null } | null;
}

export interface OrgQuestionFilters {
  page?: number;
  limit?: number;
  status?: OrgQuestionStatus;
  difficulty?: string;
  category?: string;
  certificationId?: string;
  search?: string;
  createdBy?: string;
}

export interface CreateOrgQuestionPayload {
  title: string;
  description?: string;
  questionType?: string;
  difficulty?: string;
  explanation?: string;
  referenceUrl?: string;
  codeSnippet?: string;
  isScenario?: boolean;
  isTrapQuestion?: boolean;
  category?: string;
  certificationId?: string;
  tags?: string[];
  choices: { label: string; content: string; isCorrect?: boolean }[];
}

export type PaginatedOrgQuestions = PaginatedResponse<OrgQuestion>;
