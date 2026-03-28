import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Merge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { getAdminTags, createTag, updateTag, deleteTag, mergeTags } from '@/services/admin';
import { getCertifications } from '@/services/certifications';

export function TagsTab() {
  const qc = useQueryClient();
  const [certFilter, setCertFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; id?: string; name: string; certificationId: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeTarget, setMergeTarget] = useState('');
  const [mergeDialog, setMergeDialog] = useState(false);

  const { data: certs = [] } = useQuery({ queryKey: ['certifications', true], queryFn: () => getCertifications(true) });
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['admin-tags', certFilter],
    queryFn: () => getAdminTags(certFilter === 'all' ? undefined : certFilter),
  });

  const filtered = tags.filter((t: any) => t.name.toLowerCase().includes(search.toLowerCase()));

  const saveMutation = useMutation({
    mutationFn: (d: typeof dialog) => {
      if (!d) return Promise.reject();
      return d.mode === 'create'
        ? createTag({ name: d.name, certificationId: d.certificationId || undefined })
        : updateTag(d.id!, { name: d.name });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tags'] }); setDialog(null); toast.success('Tag saved'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to save tag'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tags'] }); setDeleteId(null); toast.success('Tag deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete tag'),
  });

  const mergeMutation = useMutation({
    mutationFn: () => mergeTags({ sourceIds: [...selected].filter(id => id !== mergeTarget), targetId: mergeTarget }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tags'] }); setMergeDialog(false); setSelected(new Set()); setMergeTarget(''); toast.success('Tags merged'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to merge tags'),
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Input className="font-mono text-xs max-w-xs" placeholder="Search tags..." value={search} onChange={e => setSearch(e.target.value)} />
          <Select value={certFilter} onValueChange={setCertFilter}>
            <SelectTrigger className="w-56 font-mono text-xs">
              <SelectValue placeholder="All certifications" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All certifications</SelectItem>
              {certs.map(c => <SelectItem key={c.id} value={c.id}>{c.code} – {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground font-mono">{filtered.length} tags</span>
        </div>
        <div className="flex gap-2">
          {selected.size >= 2 && (
            <Button size="sm" variant="outline" className="font-mono text-xs" onClick={() => setMergeDialog(true)}>
              <Merge className="h-3 w-3 mr-1" /> Merge ({selected.size})
            </Button>
          )}
          <Button size="sm" className="font-mono text-xs" onClick={() => setDialog({ mode: 'create', name: '', certificationId: certFilter === 'all' ? '' : certFilter })}>
            <Plus className="h-3 w-3 mr-1" /> Add Tag
          </Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-mono text-xs w-10"></TableHead>
              <TableHead className="font-mono text-xs">Tag</TableHead>
              <TableHead className="font-mono text-xs">Certification</TableHead>
              <TableHead className="font-mono text-xs">Questions</TableHead>
              <TableHead className="font-mono text-xs w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground font-mono text-xs py-8">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground font-mono text-xs py-8">No tags found</TableCell></TableRow>
            ) : filtered.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell><Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} /></TableCell>
                <TableCell className="font-mono text-sm font-medium">{t.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">
                  {t.certificationId ? (certs.find((c: any) => c.id === t.certificationId)?.code ?? t.certificationId) : <span className="text-muted-foreground/50">Global</span>}
                </TableCell>
                <TableCell className="text-xs font-mono">{t._count?.questions ?? 0}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDialog({ mode: 'edit', id: t.id, name: t.name, certificationId: t.certificationId || '' })}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(t.id)}>
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
          <DialogHeader><DialogTitle className="font-mono">{dialog?.mode === 'create' ? 'Add Tag' : 'Edit Tag'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block">Name</label>
              <Input className="font-mono text-sm" value={dialog?.name ?? ''} onChange={e => setDialog(d => d ? { ...d, name: e.target.value } : d)} placeholder="Tag name" />
            </div>
            {dialog?.mode === 'create' && (
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1 block">Certification (optional)</label>
                <Select value={dialog?.certificationId || 'global'} onValueChange={v => setDialog(d => d ? { ...d, certificationId: v === 'global' ? '' : v } : d)}>
                  <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Global tag" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    {certs.map(c => <SelectItem key={c.id} value={c.id}>{c.code} – {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} className="font-mono text-xs">Cancel</Button>
            <Button onClick={() => saveMutation.mutate(dialog)} disabled={!dialog?.name || saveMutation.isPending} className="font-mono text-xs">
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={mergeDialog} onOpenChange={(o) => !o && setMergeDialog(false)}>
        <DialogContent className="glass-card border-border">
          <DialogHeader><DialogTitle className="font-mono">Merge Tags</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Select the target tag — all selected tags will be merged into it and the others deleted.</p>
          <div className="space-y-2">
            {[...selected].map(id => {
              const tag = tags.find((t: any) => t.id === id);
              return (
                <div key={id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${mergeTarget === id ? 'border-primary bg-primary/10' : 'border-border'}`} onClick={() => setMergeTarget(id)}>
                  <div className={`w-3 h-3 rounded-full border-2 ${mergeTarget === id ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                  <span className="font-mono text-sm">{tag?.name}</span>
                  {mergeTarget === id && <span className="text-xs text-primary ml-auto font-mono">target</span>}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMergeDialog(false)} className="font-mono text-xs">Cancel</Button>
            <Button onClick={() => mergeMutation.mutate()} disabled={!mergeTarget || mergeMutation.isPending} className="font-mono text-xs">
              {mergeMutation.isPending ? 'Merging...' : 'Merge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="glass-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="font-mono">Delete Tag?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tags used by questions cannot be deleted. Use merge instead.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="font-mono text-xs">Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending} className="font-mono text-xs">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
