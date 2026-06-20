import api from "./api";

export interface ApplyLink {
  id: string;
  jobRoleId: string;
  assessmentId: string;
  code: string;
  isActive: boolean;
  maxUses?: number;
  currentUses: number;
  expiresAt?: string;
  createdAt: string;
}

export interface PublicLinkInfo {
  jobRole: { id: string; title: string };
  assessment: {
    id: string;
    title: string;
    description?: string;
    timeLimit: number;
    questionCount: number;
  };
  expiresAt?: string;
  maxUses?: number;
  currentUses: number;
}

export const getPublicLink = async (code: string) => {
  const res = await api.get<PublicLinkInfo>(`/apply/${code}`);
  return res.data;
};

export const submitApplication = async (
  code: string,
  data: {
    email: string;
    fullName: string;
    consentGiven: boolean;
    honeypot?: string;
  },
) => {
  const res = await api.post<{ token: string; alreadyApplied: boolean }>(
    `/apply/${code}`,
    data,
  );
  return res.data;
};

const adminBase = (slug: string, jobRoleId: string) =>
  `/organizations/${slug}/job-roles/${jobRoleId}/apply-links`;

export const getApplyLinks = async (slug: string, jobRoleId: string) => {
  const res = await api.get<ApplyLink[]>(adminBase(slug, jobRoleId));
  return res.data;
};

export const createApplyLink = async (
  slug: string,
  jobRoleId: string,
  data: { assessmentId: string; maxUses?: number; expiresAt?: string },
) => {
  const res = await api.post<ApplyLink>(adminBase(slug, jobRoleId), data);
  return res.data;
};

export const deactivateApplyLink = async (
  slug: string,
  jobRoleId: string,
  linkId: string,
) => {
  await api.delete(`${adminBase(slug, jobRoleId)}/${linkId}`);
};
