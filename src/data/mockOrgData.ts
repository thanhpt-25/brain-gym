export type OrgRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER';
export type MemberStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';
export type InviteMethod = 'EMAIL' | 'LINK' | 'DOMAIN';

export interface OrgMember {
  id: string;
  displayName: string;
  email: string;
  avatar?: string;
  role: OrgRole;
  status: MemberStatus;
  joinedAt: string;
  group?: string;
  examsCompleted: number;
  avgScore: number;
}

export interface OrgGroup {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  color: string;
}

export interface OrgInvite {
  id: string;
  email?: string;
  method: InviteMethod;
  role: OrgRole;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  createdAt: string;
  expiresAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  primaryColor: string;
  seats: number;
  usedSeats: number;
  plan: 'ENTERPRISE';
  domainAllowlist: string[];
  createdAt: string;
}

export const mockOrg: Organization = {
  id: 'org-1',
  name: 'Acme Corporation',
  slug: 'acme-corp',
  primaryColor: '#00bcd4',
  seats: 50,
  usedSeats: 23,
  plan: 'ENTERPRISE',
  domainAllowlist: ['acme.com', 'acme.io'],
  createdAt: '2025-08-15T00:00:00Z',
};

export const mockMembers: OrgMember[] = [
  { id: 'm1', displayName: 'Sarah Chen', email: 'sarah@acme.com', role: 'OWNER', status: 'ACTIVE', joinedAt: '2025-08-15', group: 'Engineering', examsCompleted: 12, avgScore: 92 },
  { id: 'm2', displayName: 'Mike Johnson', email: 'mike@acme.com', role: 'ADMIN', status: 'ACTIVE', joinedAt: '2025-09-01', group: 'Engineering', examsCompleted: 8, avgScore: 87 },
  { id: 'm3', displayName: 'Lisa Wang', email: 'lisa@acme.com', role: 'MANAGER', status: 'ACTIVE', joinedAt: '2025-09-10', group: 'DevOps', examsCompleted: 15, avgScore: 95 },
  { id: 'm4', displayName: 'Tom Harris', email: 'tom@acme.com', role: 'MEMBER', status: 'ACTIVE', joinedAt: '2025-10-01', group: 'Engineering', examsCompleted: 5, avgScore: 78 },
  { id: 'm5', displayName: 'Anna Lee', email: 'anna@acme.com', role: 'MEMBER', status: 'ACTIVE', joinedAt: '2025-10-15', group: 'Security', examsCompleted: 3, avgScore: 82 },
  { id: 'm6', displayName: 'David Kim', email: 'david@acme.com', role: 'MEMBER', status: 'INVITED', joinedAt: '', group: undefined, examsCompleted: 0, avgScore: 0 },
  { id: 'm7', displayName: 'Emily Park', email: 'emily@acme.com', role: 'MEMBER', status: 'ACTIVE', joinedAt: '2025-11-01', group: 'DevOps', examsCompleted: 7, avgScore: 88 },
  { id: 'm8', displayName: 'James Wilson', email: 'james@acme.com', role: 'MEMBER', status: 'SUSPENDED', joinedAt: '2025-09-20', group: 'Engineering', examsCompleted: 2, avgScore: 65 },
];

export const mockGroups: OrgGroup[] = [
  { id: 'g1', name: 'Engineering', description: 'Software engineering team', memberCount: 4, color: '#00bcd4' },
  { id: 'g2', name: 'DevOps', description: 'Infrastructure & operations', memberCount: 2, color: '#4caf50' },
  { id: 'g3', name: 'Security', description: 'Cybersecurity team', memberCount: 1, color: '#ff9800' },
];

export const mockInvites: OrgInvite[] = [
  { id: 'i1', email: 'david@acme.com', method: 'EMAIL', role: 'MEMBER', status: 'PENDING', createdAt: '2026-03-20', expiresAt: '2026-04-20' },
  { id: 'i2', email: 'new@acme.com', method: 'EMAIL', role: 'MEMBER', status: 'PENDING', createdAt: '2026-03-25', expiresAt: '2026-04-25' },
  { id: 'i3', email: 'old@acme.com', method: 'EMAIL', role: 'MEMBER', status: 'EXPIRED', createdAt: '2026-01-01', expiresAt: '2026-02-01' },
];

export const roleColors: Record<OrgRole, string> = {
  OWNER: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ADMIN: 'bg-red-500/20 text-red-400 border-red-500/30',
  MANAGER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  MEMBER: 'bg-muted text-muted-foreground border-border',
};

export const statusColors: Record<MemberStatus, string> = {
  ACTIVE: 'bg-emerald-500/20 text-emerald-400',
  INVITED: 'bg-amber-500/20 text-amber-400',
  SUSPENDED: 'bg-red-500/20 text-red-400',
};
