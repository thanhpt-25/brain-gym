import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Building2, Users, UserPlus, Settings, BarChart3, Target,
  Crown, Shield, ChevronRight, TrendingUp, Award, Clock
} from 'lucide-react';
import { mockOrg, mockMembers, mockGroups, roleColors } from '@/data/mockOrgData';

const OrgDashboard = () => {
  const navigate = useNavigate();
  const seatUsage = (mockOrg.usedSeats / mockOrg.seats) * 100;
  const activeMembers = mockMembers.filter(m => m.status === 'ACTIVE');
  const avgTeamScore = activeMembers.length
    ? Math.round(activeMembers.reduce((s, m) => s + m.avgScore, 0) / activeMembers.length)
    : 0;
  const totalExams = activeMembers.reduce((s, m) => s + m.examsCompleted, 0);

  const stats = [
    { label: 'Active Members', value: activeMembers.length, icon: Users, color: 'text-primary' },
    { label: 'Avg. Score', value: `${avgTeamScore}%`, icon: TrendingUp, color: 'text-accent' },
    { label: 'Total Exams', value: totalExams, icon: Target, color: 'text-amber-400' },
    { label: 'Certifications', value: 6, icon: Award, color: 'text-violet-400' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar title="Organization" />

      <div className="container pt-20 pb-8 space-y-6">
        {/* Org Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-mono font-bold">{mockOrg.name}</h1>
              <p className="text-sm text-muted-foreground font-mono">/{mockOrg.slug} · Enterprise Plan</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/org/members')}>
              <Users className="h-4 w-4 mr-1.5" /> Members
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/org/settings')}>
              <Settings className="h-4 w-4 mr-1.5" /> Settings
            </Button>
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
                <span className="text-3xl font-mono font-bold">{mockOrg.usedSeats}</span>
                <span className="text-sm text-muted-foreground font-mono">of {mockOrg.seats} seats</span>
              </div>
              <Progress value={seatUsage} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {mockOrg.seats - mockOrg.usedSeats} seats available
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
                { label: 'Invite Members', icon: UserPlus, href: '/org/members?tab=invites' },
                { label: 'Manage Groups', icon: Users, href: '/org/members?tab=groups' },
                { label: 'View Analytics', icon: BarChart3, href: '/org/analytics' },
                { label: 'Organization Settings', icon: Settings, href: '/org/settings' },
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

        {/* Top Performers */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" /> Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeMembers
                .sort((a, b) => b.avgScore - a.avgScore)
                .slice(0, 5)
                .map((member, i) => (
                  <div key={member.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                        i === 0 ? 'bg-amber-500/20 text-amber-400' :
                        i === 1 ? 'bg-slate-400/20 text-slate-300' :
                        i === 2 ? 'bg-orange-700/20 text-orange-400' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-mono font-medium">{member.displayName}</p>
                        <p className="text-xs text-muted-foreground">{member.group || 'No group'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-bold text-accent">{member.avgScore}%</p>
                      <p className="text-xs text-muted-foreground">{member.examsCompleted} exams</p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Groups Overview */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400" /> Groups
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs font-mono" onClick={() => navigate('/org/members?tab=groups')}>
              View All <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-3">
              {mockGroups.map(group => (
                <div key={group.id} className="p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                    <span className="text-sm font-mono font-medium">{group.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{group.memberCount} members</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrgDashboard;
