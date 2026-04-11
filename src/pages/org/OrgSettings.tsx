import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Building2, Palette, CreditCard,
  Save, Upload, AlertTriangle, Loader2, X, FileText,
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
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const logoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name);
      setDescription(currentOrg.description || '');
      setIndustry(currentOrg.industry || '');
      setAccentColor(currentOrg.accentColor || '#00bcd4');
      setLogoUrl(currentOrg.logoUrl || '');
      setLogoPreview(currentOrg.logoUrl || '');
    }
  }, [currentOrg]);

  const handleLogoFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setLogoPreview(dataUrl);
      setLogoUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      updateOrg(slug, {
        name: orgName,
        description: description || undefined,
        industry: industry || undefined,
        accentColor: accentColor || undefined,
        logoUrl: logoUrl || undefined,
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
            <div className="flex items-start gap-4">
              {/* Preview or drop zone */}
              <div
                className={`h-20 w-20 rounded-xl border-2 flex items-center justify-center cursor-pointer shrink-0 overflow-hidden transition-colors ${
                  logoPreview ? 'border-primary/30' : 'border-dashed border-border hover:border-primary/40'
                }`}
                onClick={() => logoFileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleLogoFile(file);
                }}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoFileRef.current?.click()}
                  >
                    <Upload className="h-3 w-3 mr-1.5" /> Upload Image
                  </Button>
                  {logoPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => { setLogoPreview(''); setLogoUrl(''); }}
                    >
                      <X className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  PNG, JPG, WEBP · Max 2MB · Drag &amp; drop or click
                </p>
                {/* URL input as alternative */}
                <Input
                  placeholder="Or paste an image URL..."
                  value={logoUrl.startsWith('data:') ? '' : logoUrl}
                  onChange={(e) => { setLogoUrl(e.target.value); setLogoPreview(e.target.value); }}
                  className="bg-muted border-border text-xs h-7"
                />
              </div>
              <input
                ref={logoFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); }}
              />
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

      {/* Audit Log */}
      {(currentOrg.myRole === 'OWNER' || currentOrg.myRole === 'ADMIN') && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" /> Audit Log
            </CardTitle>
            <CardDescription className="text-xs">View a history of actions taken in your organization</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-xs"
              onClick={() => navigate(`/org/${slug}/settings/audit`)}
            >
              <FileText className="h-3 w-3 mr-1.5" /> View Audit Log
            </Button>
          </CardContent>
        </Card>
      )}

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
