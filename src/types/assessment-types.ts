import type { PaginatedResponse } from './api-types';

export type AssessmentStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
export type CandidateAttemptStatus = 'INVITED' | 'STARTED' | 'SUBMITTED' | 'EXPIRED';

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
  questionCount: number;
  timeLimit: number;
  passingScore: number | null;
  randomizeQuestions: boolean;
  randomizeChoices: boolean;
  detectTabSwitch: boolean;
  blockCopyPaste: boolean;
  linkExpiryHours: number;
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
  createdAt: string;
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

// ─── Request payloads ─────────────────────────────────────────────���──────────

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
  questions: AssessmentQuestionPayload[];
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
