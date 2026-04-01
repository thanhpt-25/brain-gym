import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Users, UserPlus, Search, Mail, Link2, Globe, MoreHorizontal,
  Shield, Crown, UserCog, User, Copy, Check, X, Plus, Pencil, Trash2
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  mockMembers, mockGroups, mockInvites, mockOrg,
  roleColors, statusColors, OrgRole, OrgMember
} from '@/data/mockOrgData';
import { toast } from 'sonner';

const roleIcons: Record<OrgRole, React.ElementType> = {
  OWNER: Crown, ADMIN: Shield, MANAGER: UserCog, MEMBER: User,
};

const OrgMembers = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'members';
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('MEMBER');
  const [linkCopied, setLinkCopied] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const filtered = mockMembers.filter(m => {
    const matchSearch = m.displayName.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || m.role === roleFilter;
    const matchGroup = groupFilter === 'all' || m.group === groupFilter;
    return matchSearch && matchRole && matchGroup;
  });

  const handleInvite = () => {
    if (!inviteEmail) return;
    toast.success(`Invitation sent to ${inviteEmail}`);
    setInviteEmail('');
    setInviteOpen(false);
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`https://certgym.com/join/${mockOrg.slug}`);
    setLinkCopied(true);
    toast.success('Invite link copied!');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    toast.success(`Group "${newGroupName}" created`);
    setNewGroupName('');
    setGroupDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar title="Team" />

      <div className="container pt-20 pb-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-mono font-bold">Team Management</h1>
            <p className="text-sm text-muted-foreground font-mono">
              {mockOrg.usedSeats}/{mockOrg.seats} seats used
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyInviteLink}>
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
                      onChange={e => setInviteEmail(e.target.value)}
                      className="bg-muted border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs">Role</Label>
                    <Select value={inviteRole} onValueChange={v => setInviteRole(v as OrgRole)}>
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

                  {/* Domain allowlist info */}
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="h-4 w-4 text-primary" />
                      <span className="text-xs font-mono font-medium">Domain Allowlist</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Users with these email domains can auto-join: {mockOrg.domainAllowlist.map(d => (
                        <Badge key={d} variant="outline" className="ml-1 text-[10px]">{d}</Badge>
                      ))}
                    </p>
                  </div>

                  <Button onClick={handleInvite} className="w-full glow-cyan" disabled={!inviteEmail}>
                    <Mail className="h-4 w-4 mr-1.5" /> Send Invitation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList className="bg-secondary">
            <TabsTrigger value="members" className="font-mono text-xs"><Users className="h-3 w-3 mr-1" /> Members</TabsTrigger>
            <TabsTrigger value="invites" className="font-mono text-xs"><Mail className="h-3 w-3 mr-1" /> Invites</TabsTrigger>
            <TabsTrigger value="groups" className="font-mono text-xs"><Shield className="h-3 w-3 mr-1" /> Groups</TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
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
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-[160px] bg-muted border-border">
                  <SelectValue placeholder="All Groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {mockGroups.map(g => (
                    <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card className="bg-card border-border overflow-hidden">
              <div className="divide-y divide-border">
                {filtered.map(member => {
                  const RoleIcon = roleIcons[member.role];
                  return (
                    <div key={member.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                          <span className="text-xs font-mono font-bold">{member.displayName.split(' ').map(n => n[0]).join('')}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-mono font-medium truncate">{member.displayName}</p>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${roleColors[member.role]}`}>
                              <RoleIcon className="h-2.5 w-2.5 mr-0.5" />{member.role}
                            </Badge>
                            {member.status !== 'ACTIVE' && (
                              <Badge className={`text-[10px] px-1.5 py-0 border-0 ${statusColors[member.status]}`}>
                                {member.status}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {member.group && (
                          <Badge variant="outline" className="text-[10px] hidden sm:flex">{member.group}</Badge>
                        )}
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-mono">{member.avgScore > 0 ? `${member.avgScore}%` : '—'}</p>
                          <p className="text-[10px] text-muted-foreground">{member.examsCompleted} exams</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card border-border">
                            <DropdownMenuItem className="font-mono text-xs" onClick={() => toast.info('View profile')}>
                              <User className="h-3 w-3 mr-2" /> View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem className="font-mono text-xs" onClick={() => toast.info('Change role')}>
                              <UserCog className="h-3 w-3 mr-2" /> Change Role
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="font-mono text-xs text-destructive" onClick={() => toast.info('Remove member')}>
                              <X className="h-3 w-3 mr-2" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          {/* Invites Tab */}
          <TabsContent value="invites" className="space-y-4">
            <Card className="bg-card border-border overflow-hidden">
              <div className="divide-y divide-border">
                {mockInvites.map(invite => (
                  <div key={invite.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-mono">{invite.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Invited {invite.createdAt} · Expires {invite.expiresAt}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${roleColors[invite.role]}`}>{invite.role}</Badge>
                      <Badge className={`text-[10px] border-0 ${
                        invite.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' :
                        invite.status === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {invite.status}
                      </Badge>
                      {invite.status === 'PENDING' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info('Resend invite')}>
                          <Mail className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Groups Tab */}
          <TabsContent value="groups" className="space-y-4">
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
                        onChange={e => setNewGroupName(e.target.value)}
                        className="bg-muted border-border"
                      />
                    </div>
                    <Button onClick={handleCreateGroup} className="w-full glow-cyan" disabled={!newGroupName.trim()}>
                      Create Group
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockGroups.map(group => (
                <Card key={group.id} className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                        <h3 className="font-mono font-medium">{group.name}</h3>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border">
                          <DropdownMenuItem className="font-mono text-xs"><Pencil className="h-3 w-3 mr-2" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="font-mono text-xs text-destructive"><Trash2 className="h-3 w-3 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {group.description && (
                      <p className="text-xs text-muted-foreground mb-3">{group.description}</p>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" /> {group.memberCount} members
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default OrgMembers;
