import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Building2, Users, UserPlus, Settings, BarChart3, Target,
  Crown, Shield, ChevronRight, TrendingUp, Award, Clock,
} from 'lucide-react';
import { useOrgStore } from '@/stores/org.store';
import { getMembers, getGroups } from '@/services/organizations';
import type { OrgRole } from '@/types/org-types';

const roleColors: Record<OrgRole, string> = {
  OWNER: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ADMIN: 'bg-red-500/20 text-red-400 border-red-500/30',
  MANAGER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  MEMBER: 'bg-muted text-muted-foreground border-border',
};

const OrgDashboard = () => {
  const navigate = useNavigate();
  const currentOrg = useOrgStore((s) => s.currentOrg);

  const slug = currentOrg?.slug || '';

  const { data: membersData } = useQuery({
    queryKey: ['org-members', slug],
    queryFn: () => getMembers(slug),
    enabled: !!slug,
  });

  const { data: groups } = useQuery({
    queryKey: ['org-groups', slug],
    queryFn: () => getGroups(slug),
    enabled: !!slug,
  });

  if (!currentOrg) return null;

  const memberCount = currentOrg._count.members;
  const seatUsage = currentOrg.maxSeats > 0 ? (memberCount / currentOrg.maxSeats) * 100 : 0;
  const members = membersData?.data || [];
  const activeMembers = members.filter((m) => m.isActive);

  const stats = [
    { label: 'Active Members', value: memberCount, icon: Users, color: 'text-primary' },
    { label: 'Groups', value: groups?.length ?? 0, icon: Shield, color: 'text-blue-400' },
    { label: 'Max Seats', value: currentOrg.maxSeats, icon: Target, color: 'text-amber-400' },
    { label: 'My Role', value: currentOrg.myRole, icon: Award, color: 'text-violet-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Org Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-mono font-bold">{currentOrg.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">/{currentOrg.slug}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/org/${slug}/members`)}>
            <Users className="h-4 w-4 mr-1.5" /> Members
          </Button>
          {(currentOrg.myRole === 'OWNER' || currentOrg.myRole === 'ADMIN') && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/org/${slug}/settings`)}>
              <Settings className="h-4 w-4 mr-1.5" /> Settings
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(stat => (
          <Card key={stat.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-mono font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground font-mono">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Seat Usage + Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Seat Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between">
              <span className="text-3xl font-mono font-bold">{memberCount}</span>
              <span className="text-sm text-muted-foreground font-mono">of {currentOrg.maxSeats} seats</span>
            </div>
            <Progress value={seatUsage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {currentOrg.maxSeats - memberCount} seats available
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" /> Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Invite Members', icon: UserPlus, href: `/org/${slug}/members` },
              { label: 'Manage Groups', icon: Users, href: `/org/${slug}/groups` },
              { label: 'Organization Settings', icon: Settings, href: `/org/${slug}/settings` },
            ].map(action => (
              <button
                key={action.label}
                onClick={() => navigate(action.href)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted transition-colors group"
              >
                <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground group-hover:text-foreground">
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Members */}
      {activeMembers.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" /> Team Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeMembers.slice(0, 5).map((member) => (
                <div key={member.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center">
                      <span className="text-xs font-mono font-bold">
                        {member.user.displayName.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-mono font-medium">{member.user.displayName}</p>
                      <p className="text-xs text-muted-foreground">{member.group?.name || 'No group'}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${roleColors[member.role]}`}>
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Groups Overview */}
      {groups && groups.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400" /> Groups
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs font-mono" onClick={() => navigate(`/org/${slug}/groups`)}>
              View All <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-3">
              {groups.map(group => (
                <div key={group.id} className="p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono font-medium">{group.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{group._count.members} members</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OrgDashboard;
