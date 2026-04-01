import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Building2, Palette, Globe, Shield, Bell, CreditCard,
  Save, Plus, X, Upload, Link2, AlertTriangle
} from 'lucide-react';
import { mockOrg } from '@/data/mockOrgData';
import { toast } from 'sonner';

const OrgSettings = () => {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState(mockOrg.name);
  const [slug, setSlug] = useState(mockOrg.slug);
  const [primaryColor, setPrimaryColor] = useState(mockOrg.primaryColor);
  const [domains, setDomains] = useState(mockOrg.domainAllowlist);
  const [newDomain, setNewDomain] = useState('');
  const [autoJoin, setAutoJoin] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);

  const addDomain = () => {
    if (!newDomain.trim()) return;
    setDomains([...domains, newDomain.trim()]);
    setNewDomain('');
  };

  const removeDomain = (d: string) => setDomains(domains.filter(x => x !== d));

  const handleSave = () => toast.success('Settings saved successfully');

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar title="Org Settings" />

      <div className="container pt-20 pb-8 max-w-3xl space-y-6">
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
                <Input value={orgName} onChange={e => setOrgName(e.target.value)} className="bg-muted border-border" />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs">Slug</Label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground font-mono">certgym.com/</span>
                  <Input value={slug} onChange={e => setSlug(e.target.value)} className="bg-muted border-border" />
                </div>
              </div>
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
            <CardDescription className="text-xs">Customize your organization's appearance (White-Label)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-mono text-xs">Primary Brand Color</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-14 rounded cursor-pointer border-0 bg-transparent" />
                <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="bg-muted border-border w-32 font-mono" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs">Custom Subdomain</Label>
              <div className="flex items-center gap-1">
                <Input value={slug} onChange={e => setSlug(e.target.value)} className="bg-muted border-border w-48 font-mono" />
                <span className="text-xs text-muted-foreground font-mono">.certgym.com</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Domain Allowlist */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <Globe className="h-4 w-4 text-accent" /> Domain Allowlist
            </CardTitle>
            <CardDescription className="text-xs">Users with matching email domains can auto-join</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="font-mono text-xs">Auto-join enabled</Label>
              <Switch checked={autoJoin} onCheckedChange={setAutoJoin} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {domains.map(d => (
                <Badge key={d} variant="outline" className="font-mono text-xs gap-1">
                  {d}
                  <button onClick={() => removeDomain(d)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="company.com"
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
                className="bg-muted border-border"
                onKeyDown={e => e.key === 'Enter' && addDomain()}
              />
              <Button variant="outline" size="sm" onClick={addDomain}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-400" /> Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-mono text-xs">Require admin approval for new members</Label>
                <p className="text-[10px] text-muted-foreground">New join requests must be approved by an admin</p>
              </div>
              <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-mono text-xs">Email notifications</Label>
                <p className="text-[10px] text-muted-foreground">Notify admins about new members and activity</p>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
          </CardContent>
        </Card>

        {/* Billing */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Billing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono">Plan</span>
              <Badge className="bg-primary/20 text-primary border-primary/30">Enterprise</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono">Seats</span>
              <span className="text-sm font-mono">{mockOrg.usedSeats} / {mockOrg.seats}</span>
            </div>
            <Separator />
            <Button variant="outline" size="sm" className="w-full font-mono text-xs">
              <CreditCard className="h-3 w-3 mr-1.5" /> Manage Billing
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="bg-card border-destructive/30">
          <CardHeader>
            <CardTitle className="font-mono text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10 font-mono text-xs">
              Delete Organization
            </Button>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} className="glow-cyan">
            <Save className="h-4 w-4 mr-1.5" /> Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrgSettings;
