import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCertifications, createCertification, updateCertification, deleteCertification,
  CreateCertificationPayload, UpdateCertificationPayload
} from '@/services/certifications';
import { getProviders } from '@/services/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Award, Plus, Edit2, Trash2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function CertificationsTab() {
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<any>(null);
  const [formData, setFormData] = useState<CreateCertificationPayload>({ name: '', providerId: '', code: '', description: '', domains: [] });
  const [domains, setDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [isActive, setIsActive] = useState(true);

  const { data: certifications, isLoading } = useQuery({
    queryKey: ['admin-certifications', includeInactive],
    queryFn: () => getCertifications(includeInactive),
  });

  const { data: providers } = useQuery({
    queryKey: ['admin-providers-active'],
    queryFn: () => getProviders(false),
  });

  const createMut = useMutation({
    mutationFn: createCertification,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-certifications'] }); toast.success('Certification created'); closeDialog(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCertificationPayload }) => updateCertification(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-certifications'] }); toast.success('Certification updated'); closeDialog(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCertification,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-certifications'] }); toast.success('Certification archived'); },
    onError: () => toast.error('Failed to archive'),
  });

  const openDialog = (cert?: any) => {
    if (cert) {
      setEditingCert(cert);
      setFormData({ name: cert.name, providerId: cert.providerId || cert.provider?.id || '', code: cert.code, description: cert.description || '', domains: cert.domains?.map((d: any) => d.name) || [] });
      setDomains(cert.domains?.map((d: any) => d.name) || []);
      setIsActive(cert.isActive);
    } else {
      setEditingCert(null);
      setFormData({ name: '', providerId: '', code: '', description: '', domains: [] });
      setDomains([]); setDomainInput(''); setIsActive(true);
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => { setIsDialogOpen(false); setEditingCert(null); };

  const addDomain = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !domains.includes(trimmed)) setDomains([...domains, trimmed]);
    setDomainInput('');
  };

  const handleDomainKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addDomain(domainInput); }
    else if (e.key === 'Backspace' && domainInput === '' && domains.length > 0) setDomains(domains.slice(0, -1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalDomains = domainInput.trim() ? [...domains, domainInput.trim()].filter((v, i, a) => a.indexOf(v) === i) : domains;
    const payload = { ...formData, domains: finalDomains };
    if (editingCert) {
      updateMut.mutate({ id: editingCert.id, data: { ...payload, isActive } });
    } else {
      createMut.mutate(payload);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-mono flex items-center justify-between">
            <span className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Certification Management</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 mr-4">
                <span className="text-xs text-muted-foreground font-mono">Show Archived</span>
                <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} />
              </div>
              <Button size="sm" onClick={() => openDialog()} className="h-8 font-mono text-xs"><Plus className="h-3 w-3 mr-1" /> Add New</Button>
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
                  <TableHead className="font-mono">Code</TableHead>
                  <TableHead className="font-mono">Name</TableHead>
                  <TableHead className="font-mono">Provider</TableHead>
                  <TableHead className="font-mono text-center">Domains</TableHead>
                  <TableHead className="font-mono text-center">Qs</TableHead>
                  <TableHead className="font-mono text-center">Status</TableHead>
                  <TableHead className="font-mono text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certifications?.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs font-bold">{c.code}</TableCell>
                    <TableCell className="text-sm font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.provider?.name || c.provider || '-'}</TableCell>
                    <TableCell className="text-center font-mono text-xs">{c.domains?.length || 0}</TableCell>
                    <TableCell className="text-center font-mono text-xs">{c.questionCount || 0}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={c.isActive ? 'outline' : 'secondary'} className={c.isActive ? 'bg-accent/10 text-accent border-accent/20' : 'opacity-50'}>
                        {c.isActive ? 'Active' : 'Archived'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(c)}><Edit2 className="h-3 w-3" /></Button>
                        {c.isActive && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Archive this certification?')) deleteMut.mutate(c.id); }}>
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
        <DialogContent className="sm:max-w-[500px] glass-card border-border/50">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="font-mono flex items-center gap-2">
                {editingCert ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingCert ? 'Edit Certification' : 'Add New Certification'}
              </DialogTitle>
              <DialogDescription className="text-xs">{editingCert ? 'Update details for ' + editingCert.code : 'Setup a new exam certification track.'}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-mono">Exam Code</Label>
                  <Input placeholder="e.g. SAA-C03" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} required className="h-9 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-mono">Provider</Label>
                  <Select value={formData.providerId} onValueChange={v => setFormData({ ...formData, providerId: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select provider" /></SelectTrigger>
                    <SelectContent>
                      {providers?.map(p => <SelectItem key={p.id} value={p.id} className="text-sm">{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-mono">Full Name</Label>
                <Input placeholder="Solutions Architect Associate" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="h-9 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-mono">Description (Optional)</Label>
                <Textarea placeholder="Brief overview..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="h-20 text-sm resize-none" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-mono">Domains</Label>
                <div className="flex flex-wrap gap-1.5 p-2 min-h-[38px] rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                  {domains.map((domain, idx) => (
                    <Badge key={idx} variant="secondary" className="h-6 gap-1 pl-2 pr-1 text-xs font-normal">
                      {domain}
                      <button type="button" onClick={() => setDomains(domains.filter((_, i) => i !== idx))} className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input placeholder={domains.length === 0 ? 'Type a domain and press Enter...' : 'Add more...'} value={domainInput} onChange={e => setDomainInput(e.target.value)} onKeyDown={handleDomainKeyDown} onBlur={() => { if (domainInput.trim()) addDomain(domainInput); }} className="h-6 flex-1 min-w-[120px] border-0 p-0 text-sm shadow-none focus-visible:ring-0" />
                </div>
                <p className="text-[10px] text-muted-foreground">Press Enter or comma to add. Backspace removes last.</p>
              </div>
              {editingCert && (
                <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50 border border-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-mono">Active Status</Label>
                    <p className="text-[10px] text-muted-foreground">Inactivate to hide from study modes.</p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeDialog} className="h-9 font-mono text-xs">Cancel</Button>
              <Button type="submit" className="h-9 font-mono text-xs" disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                {editingCert ? 'Save Changes' : 'Create Certification'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
