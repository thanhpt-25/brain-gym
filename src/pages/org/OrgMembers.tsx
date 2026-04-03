import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Users, UserPlus, Search, Mail, Link2, MoreHorizontal,
  Shield, Crown, UserCog, User, Copy, Check, X, Plus, Loader2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useOrgStore } from '@/stores/org.store';
import {
  getMembers, getGroups, inviteMember, updateMemberRole,
  removeMember, createGroup, createJoinLink,
} from '@/services/organizations';
import type { OrgRole } from '@/types/org-types';

const roleIcons: Record<OrgRole, React.ElementType> = {
  OWNER: Crown, ADMIN: Shield, MANAGER: UserCog, MEMBER: User,
};

const roleColors: Record<OrgRole, string> = {
  OWNER: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ADMIN: 'bg-red-500/20 text-red-400 border-red-500/30',
  MANAGER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  MEMBER: 'bg-muted text-muted-foreground border-border',
};

const OrgMembers = () => {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'members';
  const queryClient = useQueryClient();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || '';
  const myRole = currentOrg?.myRole;
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('MEMBER');
  const [linkCopied, setLinkCopied] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['org-members', slug],
    queryFn: () => getMembers(slug),
    enabled: !!slug,
  });

  const { data: groups } = useQuery({
    queryKey: ['org-groups', slug],
    queryFn: () => getGroups(slug),
    enabled: !!slug,
  });

  const inviteMutation = useMutation({
    mutationFn: () => inviteMember(slug, { email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['org-members', slug] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to send invite'),
  });

  const roleChangeMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      updateMemberRole(slug, userId, { role }),
    onSuccess: () => {
      toast.success('Role updated');
      queryClient.invalidateQueries({ queryKey: ['org-members', slug] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update role'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(slug, userId),
    onSuccess: () => {
      toast.success('Member removed');
      queryClient.invalidateQueries({ queryKey: ['org-members', slug] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to remove member'),
  });

  const groupMutation = useMutation({
    mutationFn: () => createGroup(slug, { name: newGroupName, description: newGroupDesc || undefined }),
    onSuccess: () => {
      toast.success(`Group "${newGroupName}" created`);
      setNewGroupName('');
      setNewGroupDesc('');
      setGroupDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['org-groups', slug] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create group'),
  });

  const joinLinkMutation = useMutation({
    mutationFn: () => createJoinLink(slug, {}),
    onSuccess: (link) => {
      const url = `${window.location.origin}/org/join/${link.code}`;
      navigator.clipboard.writeText(url);
      setLinkCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setLinkCopied(false), 2000);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to generate link'),
  });

  const members = membersData?.data || [];
  const filtered = members.filter((m) => {
    const matchSearch =
      m.user.displayName.toLowerCase().includes(search.toLowerCase()) ||
      m.user.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || m.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-mono font-bold">Team Management</h1>
          <p className="text-sm text-muted-foreground font-mono">
            {currentOrg ? `${currentOrg._count.members}/${currentOrg.maxSeats} seats used` : ''}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => joinLinkMutation.mutate()}
              disabled={joinLinkMutation.isPending}
            >
              {linkCopied ? <Check className="h-4 w-4 mr-1.5" /> : <Link2 className="h-4 w-4 mr-1.5" />}
              {linkCopied ? 'Copied!' : 'Copy Invite Link'}
            </Button>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="glow-cyan">
                  <UserPlus className="h-4 w-4 mr-1.5" /> Invite
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="font-mono">Invite Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs">Email Address</Label>
                    <Input
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="bg-muted border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs">Role</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
                      <SelectTrigger className="bg-muted border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="MEMBER">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => inviteMutation.mutate()}
                    className="w-full glow-cyan"
                    disabled={!inviteEmail || inviteMutation.isPending}
                  >
                    {inviteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4 mr-1.5" />
                    )}
                    Send Invitation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="members" className="font-mono text-xs">
            <Users className="h-3 w-3 mr-1" /> Members
          </TabsTrigger>
          <TabsTrigger value="groups" className="font-mono text-xs">
            <Shield className="h-3 w-3 mr-1" /> Groups
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-muted border-border"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px] bg-muted border-border">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="OWNER">Owner</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="MEMBER">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {membersLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Card className="bg-card border-border overflow-hidden">
              <div className="divide-y divide-border">
                {filtered.map((member) => {
                  const RoleIcon = roleIcons[member.role];
                  return (
                    <div key={member.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                          <span className="text-xs font-mono font-bold">
                            {member.user.displayName.split(' ').map((n) => n[0]).join('')}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-mono font-medium truncate">{member.user.displayName}</p>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${roleColors[member.role]}`}>
                              <RoleIcon className="h-2.5 w-2.5 mr-0.5" />{member.role}
                            </Badge>
                            {!member.isActive && (
                              <Badge className="text-[10px] px-1.5 py-0 border-0 bg-red-500/20 text-red-400">
                                INACTIVE
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {member.group && (
                          <Badge variant="outline" className="text-[10px] hidden sm:flex">{member.group.name}</Badge>
                        )}
                        {canManage && member.role !== 'OWNER' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card border-border">
                              <DropdownMenuItem
                                className="font-mono text-xs"
                                onClick={() => roleChangeMutation.mutate({ userId: member.userId, role: 'ADMIN' })}
                              >
                                <Shield className="h-3 w-3 mr-2" /> Make Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="font-mono text-xs"
                                onClick={() => roleChangeMutation.mutate({ userId: member.userId, role: 'MANAGER' })}
                              >
                                <UserCog className="h-3 w-3 mr-2" /> Make Manager
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="font-mono text-xs"
                                onClick={() => roleChangeMutation.mutate({ userId: member.userId, role: 'MEMBER' })}
                              >
                                <User className="h-3 w-3 mr-2" /> Make Member
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="font-mono text-xs text-destructive"
                                onClick={() => removeMutation.mutate(member.userId)}
                              >
                                <X className="h-3 w-3 mr-2" /> Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground font-mono">
                    No members found
                  </div>
                )}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups" className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="glow-cyan">
                    <Plus className="h-4 w-4 mr-1.5" /> Create Group
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="font-mono">Create Group</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label className="font-mono text-xs">Group Name</Label>
                      <Input
                        placeholder="e.g. Cloud Team"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="bg-muted border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-mono text-xs">Description (optional)</Label>
                      <Input
                        placeholder="Brief description"
                        value={newGroupDesc}
                        onChange={(e) => setNewGroupDesc(e.target.value)}
                        className="bg-muted border-border"
                      />
                    </div>
                    <Button
                      onClick={() => groupMutation.mutate()}
                      className="w-full glow-cyan"
                      disabled={!newGroupName.trim() || groupMutation.isPending}
                    >
                      {groupMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : null}
                      Create Group
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups?.map((group) => (
              <Card key={group.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-mono font-medium">{group.name}</h3>
                  </div>
                  {group.description && (
                    <p className="text-xs text-muted-foreground mb-3">{group.description}</p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" /> {group._count.members} members
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!groups || groups.length === 0) && (
              <div className="col-span-full text-center py-8 text-sm text-muted-foreground font-mono">
                No groups yet
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrgMembers;
