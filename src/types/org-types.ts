// Organization types — aligned with backend Prisma responses

export type OrgRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER';
export type OrgInviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  industry: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  maxSeats: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { members: number };
}

export interface OrganizationWithRole extends Organization {
  myRole: OrgRole;
}

export interface OrgMember {
  id: string;
  orgId: string;
  userId: string;
  role: OrgRole;
  isActive: boolean;
  joinedAt: string;
  groupId: string | null;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
  };
  group: { id: string; name: string } | null;
}

export interface OrgGroup {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count: { members: number };
}

export interface OrgInvite {
  id: string;
  orgId: string;
  email: string;
  role: OrgRole;
  token: string;
  status: OrgInviteStatus;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

export interface OrgJoinLink {
  id: string;
  orgId: string;
  code: string;
  maxUses: number | null;
  currentUses: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface PaginatedMembers {
  data: OrgMember[];
  meta: {
    total: number;
    page: number;
    limit: number;
    lastPage: number;
  };
}

// Request payloads
export interface CreateOrgPayload {
  name: string;
  description?: string;
  industry?: string;
  logoUrl?: string;
  accentColor?: string;
}

export interface UpdateOrgPayload extends Partial<CreateOrgPayload> {}

export interface InviteMemberPayload {
  email: string;
  role: OrgRole;
}

export interface BulkInvitePayload {
  invites: InviteMemberPayload[];
}

export interface CreateJoinLinkPayload {
  maxUses?: number;
  expiresAt?: string;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
}

export interface UpdateGroupPayload {
  name?: string;
  description?: string;
}

export interface UpdateMemberRolePayload {
  role: OrgRole;
}
