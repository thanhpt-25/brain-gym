import api from "./api";

export type CertStatus =
  | "ACTIVE"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "NOT_CERTIFIED";

export interface Certification {
  id: string;
  competencyId: string;
  competencyName: string;
  achievedLevel: number;
  scaleMax: number;
  issuedAt: string;
  expiresAt: string;
  status: CertStatus;
  campaignName?: string | null;
}

export interface ComplianceRow {
  memberId: string;
  memberName: string;
  groupName?: string | null;
  competencyId: string;
  competencyName: string;
  certStatus: CertStatus | "NOT_CERTIFIED";
  achievedLevel?: number | null;
  requiredLevel: number;
  expiresAt?: string | null;
}

export interface ComplianceSummary {
  totalMembers: number;
  certified: number;
  expiringSoon: number;
  expired: number;
  notCertified: number;
}

export interface ComplianceResponse {
  summary: ComplianceSummary;
  rows: ComplianceRow[];
}

export const issueCertificationsByCampaign = (
  orgId: string,
  campaignId: string,
) =>
  api
    .post(
      `/organizations/${orgId}/campaigns/${campaignId}/issue-certifications`,
    )
    .then((r) => r.data);

export const getMemberCertifications = (
  orgId: string,
  memberId: string,
  status?: string,
) =>
  api
    .get(`/organizations/${orgId}/members/${memberId}/certifications`, {
      params: { status },
    })
    .then((r) => r.data);

export const getOrgCertifications = (
  orgId: string,
  filters?: {
    competencyId?: string;
    groupId?: string;
    status?: string;
    page?: number;
    limit?: number;
  },
) =>
  api
    .get(`/organizations/${orgId}/certifications`, { params: filters })
    .then((r) => r.data);

export const getComplianceDashboard = (
  orgId: string,
  filters?: { competencyId?: string; groupId?: string; status?: string },
): Promise<ComplianceResponse> =>
  api
    .get(`/organizations/${orgId}/certifications/compliance`, {
      params: filters,
    })
    .then((r) => r.data);
