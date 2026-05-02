import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Building2, Plus, ChevronRight, Crown, Mail } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getMyOrgs } from '@/services/organizations';
import { useOrgStore } from '@/stores/org.store';
import { useAuthStore } from '@/stores/auth.store';

const roleColors: Record<string, string> = {
  OWNER: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ADMIN: 'bg-red-500/20 text-red-400 border-red-500/30',
  MANAGER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  MEMBER: 'bg-muted text-muted-foreground border-border',
};

const OrgSelector = () => {
  const navigate = useNavigate();
  const setMyOrgs = useOrgStore((s) => s.setMyOrgs);
  const user = useAuthStore((s) => s.user);

  const plan = user?.plan ?? 'FREE';
  const isAdmin = user?.role === 'ADMIN';

  const { data: orgs, isLoading } = useQuery({
    queryKey: ['my-orgs'],
    queryFn: getMyOrgs,
  });

  useEffect(() => {
    if (orgs) {
      setMyOrgs(orgs);
      if (orgs.length === 1) {
        navigate(`/org/${orgs[0].slug}`, { replace: true });
      }
    }
  }, [orgs, navigate, setMyOrgs]);

  // Count orgs where user is OWNER
  const ownedOrgs = orgs?.filter((o) => o.myRole === 'OWNER').length ?? 0;

  // Determine if user can create a new org
  const canCreate =
    isAdmin ||
    (plan === 'PREMIUM' && ownedOrgs < 1) ||
    (plan === 'ENTERPRISE' && ownedOrgs < 3);

  // Limit message when plan cap reached
  const limitMessage =
    plan === 'FREE'
      ? null
      : plan === 'PREMIUM' && ownedOrgs >= 1
        ? 'Premium plan allows 1 organization. Upgrade to Enterprise for more.'
        : plan === 'ENTERPRISE' && ownedOrgs >= 3
          ? 'You have reached the maximum organizations for your plan (3).'
          : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="Organization" />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!orgs || orgs.length === 0) {
    // Empty state — depends on plan
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="Organization" />
        <div className="container pt-20 pb-8 max-w-md flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <div className="h-16 w-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-mono font-bold">No Organizations</h2>
            {plan === 'FREE' ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground font-mono">
                  You don&apos;t have any organizations yet.
                </p>
                <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground font-mono bg-muted/30 rounded-lg p-3 border border-border">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span>Ask your team admin to send you an invite to join.</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground font-mono">
                Create your first organization to manage your team
              </p>
            )}
          </div>
          {canCreate && (
            <Button className="glow-cyan" onClick={() => navigate('/org/create')}>
              <Plus className="h-4 w-4 mr-1.5" /> Create Organization
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Multiple orgs — show picker (single org case redirects above)
  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar title="Organizations" />
      <div className="container pt-20 pb-8 max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-mono font-bold">Your Organizations</h1>
          {canCreate && (
            <Button size="sm" className="glow-cyan" onClick={() => navigate('/org/create')}>
              <Plus className="h-4 w-4 mr-1.5" /> New
            </Button>
          )}
        </div>

        {/* Plan limit message */}
        {limitMessage && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/30 rounded-lg p-3 border border-border">
            <Crown className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{limitMessage}</span>
          </div>
        )}

        <div className="space-y-3">
          {orgs.map((org) => (
            <Card
              key={org.id}
              className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => navigate(`/org/${org.slug}`)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-medium truncate">{org.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      /{org.slug} · {org._count.members} members
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={`text-[10px] ${roleColors[org.myRole]}`}>
                    {org.myRole}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OrgSelector;
