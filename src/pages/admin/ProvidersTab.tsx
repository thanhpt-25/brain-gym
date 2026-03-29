import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProviders, createProvider, updateProvider, deleteProvider, Provider } from '@/services/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Building2, Plus, Edit2, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeUrl } from '@/lib/question-utils';

export default function ProvidersTab() {
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [formData, setFormData] = useState({ name: '', slug: '', logoUrl: '', website: '', description: '', sortOrder: 0 });
  const [isActive, setIsActive] = useState(true);

  const { data: providers, isLoading } = useQuery({
    queryKey: ['admin-providers', includeInactive],
    queryFn: () => getProviders(includeInactive),
  });

  const createMut = useMutation({
    mutationFn: createProvider,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-providers'] }); toast.success('Provider created'); closeDialog(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateProvider(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-providers'] }); toast.success('Provider updated'); closeDialog(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteProvider,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-providers'] }); toast.success('Provider deactivated'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to deactivate'),
  });

  const openDialog = (provider?: Provider) => {
    if (provider) {
      setEditing(provider);
      setFormData({
        name: provider.name, slug: provider.slug, logoUrl: provider.logoUrl || '',
        website: provider.website || '', description: provider.description || '', sortOrder: provider.sortOrder,
      });
      setIsActive(provider.isActive);
    } else {
      setEditing(null);
      setFormData({ name: '', slug: '', logoUrl: '', website: '', description: '', sortOrder: 0 });
      setIsActive(true);
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => { setIsDialogOpen(false); setEditing(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, logoUrl: formData.logoUrl || undefined, website: formData.website || undefined, description: formData.description || undefined };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: { ...payload, isActive } });
    } else {
      createMut.mutate(payload);
    }
  };

  const autoSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-mono flex items-center justify-between">
            <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Provider Management</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">Show Inactive</span>
                <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} />
              </div>
              <Button size="sm" onClick={() => openDialog()} className="h-8 font-mono text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add Provider
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono">Name</TableHead>
                  <TableHead className="font-mono">Slug</TableHead>
                  <TableHead className="font-mono">Website</TableHead>
                  <TableHead className="font-mono text-center">Certs</TableHead>
                  <TableHead className="font-mono text-center">Order</TableHead>
                  <TableHead className="font-mono text-center">Status</TableHead>
                  <TableHead className="font-mono text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers?.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{p.slug}</TableCell>
                    <TableCell className="text-sm">
                      {p.website && sanitizeUrl(p.website) && (
                        <a href={sanitizeUrl(p.website)!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                          {new URL(p.website).hostname} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">{p._count?.certifications || 0}</TableCell>
                    <TableCell className="text-center font-mono text-xs">{p.sortOrder}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.isActive ? 'outline' : 'secondary'} className={p.isActive ? 'bg-accent/10 text-accent border-accent/20' : 'opacity-50'}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(p)}><Edit2 className="h-3 w-3" /></Button>
                        {p.isActive && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Deactivate this provider?')) deleteMut.mutate(p.id); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[450px] glass-card border-border/50">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="font-mono text-sm">{editing ? 'Edit Provider' : 'Add New Provider'}</DialogTitle>
              <DialogDescription className="text-xs">{editing ? `Updating ${editing.name}` : 'Register a new certification provider.'}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-mono">Name</Label>
                  <Input value={formData.name} onChange={e => { setFormData({ ...formData, name: e.target.value, slug: editing ? formData.slug : autoSlug(e.target.value) }); }} required className="h-9 text-sm" placeholder="e.g. AWS" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-mono">Slug</Label>
                  <Input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} required className="h-9 text-sm" placeholder="e.g. aws" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-mono">Website (optional)</Label>
                <Input value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} className="h-9 text-sm" placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-mono">Logo URL (optional)</Label>
                <Input value={formData.logoUrl} onChange={e => setFormData({ ...formData, logoUrl: e.target.value })} className="h-9 text-sm" placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-mono">Description (optional)</Label>
                <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="h-16 text-sm resize-none" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-mono">Sort Order</Label>
                <Input type="number" value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })} className="h-9 text-sm w-24" />
              </div>
              {editing && (
                <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50 border border-border/50">
                  <Label className="text-xs font-mono">Active</Label>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeDialog} className="h-9 font-mono text-xs">Cancel</Button>
              <Button type="submit" className="h-9 font-mono text-xs" disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
