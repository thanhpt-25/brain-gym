import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Award, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { getAdminBadges, createBadge, updateBadge, deleteBadge, awardBadge, revokeBadge } from '@/services/admin';

export function BadgesTab() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; id?: string; name: string; description: string; iconUrl: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [awardDialog, setAwardDialog] = useState<{ badgeId: string; badgeName: string; userId: string } | null>(null);

  const { data: badges = [], isLoading } = useQuery({ queryKey: ['admin-badges'], queryFn: getAdminBadges });

  const saveMutation = useMutation({
    mutationFn: (d: typeof dialog) => {
      if (!d) return Promise.reject();
      const payload = { name: d.name, description: d.description || undefined, iconUrl: d.iconUrl || undefined };
      return d.mode === 'create' ? createBadge(payload) : updateBadge(d.id!, payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-badges'] }); setDialog(null); toast.success('Badge saved'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to save badge'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBadge(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-badges'] }); setDeleteId(null); toast.success('Badge deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete badge'),
  });

  const awardMutation = useMutation({
    mutationFn: (d: typeof awardDialog) => {
      if (!d) return Promise.reject();
      return awardBadge(d.badgeId, d.userId);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-badges'] }); setAwardDialog(null); toast.success('Badge awarded'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to award badge'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-mono">{badges.length} badges</span>
        <Button size="sm" className="font-mono text-xs" onClick={() => setDialog({ mode: 'create', name: '', description: '', iconUrl: '' })}>
          <Plus className="h-3 w-3 mr-1" /> Add Badge
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-mono text-xs">Badge</TableHead>
              <TableHead className="font-mono text-xs">Description</TableHead>
              <TableHead className="font-mono text-xs">Awards</TableHead>
              <TableHead className="font-mono text-xs">Icon URL</TableHead>
              <TableHead className="font-mono text-xs w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground font-mono text-xs py-8">Loading...</TableCell></TableRow>
            ) : badges.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground font-mono text-xs py-8">No badges found</TableCell></TableRow>
            ) : (badges as any[]).map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {b.iconUrl ? <img src={b.iconUrl} alt={b.name} className="h-6 w-6 rounded" /> : <Award className="h-5 w-5 text-yellow-500" />}
                    <span className="font-mono text-sm font-medium">{b.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{b.description || '—'}</TableCell>
                <TableCell className="text-xs font-mono">{b._count?.awards ?? 0}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono max-w-[120px] truncate">{b.iconUrl || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-yellow-500" title="Award to user" onClick={() => setAwardDialog({ badgeId: b.id, badgeName: b.name, userId: '' })}>
                      <Award className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDialog({ mode: 'edit', id: b.id, name: b.name, description: b.description || '', iconUrl: b.iconUrl || '' })}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(b.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="glass-card border-border">
          <DialogHeader><DialogTitle className="font-mono">{dialog?.mode === 'create' ? 'Add Badge' : 'Edit Badge'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block">Name</label>
              <Input className="font-mono text-sm" value={dialog?.name ?? ''} onChange={e => setDialog(d => d ? { ...d, name: e.target.value } : d)} placeholder="Badge name" />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block">Description (optional)</label>
              <Input className="font-mono text-sm" value={dialog?.description ?? ''} onChange={e => setDialog(d => d ? { ...d, description: e.target.value } : d)} placeholder="Brief description" />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block">Icon URL (optional)</label>
              <Input className="font-mono text-sm" value={dialog?.iconUrl ?? ''} onChange={e => setDialog(d => d ? { ...d, iconUrl: e.target.value } : d)} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} className="font-mono text-xs">Cancel</Button>
            <Button onClick={() => saveMutation.mutate(dialog)} disabled={!dialog?.name || saveMutation.isPending} className="font-mono text-xs">
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Award Dialog */}
      <Dialog open={!!awardDialog} onOpenChange={(o) => !o && setAwardDialog(null)}>
        <DialogContent className="glass-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="font-mono">Award Badge: {awardDialog?.badgeName}</DialogTitle></DialogHeader>
          <div>
            <label className="text-xs font-mono text-muted-foreground mb-1 block">User ID</label>
            <Input className="font-mono text-sm" value={awardDialog?.userId ?? ''} onChange={e => setAwardDialog(d => d ? { ...d, userId: e.target.value } : d)} placeholder="User UUID" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAwardDialog(null)} className="font-mono text-xs">Cancel</Button>
            <Button onClick={() => awardMutation.mutate(awardDialog)} disabled={!awardDialog?.userId || awardMutation.isPending} className="font-mono text-xs">
              {awardMutation.isPending ? 'Awarding...' : 'Award'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="glass-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="font-mono">Delete Badge?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will also revoke the badge from all users who have earned it.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="font-mono text-xs">Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending} className="font-mono text-xs">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
