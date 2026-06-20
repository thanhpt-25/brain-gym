import api from "./api";

export interface ScreeningRule {
  id: string;
  assessmentId: string;
  action: "SHORTLIST" | "REJECT";
  minScore?: number;
  maxScore?: number;
  minIntegrity?: number;
  minDomainScores?: Record<string, number>;
  priority: number;
  isActive: boolean;
  createdAt: string;
}

export interface DecisionLog {
  id: string;
  inviteId: string;
  fromStage?: string;
  toStage: string;
  decidedBy: string;
  ruleId?: string;
  ruleSnapshot?: unknown;
  scoreSnapshot?: unknown;
  note?: string;
  createdAt: string;
}

const base = (slug: string, assessmentId: string) =>
  `/organizations/${slug}/assessments/${assessmentId}/screening-rules`;

export const getScreeningRules = async (slug: string, assessmentId: string) => {
  const res = await api.get<ScreeningRule[]>(base(slug, assessmentId));
  return res.data;
};

export const createScreeningRule = async (
  slug: string,
  assessmentId: string,
  data: Omit<ScreeningRule, "id" | "assessmentId" | "createdAt">,
) => {
  const res = await api.post<ScreeningRule>(base(slug, assessmentId), data);
  return res.data;
};

export const updateScreeningRule = async (
  slug: string,
  assessmentId: string,
  ruleId: string,
  data: Partial<Omit<ScreeningRule, "id" | "assessmentId" | "createdAt">>,
) => {
  const res = await api.patch<ScreeningRule>(
    `${base(slug, assessmentId)}/${ruleId}`,
    data,
  );
  return res.data;
};

export const deleteScreeningRule = async (
  slug: string,
  assessmentId: string,
  ruleId: string,
) => {
  await api.delete(`${base(slug, assessmentId)}/${ruleId}`);
};

export const getDecisionLog = async (
  slug: string,
  assessmentId: string,
  inviteId: string,
) => {
  const res = await api.get<DecisionLog[]>(
    `${base(slug, assessmentId)}/invites/${inviteId}/decision-log`,
  );
  return res.data;
};
