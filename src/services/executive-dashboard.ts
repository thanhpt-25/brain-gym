import api from "./api";

export interface ComplianceMetrics {
  totalMembers: number;
  certifiedMembers: number;
  certRate: number;
  certsByStatus: { active: number; expiringSoon: number; expired: number };
}

export interface HiringFunnel {
  campaigns: number;
  activeCampaigns: number;
  totalCandidates: number;
  started: number;
  submitted: number;
  passed: number;
  conversionRate: number;
  passRate: number;
}

export interface IntegrityMetrics {
  totalSubmitted: number;
  flaggedCount: number;
  flagRate: number;
  avgIntegrityScore: number | null;
}

export interface ExecutiveDashboard {
  compliance: ComplianceMetrics;
  funnel: HiringFunnel;
  integrity: IntegrityMetrics;
  generatedAt: string;
}

export const getExecutiveDashboard = (
  orgId: string,
): Promise<ExecutiveDashboard> =>
  api.get(`/organizations/${orgId}/executive-dashboard`).then((r) => r.data);

export const getExecutiveDashboardCsvUrl = (orgId: string) =>
  `/api/v1/organizations/${orgId}/executive-dashboard/export/csv`;
