import api from "./api";

export interface DomainMapping {
  id: string;
  assessmentId: string;
  domainKey: string;
  competencyId: string;
  weight: number;
  competency: { id: string; name: string; scaleMin: number; scaleMax: number };
}

export interface ScorecardRow {
  competencyId: string;
  name: string;
  scaleMin: number;
  scaleMax: number;
  score: number;
  pct: number;
  requiredLevel: number | null;
  gap: number | null;
}

export interface Scorecard {
  candidate: {
    name?: string;
    email: string;
    submittedAt?: string;
    overallScore?: number;
  };
  competencies: ScorecardRow[];
}

const base = (slug: string, assessmentId: string) =>
  `/organizations/${slug}/assessments/${assessmentId}`;

export const getDomainMappings = async (slug: string, assessmentId: string) => {
  const res = await api.get<DomainMapping[]>(
    `${base(slug, assessmentId)}/domain-mapping`,
  );
  return res.data;
};

export const upsertDomainMappings = async (
  slug: string,
  assessmentId: string,
  mappings: Array<{ domainKey: string; competencyId: string; weight: number }>,
) => {
  const res = await api.put<DomainMapping[]>(
    `${base(slug, assessmentId)}/domain-mapping`,
    { mappings },
  );
  return res.data;
};

export const getScorecard = async (
  slug: string,
  assessmentId: string,
  inviteId: string,
  jobRoleId?: string,
) => {
  const params = jobRoleId ? `?jobRoleId=${jobRoleId}` : "";
  const res = await api.get<Scorecard>(
    `${base(slug, assessmentId)}/candidates/${inviteId}/scorecard${params}`,
  );
  return res.data;
};

export const downloadScorecardCsv = async (
  slug: string,
  assessmentId: string,
  inviteId: string,
  jobRoleId?: string,
) => {
  const params = jobRoleId ? `?jobRoleId=${jobRoleId}` : "";
  const res = await api.get(
    `${base(slug, assessmentId)}/candidates/${inviteId}/scorecard/csv${params}`,
    { responseType: "blob" },
  );
  const url = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = `scorecard-${inviteId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
