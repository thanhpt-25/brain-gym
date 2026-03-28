import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, updateUserRole, suspendUser, banUser, reactivateUser, adjustUserPoints } from '@/services/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Users, Search, Loader2, Ban, ShieldOff, ShieldCheck, Coins } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = ['LEARNER', 'CONTRIBUTOR', 'REVIEWER', 'ADMIN'];

const statusBadge: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  ACTIVE: { variant: 'outline', label: 'Active' },
  SUSPENDED: { variant: 'secondary', label: 'Suspended' },
  BANNED: { variant: 'destructive', label: 'Banned' },
};

export default function UsersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [actionDialog, setActionDialog] = useState<{ type: 'suspend' | 'ban' | 'points'; userId: string; userName: string } | null>(null);
  const [reason, setReason] = useState('');
  const [suspendUntil, setSuspendUntil] = useState('');
  const [pointsAmount, setPointsAmount] = useState('');
  const [pointsReason, setPointsReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, page],
    queryFn: () => getUsers(search || undefined, page, 20),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => updateUserRole(userId, role),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Role updated'); },
    onError: () => toast.error('Failed to update role'),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ userId, reason, suspendedUntil }: { userId: string; reason: string; suspendedUntil?: string }) =>
      suspendUser(userId, reason, suspendedUntil),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User suspended');
      setActionDialog(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to suspend'),
  });

  const banMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) => banUser(userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User banned');
      setActionDialog(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to ban'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (userId: string) => reactivateUser(userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User reactivated'); },
    onError: () => toast.error('Failed to reactivate'),
  });

  const pointsMutation = useMutation({
    mutationFn: ({ userId, amount, reason }: { userId: string; amount: number; reason?: string }) =>
      adjustUserPoints(userId, amount, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Points adjusted');
      setActionDialog(null);
    },
    onError: () => toast.error('Failed to adjust points'),
  });

  const openAction = (type: 'suspend' | 'ban' | 'points', userId: string, userName: string) => {
    setActionDialog({ type, userId, userName });
    setReason('');
    setSuspendUntil('');
    setPointsAmount('');
    setPointsReason('');
  };

  const handleActionSubmit = () => {
    if (!actionDialog) return;
    if (actionDialog.type === 'suspend') {
      suspendMutation.mutate({ userId: actionDialog.userId, reason, suspendedUntil: suspendUntil || undefined });
    } else if (actionDialog.type === 'ban') {
      banMutation.mutate({ userId: actionDialog.userId, reason });
    } else if (actionDialog.type === 'points') {
      const amount = parseInt(pointsAmount);
      if (isNaN(amount) || amount === 0) { toast.error('Enter a valid non-zero amount'); return; }
      pointsMutation.mutate({ userId: actionDialog.userId, amount, reason: pointsReason || undefined });
    }
  };

  return (
    <>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-mono flex items-center justify-between">
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> User Management</span>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-8 text-sm" />
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
                    <TableHead className="font-mono">User</TableHead>
                    <TableHead className="font-mono">Email</TableHead>
                    <TableHead className="font-mono text-center">Role</TableHead>
                    <TableHead className="font-mono text-center">Status</TableHead>
                    <TableHead className="font-mono text-center">Points</TableHead>
                    <TableHead className="font-mono text-center">Qs</TableHead>
                    <TableHead className="font-mono text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data.map(u => {
                    const sb = statusBadge[u.status] || statusBadge.ACTIVE;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium text-sm">{u.displayName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell className="text-center">
                          <Select value={u.role} onValueChange={role => roleMutation.mutate({ userId: u.id, role })}>
                            <SelectTrigger className="h-7 w-[130px] text-xs font-mono mx-auto"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ROLES.map(r => <SelectItem key={r} value={r} className="text-xs font-mono">{r}</SelectItem>)}
                            </SelectContent>
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

      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="sm:max-w-[400px] glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              {actionDialog?.type === 'suspend' && `Suspend ${actionDialog.userName}`}
              {actionDialog?.type === 'ban' && `Ban ${actionDialog.userName}`}
              {actionDialog?.type === 'points' && `Adjust Points - ${actionDialog.userName}`}
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
