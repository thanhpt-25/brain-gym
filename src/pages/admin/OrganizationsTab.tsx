import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdminOrganizations,
  getAdminOrgMembers,
  updateAdminOrganization,
  deleteAdminOrganization,
  updateAdminOrgMemberRole,
  removeAdminOrgMember,
  AdminOrganization,
  AdminOrgMember,
} from '@/services/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Building2, Search, Loader2, Pencil, Trash2, Users, ChevronLeft, X,
} from 'lucide-react';
import { toast } from 'sonner';

const ORG_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'];

const planBadge: Record<string, { className: string; label: string }> = {
  FREE: { className: 'bg-muted text-muted-foreground', label: 'Free' },
  PREMIUM: { className: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Premium' },
  ENTERPRISE: { className: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: 'Enterprise' },
};

export default function OrganizationsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editOrg, setEditOrg] = useState<AdminOrganization | null>(null);
  const [deleteOrg, setDeleteOrg] = useState<AdminOrganization | null>(null);
  const [viewMembersOrg, setViewMembersOrg] = useState<AdminOrganization | null>(null);
  const [membersPage, setMembersPage] = useState(1);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editMaxSeats, setEditMaxSeats] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-organizations', search, page],
    queryFn: () => getAdminOrganizations(page, 20, search || undefined),
  });

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['admin-org-members', viewMembersOrg?.id, membersPage],
    queryFn: () => getAdminOrgMembers(viewMembersOrg!.id, membersPage, 20),
    enabled: !!viewMembersOrg,
  });

  const updateMutation = useMutation({
    mutationFn: ({ orgId, data }: { orgId: string; data: Record<string, unknown> }) =>
      updateAdminOrganization(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      toast.success('Organization updated');
      setEditOrg(null);
    },
    onError: () => toast.error('Failed to update organization'),
  });

  const deleteMutation = useMutation({
    mutationFn: (orgId: string) => deleteAdminOrganization(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      toast.success('Organization deleted');
      setDeleteOrg(null);
    },
    onError: () => toast.error('Failed to delete organization'),
  });

  const memberRoleMutation = useMutation({
    mutationFn: ({ orgId, userId, role }: { orgId: string; userId: string; role: string }) =>
      updateAdminOrgMemberRole(orgId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-org-members'] });
      toast.success('Member role updated');
    },
    onError: () => toast.error('Failed to update member role'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ orgId, userId }: { orgId: string; userId: string }) =>
      removeAdminOrgMember(orgId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-org-members'] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      toast.success('Member removed');
    },
    onError: () => toast.error('Failed to remove member'),
  });

  const openEdit = (org: AdminOrganization) => {
    setEditOrg(org);
    setEditName(org.name);
    setEditDescription(org.description ?? '');
    setEditIndustry(org.industry ?? '');
    setEditMaxSeats(org.maxSeats.toString());
    setEditIsActive(org.isActive);
  };

  const handleEditSubmit = () => {
    if (!editOrg) return;
    updateMutation.mutate({
      orgId: editOrg.id,
      data: {
        name: editName,
        description: editDescription || undefined,
        industry: editIndustry || undefined,
        maxSeats: parseInt(editMaxSeats) || editOrg.maxSeats,
        isActive: editIsActive,
      },
    });
  };

  const orgs = data?.data ?? [];

  // Members view
  if (viewMembersOrg) {
    const members: AdminOrgMember[] = membersData?.data ?? [];
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-mono flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setViewMembersOrg(null); setMembersPage(1); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Users className="h-4 w-4 text-primary" />
            Members — {viewMembersOrg.name}
            <Badge variant="outline" className="ml-2 text-[10px] font-mono">{viewMembersOrg.slug}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono">User</TableHead>
                    <TableHead className="font-mono">Email</TableHead>
                    <TableHead className="font-mono text-center">Org Role</TableHead>
                    <TableHead className="font-mono text-center">Plan</TableHead>
                    <TableHead className="font-mono text-center">Joined</TableHead>
                    <TableHead className="font-mono text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-sm">{m.user.displayName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.user.email}</TableCell>
                      <TableCell className="text-center">
                        <Select
                          value={m.role}
                          onValueChange={role => memberRoleMutation.mutate({ orgId: viewMembersOrg.id, userId: m.userId, role })}
                        >
                          <SelectTrigger className="h-7 w-[120px] text-xs font-mono mx-auto"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ORG_ROLES.map(r => <SelectItem key={r} value={r} className="text-xs font-mono">{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[10px] font-mono ${planBadge[m.user.plan]?.className || ''}`}>
                          {planBadge[m.user.plan]?.label || m.user.plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground font-mono">
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          title="Remove member"
                          onClick={() => removeMemberMutation.mutate({ orgId: viewMembersOrg.id, userId: m.userId })}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {membersData && membersData.meta.lastPage > 1 && (
                <div className="flex justify-center mt-4 gap-2">
                  <Button size="sm" variant="outline" disabled={membersPage === 1} onClick={() => setMembersPage(p => p - 1)}>Prev</Button>
                  <span className="py-2 px-3 text-xs font-mono text-muted-foreground">Page {membersPage}/{membersData.meta.lastPage}</span>
                  <Button size="sm" variant="outline" disabled={membersPage >= membersData.meta.lastPage} onClick={() => setMembersPage(p => p + 1)}>Next</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Main org list
  return (
    <>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-mono flex items-center justify-between">
            <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Organizations</span>
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search orgs..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-8 text-sm" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono">Name</TableHead>
                    <TableHead className="font-mono">Owner</TableHead>
                    <TableHead className="font-mono text-center">Plan</TableHead>
                    <TableHead className="font-mono text-center">Members</TableHead>
                    <TableHead className="font-mono text-center">Max Seats</TableHead>
                    <TableHead className="font-mono text-center">Status</TableHead>
                    <TableHead className="font-mono text-center">Created</TableHead>
                    <TableHead className="font-mono text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgs.map(org => {
                    const ownerPlan = org.owner?.plan || 'FREE';
                    const pb = planBadge[ownerPlan] || planBadge.FREE;
                    return (
                      <TableRow key={org.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium font-mono">{org.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">/{org.slug}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {org.owner ? (
                            <div>
                              <p className="text-sm">{org.owner.displayName}</p>
                              <p className="text-xs text-muted-foreground">{org.owner.email}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No owner</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-[10px] font-mono ${pb.className}`}>{pb.label}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm">{org.memberCount}</TableCell>
                        <TableCell className="text-center font-mono text-sm">{org.maxSeats}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={org.isActive ? 'outline' : 'destructive'} className="text-[10px] font-mono">
                            {org.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground font-mono">
                          {new Date(org.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="View members" onClick={() => { setViewMembersOrg(org); setMembersPage(1); }}>
                              <Users className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => openEdit(org)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete" onClick={() => setDeleteOrg(org)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {data && data.meta.lastPage > 1 && (
                <div className="flex justify-center mt-4 gap-2">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                  <span className="py-2 px-3 text-xs font-mono text-muted-foreground">Page {page}/{data.meta.lastPage}</span>
                  <Button size="sm" variant="outline" disabled={page >= data.meta.lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editOrg} onOpenChange={(open) => !open && setEditOrg(null)}>
        <DialogContent className="glass-card border-border max-w-md">
          <DialogHeader><DialogTitle className="font-mono text-sm">Edit Organization</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-mono">Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono">Description</Label>
              <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} className="text-sm" placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono">Industry</Label>
              <Input value={editIndustry} onChange={e => setEditIndustry(e.target.value)} className="text-sm" placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono">Max Seats</Label>
              <Input type="number" value={editMaxSeats} onChange={e => setEditMaxSeats(e.target.value)} className="text-sm" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-mono">Active</Label>
              <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditOrg(null)} className="font-mono text-xs">Cancel</Button>
            <Button size="sm" onClick={handleEditSubmit} disabled={updateMutation.isPending} className="font-mono text-xs">
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteOrg} onOpenChange={(open) => !open && setDeleteOrg(null)}>
        <DialogContent className="glass-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="font-mono text-sm">Delete Organization</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong className="text-foreground">{deleteOrg?.name}</strong>?
            This will permanently remove the organization and all its data (members, questions, catalogs, etc.).
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteOrg(null)} className="font-mono text-xs">Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteOrg && deleteMutation.mutate(deleteOrg.id)} disabled={deleteMutation.isPending} className="font-mono text-xs">
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
