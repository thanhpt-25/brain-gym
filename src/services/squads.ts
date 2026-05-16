import api from "./api";
import { Organization, OrgMember } from "../types/org-types";
import { ReadinessScore } from "../types/api-types";

/**
 * Squads are Organizations with kind='SQUAD'
 * This DTO extends the base Organization with squad-specific fields
 */
export interface SquadDto extends Organization {
  certificationId: string;
  targetExamDate?: string;
  memberCount: number;
}

/**
 * Response when generating an invite link token
 */
export interface InviteLinkDto {
  token: string;
  expiresAt: string;
  squadName: string;
  joinUrl: string;
}

/**
 * Fetch squad by slug
 * Delegates to /organizations endpoint (squads are orgs with kind='SQUAD')
 */
export async function getSquadBySlug(slug: string): Promise<SquadDto> {
  const response = await api.get<SquadDto>(`/organizations/by-slug/${slug}`);
  return response.data;
}

/**
 * Fetch squad members with nested user data
 * Reuses the existing /organizations/{id}/members endpoint
 */
export async function getSquadMembers(squadId: string): Promise<OrgMember[]> {
  const response = await api.get<OrgMember[]>(
    `/organizations/${squadId}/members`,
  );
  return response.data || [];
}

/**
 * Fetch squad readiness score
 * Returns composite readiness across all members for the certification
 * Delegates to existing /insights/readiness endpoint
 */
export async function getSquadReadiness(
  certificationId: string,
): Promise<ReadinessScore> {
  const response = await api.get<ReadinessScore>(
    `/insights/readiness?certificationId=${certificationId}`,
  );
  return response.data;
}

/**
 * Create invite link for squad (generates token with 7-day TTL)
 */
export async function createSquadInviteLink(
  squadId: string,
): Promise<InviteLinkDto> {
  const response = await api.post<InviteLinkDto>(`/squads/${squadId}/invites`);
  return response.data;
}

/**
 * Join squad using invite token
 */
export async function joinSquadWithToken(token: string): Promise<SquadDto> {
  const response = await api.post<SquadDto>(`/squads/join/${token}`);
  return response.data;
}
