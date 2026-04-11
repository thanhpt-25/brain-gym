import api from './api';
import type {
  Organization,
  OrganizationWithRole,
  OrgMember,
  OrgGroup,
  OrgInvite,
  OrgJoinLink,
  PaginatedMembers,
  CreateOrgPayload,
  UpdateOrgPayload,
  InviteMemberPayload,
  BulkInvitePayload,
  CreateJoinLinkPayload,
  CreateGroupPayload,
  UpdateGroupPayload,
  UpdateMemberRolePayload,
} from '@/types/org-types';

// Organization CRUD

export const createOrg = async (data: CreateOrgPayload): Promise<Organization> => {
  const response = await api.post<Organization>('/organizations', data);
  return response.data;
};

export const getMyOrgs = async (): Promise<OrganizationWithRole[]> => {
  const response = await api.get<OrganizationWithRole[]>('/organizations/my');
  return Array.isArray(response.data) ? response.data : [];
};

export const getOrg = async (slugOrId: string): Promise<Organization> => {
  const response = await api.get<Organization>(`/organizations/${slugOrId}`);
  return response.data;
};

export const updateOrg = async (slugOrId: string, data: UpdateOrgPayload): Promise<Organization> => {
  const response = await api.patch<Organization>(`/organizations/${slugOrId}`, data);
  return response.data;
};

export const deleteOrg = async (slugOrId: string): Promise<Organization> => {
  const response = await api.delete<Organization>(`/organizations/${slugOrId}`);
  return response.data;
};

// Members

export const getMembers = async (slugOrId: string, page = 1, limit = 20): Promise<PaginatedMembers> => {
  const response = await api.get<PaginatedMembers>(`/organizations/${slugOrId}/members`, {
    params: { page, limit },
  });
  return response.data;
};

export const inviteMember = async (slugOrId: string, data: InviteMemberPayload): Promise<OrgInvite> => {
  const response = await api.post<OrgInvite>(`/organizations/${slugOrId}/members/invite`, data);
  return response.data;
};

export const bulkInvite = async (slugOrId: string, data: BulkInvitePayload): Promise<OrgInvite[]> => {
  const response = await api.post<OrgInvite[]>(`/organizations/${slugOrId}/members/bulk-invite`, data);
  return response.data;
};

export const updateMemberRole = async (
  slugOrId: string,
  userId: string,
  data: UpdateMemberRolePayload,
): Promise<OrgMember> => {
  const response = await api.patch<OrgMember>(`/organizations/${slugOrId}/members/${userId}`, data);
  return response.data;
};

export const removeMember = async (slugOrId: string, userId: string): Promise<OrgMember> => {
  const response = await api.delete<OrgMember>(`/organizations/${slugOrId}/members/${userId}`);
  return response.data;
};

export const assignMemberToGroup = async (
  slugOrId: string,
  userId: string,
  groupId: string | null,
): Promise<OrgMember> => {
  const response = await api.patch<OrgMember>(`/organizations/${slugOrId}/members/${userId}`, { groupId });
  return response.data;
};

// Invites & Join Links

export const acceptInvite = async (token: string): Promise<OrgMember> => {
  const response = await api.post<OrgMember>(`/organizations/accept-invite/${token}`);
  return response.data;
};

export const joinViaLink = async (code: string): Promise<OrgMember> => {
  const response = await api.get<OrgMember>(`/organizations/join/${code}`);
  return response.data;
};

export const createJoinLink = async (slugOrId: string, data: CreateJoinLinkPayload): Promise<OrgJoinLink> => {
  const response = await api.post<OrgJoinLink>(`/organizations/${slugOrId}/join-links`, data);
  return response.data;
};

// Groups

export const getGroups = async (slugOrId: string): Promise<OrgGroup[]> => {
  const response = await api.get<OrgGroup[]>(`/organizations/${slugOrId}/groups`);
  return Array.isArray(response.data) ? response.data : [];
};

export const createGroup = async (slugOrId: string, data: CreateGroupPayload): Promise<OrgGroup> => {
  const response = await api.post<OrgGroup>(`/organizations/${slugOrId}/groups`, data);
  return response.data;
};

export const updateGroup = async (
  slugOrId: string,
  groupId: string,
  data: UpdateGroupPayload,
): Promise<OrgGroup> => {
  const response = await api.patch<OrgGroup>(`/organizations/${slugOrId}/groups/${groupId}`, data);
  return response.data;
};
