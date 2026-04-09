import api from './api';

const base = (slug: string) => `/organizations/${slug}/analytics`;

export interface OrgOverview {
  memberCount: number;
  activeUsersLast7d: number;
  totalExamsTaken: number;
  avgScore: number;
  passRate: number;
  totalAssessments: number;
  totalCandidatesInvited: number;
}

export interface CertReadiness {
  certificationId: string;
  certificationName: string;
  certificationCode: string;
  membersAttempted: number;
  totalMembers: number;
  avgScore: number;
  passedMembers: number;
  passRate: number;
}

export interface DomainGap {
  domain: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface WeeklyProgress {
  week: string;
  examsTaken: number;
  avgScore: number;
  activeUsers: number;
}

export interface OrgEngagement {
  totalMembers: number;
  activeUsersLast7d: number;
  activeRate: number;
  totalExamsTaken: number;
  avgExamsPerMember: number;
  assessmentFunnel: {
    invited: number;
    started: number;
    submitted: number;
    expired: number;
  };
}

export interface MemberAttempt {
  id: string;
  examTitle: string;
  certification: { id: string; name: string; code: string } | null;
  score: number;
  totalCorrect: number;
  totalQuestions: number;
  passed: boolean;
  timeSpent: number;
  submittedAt: string;
}

export interface MemberAnalytics {
  member: {
    userId: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
    role: string;
    group: { id: string; name: string } | null;
    joinedAt: string;
  };
  summary: {
    totalExams: number;
    totalPassed: number;
    passRate: number;
    avgScore: number;
    bestScore: number;
  };
  domains: DomainGap[];
  recentAttempts: MemberAttempt[];
}

export const getOrgOverview = async (slug: string): Promise<OrgOverview> => {
  const res = await api.get<OrgOverview>(`${base(slug)}/overview`);
  return res.data;
};

export const getOrgReadiness = async (slug: string): Promise<CertReadiness[]> => {
  const res = await api.get<CertReadiness[]>(`${base(slug)}/readiness`);
  return res.data;
};

export const getOrgSkillGaps = async (slug: string): Promise<DomainGap[]> => {
  const res = await api.get<DomainGap[]>(`${base(slug)}/skill-gaps`);
  return res.data;
};

export const getOrgProgress = async (slug: string, weeks = 12): Promise<WeeklyProgress[]> => {
  const res = await api.get<WeeklyProgress[]>(`${base(slug)}/progress?weeks=${weeks}`);
  return res.data;
};

export const getOrgEngagement = async (slug: string): Promise<OrgEngagement> => {
  const res = await api.get<OrgEngagement>(`${base(slug)}/engagement`);
  return res.data;
};

export const getMemberAnalytics = async (slug: string, userId: string): Promise<MemberAnalytics> => {
  const res = await api.get<MemberAnalytics>(`${base(slug)}/member/${userId}`);
  return res.data;
};
