import type { PaginatedResponse } from './api-types';

export type AssessmentStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
export type CandidateAttemptStatus = 'INVITED' | 'STARTED' | 'SUBMITTED' | 'EXPIRED';
export type AssessmentSelectionMode = 'MANUAL' | 'BLUEPRINT' | 'POOL';
export type CandidateStage = 'APPLIED' | 'SCREENING' | 'SHORTLISTED' | 'REJECTED' | 'HIRED';

export interface JobRole {
  id: string;
  orgId: string;
  title: string;
  department: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { assessments: number };
}

// ─── Blueprint / Pool config shapes ──────────────────────────────────────────

export interface BlueprintDomain {
  domain: string;
  percentage: number;
}

export interface BlueprintConfig {
  totalQuestions: number;
  domains: BlueprintDomain[];
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  certificationId?: string;
}

export interface PoolConfig {
  drawCount: number;
  certificationId?: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  categories?: string[];
  tags?: string[];
}

export type SelectionConfig = BlueprintConfig | PoolConfig;

// ─── Core types ───────────────────────────────────────────────────────────────

export interface AssessmentQuestionRef {
  id: string;
  orgQuestionId: string | null;
  publicQuestionId: string | null;
  sortOrder: number;
  orgQuestion?: { id: string; title: string; choices: { id: string; label: string; content: string }[] } | null;
  publicQuestion?: { id: string; title: string; choices: { id: string; label: string; content: string }[] } | null;
}

export interface Assessment {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  status: AssessmentStatus;
  selectionMode: AssessmentSelectionMode;
  selectionConfig: SelectionConfig | null;
  questionCount: number;
  timeLimit: number;
  passingScore: number | null;
  randomizeQuestions: boolean;
  randomizeChoices: boolean;
  detectTabSwitch: boolean;
  blockCopyPaste: boolean;
  linkExpiryHours: number;
  jobRoleId: string | null;
  jobRole?: { id: string; title: string; department: string | null } | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  _count?: { candidateInvites: number; questions: number };
  submittedCount?: number;
  avgScore?: number | null;
  questions?: AssessmentQuestionRef[];
}

export interface CandidateInvite {
  id: string;
  assessmentId: string;
  candidateEmail: string;
  candidateName: string | null;
  token: string;
  status: CandidateAttemptStatus;
  score: number | null;
  totalCorrect: number | null;
  totalQuestions: number | null;
  domainScores: Record<string, { correct: number; total: number }> | null;
  timeSpent: number | null;
  tabSwitchCount: number | null;
  ipAddress: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  expiresAt: string;
  drawnQuestionIds: string[];
  // P1: Recruiting pipeline
  stage: CandidateStage;
  rating: number | null;
  recruiterNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  percentile: number | null;
  createdAt: string;
}

export interface UpdateCandidateDecisionPayload {
  stage?: CandidateStage;
  rating?: number;
  recruiterNote?: string;
}

export interface AssessmentResults {
  assessment: Assessment;
  funnel: {
    total: number;
    started: number;
    submitted: number;
    passed: number | null;
  };
  candidates: CandidateInvite[];
}

export interface CandidateExamInfo {
  title: string;
  description: string | null;
  questionCount: number;
  timeLimit: number;
  detectTabSwitch: boolean;
  blockCopyPaste: boolean;
  candidateName: string | null;
  status: CandidateAttemptStatus;
  startedAt: string | null;
}

export interface CandidateQuestion {
  id: string;
  title: string;
  description: string | null;
  questionType: string;
  choices: { id: string; label: string; content: string }[];
}

export interface CandidateExamPayload {
  assessmentTitle: string;
  timeLimit: number;
  detectTabSwitch: boolean;
  blockCopyPaste: boolean;
  totalQuestions: number;
  questions: CandidateQuestion[];
}

export interface CandidateSubmitResult {
  score: number;
  totalCorrect: number;
  totalQuestions: number;
  passed: boolean | null;
  timeSpent: number | null;
}

// ─── Request payloads ─────────────────────────────────────────────────────────

export interface AssessmentQuestionPayload {
  orgQuestionId?: string;
  publicQuestionId?: string;
  sortOrder?: number;
}

export interface CreateAssessmentPayload {
  title: string;
  description?: string;
  timeLimit: number;
  passingScore?: number;
  randomizeQuestions?: boolean;
  randomizeChoices?: boolean;
  detectTabSwitch?: boolean;
  blockCopyPaste?: boolean;
  linkExpiryHours?: number;
  jobRoleId?: string;
  // Selection mode fields
  selectionMode?: AssessmentSelectionMode;
  selectionConfig?: SelectionConfig;
  // Required for MANUAL; omitted for BLUEPRINT/POOL
  questions?: AssessmentQuestionPayload[];
}

export type UpdateAssessmentPayload = Partial<CreateAssessmentPayload>;

export interface InviteCandidatePayload {
  candidates: { email: string; name?: string }[];
}

export interface CandidateAnswerPayload {
  questionId: string;
  selectedChoices: string[];
}

export type PaginatedAssessments = PaginatedResponse<Assessment>;
