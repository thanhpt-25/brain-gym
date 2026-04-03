import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Building2, Palette, Shield, CreditCard,
  Save, Upload, AlertTriangle, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrgStore } from '@/stores/org.store';
import { updateOrg, deleteOrg } from '@/services/organizations';

const OrgSettings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const clearOrg = useOrgStore((s) => s.clearOrg);
  const slug = currentOrg?.slug || '';

  const [orgName, setOrgName] = useState('');
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [accentColor, setAccentColor] = useState('');

  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name);
      setDescription(currentOrg.description || '');
      setIndustry(currentOrg.industry || '');
      setAccentColor(currentOrg.accentColor || '#00bcd4');
    }
  }, [currentOrg]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateOrg(slug, {
        name: orgName,
        description: description || undefined,
        industry: industry || undefined,
        accentColor: accentColor || undefined,
      }),
    onSuccess: () => {
      toast.success('Settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['org', slug] });
      queryClient.invalidateQueries({ queryKey: ['my-orgs'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to save settings'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteOrg(slug),
    onSuccess: () => {
      toast.success('Organization deleted');
      clearOrg();
      navigate('/org');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete organization'),
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this organization? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  if (!currentOrg) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-mono font-bold">Organization Settings</h1>
        <p className="text-sm text-muted-foreground font-mono">Manage your organization's profile and preferences</p>
      </div>

      {/* General */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-mono text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> General
          </CardTitle>
          <CardDescription className="text-xs">Basic organization details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-mono text-xs">Organization Name</Label>
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs">Slug</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground font-mono">/{currentOrg.slug}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Slug cannot be changed</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs">Description</Label>
            <Input
              placeholder="Brief description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-muted border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs">Industry</Label>
            <Input
              placeholder="Technology, Finance..."
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="bg-muted border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs">Logo</Label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <Button variant="outline" size="sm"><Upload className="h-3 w-3 mr-1.5" /> Upload</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-mono text-sm flex items-center gap-2">
            <Palette className="h-4 w-4 text-violet-400" /> Branding
          </CardTitle>
          <CardDescription className="text-xs">Customize your organization's appearance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="font-mono text-xs">Accent Color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-14 rounded cursor-pointer border-0 bg-transparent"
              />
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="bg-muted border-border w-32 font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-mono text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Plan Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono">Plan</span>
            <Badge className="bg-primary/20 text-primary border-primary/30">Enterprise</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono">Seats</span>
            <span className="text-sm font-mono">{currentOrg._count.members} / {currentOrg.maxSeats}</span>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground">
            Plan is managed by the platform admin. Contact support to change your plan.
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {currentOrg.myRole === 'OWNER' && (
        <Card className="bg-card border-destructive/30">
          <CardHeader>
            <CardTitle className="font-mono text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/50 text-destructive hover:bg-destructive/10 font-mono text-xs"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
              Delete Organization
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} className="glow-cyan" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default OrgSettings;
