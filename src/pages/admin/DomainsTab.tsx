import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { getAdminDomains, createDomain, updateDomain, deleteDomain } from '@/services/admin';
import { getCertifications } from '@/services/certifications';

export function DomainsTab() {
  const qc = useQueryClient();
  const [certFilter, setCertFilter] = useState('');
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; id?: string; name: string; certificationId: string; description: string; weight: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: certs = [] } = useQuery({ queryKey: ['certifications', true], queryFn: () => getCertifications(true) });
  const { data, isLoading } = useQuery({
    queryKey: ['admin-domains', certFilter],
    queryFn: () => getAdminDomains({ certificationId: certFilter || undefined, limit: 100 }),
  });

  const saveMutation = useMutation({
    mutationFn: (d: typeof dialog) => {
      if (!d) return Promise.reject();
      const payload = { name: d.name, certificationId: d.certificationId, description: d.description || undefined, weight: d.weight ? parseFloat(d.weight) : undefined };
      return d.mode === 'create' ? createDomain(payload) : updateDomain(d.id!, payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-domains'] }); setDialog(null); toast.success('Domain saved'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to save domain'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDomain(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-domains'] }); setDeleteId(null); toast.success('Domain deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete domain'),
  });

  const domains = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={certFilter} onValueChange={setCertFilter}>
            <SelectTrigger className="w-56 font-mono text-xs">
              <SelectValue placeholder="All certifications" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All certifications</SelectItem>
              {certs.map(c => <SelectItem key={c.id} value={c.id}>{c.code} – {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground font-mono">{domains.length} domains</span>
        </div>
        <Button size="sm" className="font-mono text-xs" onClick={() => setDialog({ mode: 'create', name: '', certificationId: certFilter, description: '', weight: '' })}>
          <Plus className="h-3 w-3 mr-1" /> Add Domain
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-mono text-xs"></TableHead>
              <TableHead className="font-mono text-xs">Domain</TableHead>
              <TableHead className="font-mono text-xs">Certification</TableHead>
              <TableHead className="font-mono text-xs">Weight</TableHead>
              <TableHead className="font-mono text-xs">Questions</TableHead>
              <TableHead className="font-mono text-xs">Description</TableHead>
              <TableHead className="font-mono text-xs w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground font-mono text-xs py-8">Loading...</TableCell></TableRow>
            ) : domains.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground font-mono text-xs py-8">No domains found</TableCell></TableRow>
            ) : domains.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell><GripVertical className="h-3 w-3 text-muted-foreground" /></TableCell>
                <TableCell className="font-mono text-sm font-medium">{d.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">{d.certification?.code} – {d.certification?.name}</TableCell>
                <TableCell className="text-xs font-mono">{d.weight != null ? Number(d.weight).toFixed(1) : '—'}</TableCell>
                <TableCell className="text-xs font-mono">{d._count?.questions ?? 0}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{d.description || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDialog({ mode: 'edit', id: d.id, name: d.name, certificationId: d.certificationId, description: d.description || '', weight: d.weight != null ? String(d.weight) : '' })}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(d.id)}>
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
          <DialogHeader><DialogTitle className="font-mono">{dialog?.mode === 'create' ? 'Add Domain' : 'Edit Domain'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block">Certification</label>
              <Select value={dialog?.certificationId ?? ''} onValueChange={v => setDialog(d => d ? { ...d, certificationId: v } : d)}>
                <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Select certification" /></SelectTrigger>
                <SelectContent>{certs.map(c => <SelectItem key={c.id} value={c.id}>{c.code} – {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block">Name</label>
              <Input className="font-mono text-sm" value={dialog?.name ?? ''} onChange={e => setDialog(d => d ? { ...d, name: e.target.value } : d)} placeholder="Domain name" />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block">Description (optional)</label>
              <Input className="font-mono text-sm" value={dialog?.description ?? ''} onChange={e => setDialog(d => d ? { ...d, description: e.target.value } : d)} placeholder="Brief description" />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block">Weight (optional)</label>
              <Input className="font-mono text-sm" type="number" step="0.1" value={dialog?.weight ?? ''} onChange={e => setDialog(d => d ? { ...d, weight: e.target.value } : d)} placeholder="e.g. 20.0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} className="font-mono text-xs">Cancel</Button>
            <Button onClick={() => saveMutation.mutate(dialog)} disabled={!dialog?.name || !dialog?.certificationId || saveMutation.isPending} className="font-mono text-xs">
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="glass-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="font-mono">Delete Domain?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the domain. Domains with assigned questions cannot be deleted.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="font-mono text-xs">Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending} className="font-mono text-xs">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
