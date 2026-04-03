import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, ArrowRight, Upload, Globe, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createOrg } from '@/services/organizations';
import type { CreateOrgPayload } from '@/types/org-types';

const CreateOrg = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('');

  const generateSlug = (val: string) => {
    setName(val);
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  };

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: CreateOrgPayload) => createOrg(payload),
    onSuccess: (org) => {
      toast.success('Organization created successfully!');
      navigate(`/org/${org.slug}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create organization');
    },
  });

  const handleCreate = () => {
    mutate({
      name,
      description: description || undefined,
      industry: industry || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar title="Create Organization" />

      <div className="container pt-20 pb-8 max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-mono font-bold border-2 transition-colors ${
                s <= step ? 'bg-primary/20 border-primary text-primary' : 'border-border text-muted-foreground'
              }`}>
                {s}
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 ${s < step ? 'bg-primary' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" /> Organization Details
              </CardTitle>
              <CardDescription className="text-xs">Set up your organization's basic info</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs">Organization Name *</Label>
                <Input
                  placeholder="Acme Corporation"
                  value={name}
                  onChange={e => generateSlug(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs">URL Slug</Label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground font-mono shrink-0">certgym.com/</span>
                  <Input value={slug} onChange={e => setSlug(e.target.value)} className="bg-muted border-border font-mono" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs">Logo (optional)</Label>
                <div className="h-24 rounded-xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/40 transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-mono">Drop logo here or click to upload</span>
                </div>
              </div>
              <Button onClick={() => setStep(2)} className="w-full glow-cyan" disabled={!name.trim()}>
                Continue <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono flex items-center gap-2">
                <Globe className="h-5 w-5 text-accent" /> Details
              </CardTitle>
              <CardDescription className="text-xs">Additional information about your organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs">Industry (optional)</Label>
                <Input
                  placeholder="Technology, Finance, Healthcare..."
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs">Description (optional)</Label>
                <Input
                  placeholder="Brief description of your organization"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                <Button onClick={() => setStep(3)} className="flex-1 glow-cyan">
                  Continue <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono flex items-center gap-2">
                <Users className="h-5 w-5 text-violet-400" /> Review & Create
              </CardTitle>
              <CardDescription className="text-xs">Confirm your organization details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-mono">Name</span>
                  <span className="text-sm font-mono font-medium">{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-mono">Slug</span>
                  <span className="text-sm font-mono">/{slug}</span>
                </div>
                {industry && (
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground font-mono">Industry</span>
                    <span className="text-sm font-mono">{industry}</span>
                  </div>
                )}
                {description && (
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground font-mono">Description</span>
                    <span className="text-sm font-mono truncate max-w-[200px]">{description}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                <Button onClick={handleCreate} className="flex-1 glow-cyan" disabled={isPending}>
                  {isPending ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Creating...</>
                  ) : (
                    <><Building2 className="h-4 w-4 mr-1.5" /> Create Organization</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CreateOrg;
