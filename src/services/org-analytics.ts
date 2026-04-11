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

export interface AnalyticsFilters {
  groupId?: string;
  weeks?: number;
}

const buildParams = (filters: AnalyticsFilters = {}): string => {
  const p = new URLSearchParams();
  if (filters.groupId) p.append('groupId', filters.groupId);
  if (filters.weeks) p.append('weeks', String(filters.weeks));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const getOrgOverview = async (slug: string, filters: AnalyticsFilters = {}): Promise<OrgOverview> => {
  const res = await api.get<OrgOverview>(`${base(slug)}/overview${buildParams(filters)}`);
  return res.data;
};

export const getOrgReadiness = async (slug: string, filters: AnalyticsFilters = {}): Promise<CertReadiness[]> => {
  const res = await api.get<CertReadiness[]>(`${base(slug)}/readiness${buildParams(filters)}`);
  return res.data;
};

export const getOrgSkillGaps = async (slug: string, filters: AnalyticsFilters = {}): Promise<DomainGap[]> => {
  const res = await api.get<DomainGap[]>(`${base(slug)}/skill-gaps${buildParams(filters)}`);
  return res.data;
};

export const getOrgProgress = async (slug: string, filters: AnalyticsFilters = {}): Promise<WeeklyProgress[]> => {
  const res = await api.get<WeeklyProgress[]>(`${base(slug)}/progress${buildParams({ weeks: 12, ...filters })}`);
  return res.data;
};

export const getOrgEngagement = async (slug: string, filters: AnalyticsFilters = {}): Promise<OrgEngagement> => {
  const res = await api.get<OrgEngagement>(`${base(slug)}/engagement${buildParams(filters)}`);
  return res.data;
};

export const getMemberAnalytics = async (slug: string, userId: string): Promise<MemberAnalytics> => {
  const res = await api.get<MemberAnalytics>(`${base(slug)}/member/${userId}`);
  return res.data;
};
