import type { PaginatedResponse } from './api-types';

export type ExamCatalogItemType = 'FIXED' | 'DYNAMIC';
export type TimerMode = 'STRICT' | 'ACCELERATED' | 'RELAXED';

export interface CatalogCertification {
  id: string;
  name: string;
  code: string;
}

export interface CatalogTrackRef {
  id: string;
  name: string;
}

export interface CatalogPrerequisiteRef {
  id: string;
  title: string;
}

export interface ExamCatalogItem {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  type: ExamCatalogItemType;
  certificationId: string | null;
  questionCount: number;
  timeLimit: number;
  passingScore: number | null;
  timerMode: TimerMode;
  maxAttempts: number | null;
  availableFrom: string | null;
  availableUntil: string | null;
  isMandatory: boolean;
  isActive: boolean;
  sortOrder: number;
  trackId: string | null;
  prerequisiteId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  certification: CatalogCertification | null;
  track: CatalogTrackRef | null;
  prerequisite: CatalogPrerequisiteRef | null;
  _count?: { questions: number; assignments: number };
}

export interface LearningTrack {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  catalogItems: Pick<ExamCatalogItem, 'id' | 'title' | 'questionCount' | 'timeLimit' | 'isMandatory' | 'sortOrder'>[];
  _count?: { catalogItems: number };
}

export interface OrgExamAssignment {
  id: string;
  catalogItemId: string;
  groupId: string | null;
  memberId: string | null;
  dueDate: string | null;
  assignedAt: string;
  group?: { id: string; name: string } | null;
  catalogItem: ExamCatalogItem;
}

export interface MyAssignment extends OrgExamAssignment {
  attemptsCount: number;
  bestScore: number | null;
  passed: boolean | null;
}

// ─── Request payloads ────────────────────────────────────────────────────────

export interface CatalogQuestionPayload {
  orgQuestionId?: string;
  publicQuestionId?: string;
  sortOrder?: number;
}

export interface CreateCatalogItemPayload {
  title: string;
  description?: string;
  type?: ExamCatalogItemType;
  certificationId?: string;
  questionCount: number;
  timeLimit: number;
  passingScore?: number;
  timerMode?: TimerMode;
  maxAttempts?: number;
  availableFrom?: string;
  availableUntil?: string;
  isMandatory?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  trackId?: string;
  prerequisiteId?: string;
  questions?: CatalogQuestionPayload[];
}

export type UpdateCatalogItemPayload = Partial<CreateCatalogItemPayload>;

export interface AssignExamPayload {
  groupId?: string;
  memberId?: string;
  dueDate?: string;
}

export interface CreateTrackPayload {
  name: string;
  description?: string;
  isActive?: boolean;
}

export type UpdateTrackPayload = Partial<CreateTrackPayload>;

export interface CatalogListFilters {
  search?: string;
  trackId?: string;
  page?: number;
  limit?: number;
}

export type PaginatedCatalogItems = PaginatedResponse<ExamCatalogItem>;
