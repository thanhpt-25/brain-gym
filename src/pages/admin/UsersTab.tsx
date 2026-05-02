import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, updateUserRole, updateUserPlan, suspendUser, banUser, reactivateUser, adjustUserPoints, bulkUpdateUserRole, exportUsers } from '@/services/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Users, Search, Loader2, Ban, ShieldOff, ShieldCheck, Coins, Download } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = ['LEARNER', 'CONTRIBUTOR', 'REVIEWER', 'ADMIN'];
const PLANS = ['FREE', 'PREMIUM', 'ENTERPRISE'];

const planBadge: Record<string, string> = {
  FREE: 'bg-muted text-muted-foreground',
  PREMIUM: 'bg-blue-500/20 text-blue-400',
  ENTERPRISE: 'bg-purple-500/20 text-purple-400',
};

const statusBadge: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  ACTIVE: { variant: 'outline', label: 'Active' },
  SUSPENDED: { variant: 'secondary', label: 'Suspended' },
  BANNED: { variant: 'destructive', label: 'Banned' },
};

export default function UsersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRoleDialog, setBulkRoleDialog] = useState(false);
  const [bulkRole, setBulkRole] = useState('LEARNER');
  const [actionDialog, setActionDialog] = useState<{ type: 'suspend' | 'ban' | 'points'; userId: string; userName: string } | null>(null);
  const [reason, setReason] = useState('');
  const [suspendUntil, setSuspendUntil] = useState('');
  const [pointsAmount, setPointsAmount] = useState('');
  const [pointsReason, setPointsReason] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, page],
    queryFn: () => getUsers(search || undefined, page, 20),
  });

  const users = data?.data ?? [];
  const allSelected = users.length > 0 && users.every(u => selected.has(u.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(users.map(u => u.id)));
  };
  const toggleOne = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => updateUserRole(userId, role),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Role updated'); },
    onError: () => toast.error('Failed to update role'),
  });

  const planMutation = useMutation({
    mutationFn: ({ userId, plan }: { userId: string; plan: string }) => updateUserPlan(userId, plan),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Plan updated'); },
    onError: () => toast.error('Failed to update plan'),
  });

  const bulkRoleMutation = useMutation({
    mutationFn: ({ userIds, role }: { userIds: string[]; role: string }) => bulkUpdateUserRole(userIds, role),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSelected(new Set()); setBulkRoleDialog(false);
      toast.success(`${data.updated} user(s) updated to ${bulkRole}`);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Bulk role update failed'),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ userId, reason, suspendedUntil }: { userId: string; reason: string; suspendedUntil?: string }) => suspendUser(userId, reason, suspendedUntil),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User suspended'); setActionDialog(null); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to suspend'),
  });

  const banMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) => banUser(userId, reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User banned'); setActionDialog(null); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to ban'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (userId: string) => reactivateUser(userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User reactivated'); },
    onError: () => toast.error('Failed to reactivate'),
  });

  const pointsMutation = useMutation({
    mutationFn: ({ userId, amount, reason }: { userId: string; amount: number; reason?: string }) => adjustUserPoints(userId, amount, reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Points adjusted'); setActionDialog(null); },
    onError: () => toast.error('Failed to adjust points'),
  });

  const openAction = (type: 'suspend' | 'ban' | 'points', userId: string, userName: string) => {
    setActionDialog({ type, userId, userName });
    setReason(''); setSuspendUntil(''); setPointsAmount(''); setPointsReason('');
  };

  const handleActionSubmit = () => {
    if (!actionDialog) return;
    if (actionDialog.type === 'suspend') suspendMutation.mutate({ userId: actionDialog.userId, reason, suspendedUntil: suspendUntil || undefined });
    else if (actionDialog.type === 'ban') banMutation.mutate({ userId: actionDialog.userId, reason });
    else if (actionDialog.type === 'points') {
      const amount = parseInt(pointsAmount);
      if (isNaN(amount) || amount === 0) { toast.error('Enter a valid non-zero amount'); return; }
      pointsMutation.mutate({ userId: actionDialog.userId, amount, reason: pointsReason || undefined });
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try { await exportUsers(); toast.success('Users exported'); }
    catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  return (
    <>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-mono flex items-center justify-between">
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> User Management</span>
            <div className="flex items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search users..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-8 text-sm" />
              </div>
              <Button size="sm" variant="outline" className="h-8 font-mono text-xs" onClick={handleExport} disabled={exporting}>
                <Download className="h-3 w-3 mr-1" /> {exporting ? 'Exporting...' : 'CSV'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <span className="text-xs font-mono text-primary">{selected.size} selected</span>
              <Button size="sm" variant="outline" className="h-7 font-mono text-xs" onClick={() => setBulkRoleDialog(true)}>
                Change Role
              </Button>
              <Button size="sm" variant="ghost" className="h-7 font-mono text-xs ml-auto" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
                    <TableHead className="font-mono">User</TableHead>
                    <TableHead className="font-mono">Email</TableHead>
                    <TableHead className="font-mono text-center">Role</TableHead>
                    <TableHead className="font-mono text-center">Plan</TableHead>
                    <TableHead className="font-mono text-center">Status</TableHead>
                    <TableHead className="font-mono text-center">Points</TableHead>
                    <TableHead className="font-mono text-center">Qs</TableHead>
                    <TableHead className="font-mono text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => {
                    const sb = statusBadge[u.status] || statusBadge.ACTIVE;
                    return (
                      <TableRow key={u.id} className={selected.has(u.id) ? 'bg-primary/5' : ''}>
                        <TableCell><Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggleOne(u.id)} /></TableCell>
                        <TableCell className="font-medium text-sm">{u.displayName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell className="text-center">
                          <Select value={u.role} onValueChange={role => roleMutation.mutate({ userId: u.id, role })}>
                            <SelectTrigger className="h-7 w-[130px] text-xs font-mono mx-auto"><SelectValue /></SelectTrigger>
                            <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r} className="text-xs font-mono">{r}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          <Select value={u.plan || 'FREE'} onValueChange={plan => planMutation.mutate({ userId: u.id, plan })}>
                            <SelectTrigger className={`h-7 w-[130px] text-xs font-mono mx-auto ${planBadge[u.plan || 'FREE'] || ''}`}><SelectValue /></SelectTrigger>
                            <SelectContent>{PLANS.map(p => <SelectItem key={p} value={p} className="text-xs font-mono">{p}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={sb.variant} className="text-[10px] font-mono">{sb.label}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm">{u.points}</TableCell>
                        <TableCell className="text-center font-mono text-sm">{u._count.questions}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Adjust points" onClick={() => openAction('points', u.id, u.displayName)}>
                              <Coins className="h-3 w-3" />
                            </Button>
                            {u.status === 'ACTIVE' && u.role !== 'ADMIN' && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-warning" title="Suspend" onClick={() => openAction('suspend', u.id, u.displayName)}>
                                  <ShieldOff className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Ban" onClick={() => openAction('ban', u.id, u.displayName)}>
                                  <Ban className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            {(u.status === 'SUSPENDED' || u.status === 'BANNED') && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-accent" title="Reactivate" onClick={() => reactivateMutation.mutate(u.id)}>
                                <ShieldCheck className="h-3 w-3" />
                              </Button>
                            )}
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

      {/* Bulk Role Dialog */}
      <Dialog open={bulkRoleDialog} onOpenChange={(o) => !o && setBulkRoleDialog(false)}>
        <DialogContent className="glass-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="font-mono">Change Role for {selected.size} Users</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs font-mono">New Role</Label>
            <Select value={bulkRole} onValueChange={setBulkRole}>
              <SelectTrigger className="mt-1 font-mono text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.filter(r => r !== 'ADMIN').map(r => <SelectItem key={r} value={r} className="font-mono">{r}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">Admin users will be skipped automatically.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setBulkRoleDialog(false)} className="font-mono text-xs">Cancel</Button>
            <Button size="sm" onClick={() => bulkRoleMutation.mutate({ userIds: [...selected], role: bulkRole })} disabled={bulkRoleMutation.isPending} className="font-mono text-xs">
              {bulkRoleMutation.isPending ? 'Updating...' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Individual action dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="sm:max-w-[400px] glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              {actionDialog?.type === 'suspend' && `Suspend ${actionDialog.userName}`}
              {actionDialog?.type === 'ban' && `Ban ${actionDialog.userName}`}
              {actionDialog?.type === 'points' && `Adjust Points — ${actionDialog.userName}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(actionDialog?.type === 'suspend' || actionDialog?.type === 'ban') && (
              <div className="space-y-2">
                <Label className="text-xs font-mono">Reason</Label>
                <Textarea placeholder="Enter reason..." value={reason} onChange={e => setReason(e.target.value)} className="h-20 text-sm" />
              </div>
            )}
            {actionDialog?.type === 'suspend' && (
              <div className="space-y-2">
                <Label className="text-xs font-mono">Suspend Until (optional)</Label>
                <Input type="datetime-local" value={suspendUntil} onChange={e => setSuspendUntil(e.target.value)} className="text-sm" />
              </div>
            )}
            {actionDialog?.type === 'points' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-mono">Amount (+/-)</Label>
                  <Input type="number" placeholder="e.g. 50 or -20" value={pointsAmount} onChange={e => setPointsAmount(e.target.value)} className="text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-mono">Reason (optional)</Label>
                  <Input placeholder="e.g. Manual reward" value={pointsReason} onChange={e => setPointsReason(e.target.value)} className="text-sm" />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setActionDialog(null)} className="font-mono text-xs">Cancel</Button>
            <Button
              size="sm"
              variant={actionDialog?.type === 'ban' ? 'destructive' : 'default'}
              onClick={handleActionSubmit}
              disabled={
                (actionDialog?.type !== 'points' && !reason.trim()) ||
                suspendMutation.isPending || banMutation.isPending || pointsMutation.isPending
              }
              className="font-mono text-xs"
            >
              {actionDialog?.type === 'suspend' && 'Suspend'}
              {actionDialog?.type === 'ban' && 'Ban User'}
              {actionDialog?.type === 'points' && 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
