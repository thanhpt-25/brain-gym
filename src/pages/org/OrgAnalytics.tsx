import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  BarChart3, Users, TrendingUp, Target, Award, Activity, Search,
} from 'lucide-react';
import { useOrgStore } from '@/stores/org.store';
import { getMembers } from '@/services/organizations';
import {
  getOrgOverview,
  getOrgReadiness,
  getOrgSkillGaps,
  getOrgProgress,
  getOrgEngagement,
  getMemberAnalytics,
} from '@/services/org-analytics';
import ReadinessHeatmap from '@/components/org/ReadinessHeatmap';
import SkillGapChart from '@/components/org/SkillGapChart';
import EngagementChart from '@/components/org/EngagementChart';
import MemberAnalyticsCard from '@/components/org/MemberAnalyticsCard';
import AssessmentFunnel from '@/components/org/AssessmentFunnel';

const OrgAnalytics = () => {
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || '';
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['org-analytics-overview', slug],
    queryFn: () => getOrgOverview(slug),
    enabled: !!slug,
  });

  const { data: readiness } = useQuery({
    queryKey: ['org-analytics-readiness', slug],
    queryFn: () => getOrgReadiness(slug),
    enabled: !!slug,
  });

  const { data: skillGaps } = useQuery({
    queryKey: ['org-analytics-skill-gaps', slug],
    queryFn: () => getOrgSkillGaps(slug),
    enabled: !!slug,
  });

  const { data: progress } = useQuery({
    queryKey: ['org-analytics-progress', slug],
    queryFn: () => getOrgProgress(slug),
    enabled: !!slug,
  });

  const { data: engagement } = useQuery({
    queryKey: ['org-analytics-engagement', slug],
    queryFn: () => getOrgEngagement(slug),
    enabled: !!slug,
  });

  const { data: membersData } = useQuery({
    queryKey: ['org-members', slug, 1, 100],
    queryFn: () => getMembers(slug, 1, 100),
    enabled: !!slug,
  });

  const { data: memberAnalytics } = useQuery({
    queryKey: ['org-analytics-member', slug, selectedMemberId],
    queryFn: () => getMemberAnalytics(slug, selectedMemberId!),
    enabled: !!slug && !!selectedMemberId,
  });

  if (!currentOrg) return null;

  const members = membersData?.data || [];
  const filteredMembers = members.filter(
    (m) =>
      m.user.displayName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.user.email.toLowerCase().includes(memberSearch.toLowerCase()),
  );

  const overviewStats = overview
    ? [
        { label: 'Members', value: overview.memberCount, icon: Users, color: 'text-primary' },
        { label: 'Active (7d)', value: overview.activeUsersLast7d, icon: Activity, color: 'text-emerald-400' },
        { label: 'Exams Taken', value: overview.totalExamsTaken, icon: BarChart3, color: 'text-amber-400' },
        { label: 'Avg Score', value: `${overview.avgScore}%`, icon: TrendingUp, color: 'text-blue-400' },
        { label: 'Pass Rate', value: `${overview.passRate}%`, icon: Award, color: 'text-violet-400' },
        { label: 'Candidates', value: overview.totalCandidatesInvited, icon: Target, color: 'text-red-400' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-mono font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Analytics
        </h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          Team performance and engagement insights
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview" className="font-mono text-xs">Overview</TabsTrigger>
          <TabsTrigger value="readiness" className="font-mono text-xs">Readiness</TabsTrigger>
          <TabsTrigger value="skills" className="font-mono text-xs">Skill Gaps</TabsTrigger>
          <TabsTrigger value="members" className="font-mono text-xs">Members</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {loadingOverview ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="bg-card border-border animate-pulse">
                  <CardContent className="p-4 h-20" />
                </Card>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {overviewStats.map((stat) => (
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

              {/* Assessment Funnel */}
              {engagement && engagement.assessmentFunnel.invited > 0 && (
                <div>
                  <p className="font-mono text-sm font-medium mb-2">Assessment Pipeline</p>
                  <AssessmentFunnel
                    funnel={{
                      total: engagement.assessmentFunnel.invited,
                      started: engagement.assessmentFunnel.started,
                      submitted: engagement.assessmentFunnel.submitted,
                      passed: null,
                    }}
                  />
                </div>
              )}

              {/* Weekly Progress Charts */}
              <EngagementChart data={progress || []} />
            </>
          )}
        </TabsContent>

        {/* Readiness Tab */}
        <TabsContent value="readiness">
          <ReadinessHeatmap data={readiness || []} />
        </TabsContent>

        {/* Skill Gaps Tab */}
        <TabsContent value="skills">
          <SkillGapChart data={skillGaps || []} />
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9 font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-[300px_1fr] gap-4">
            {/* Member List */}
            <Card className="bg-card border-border">
              <CardContent className="p-2">
                <div className="space-y-1 max-h-[600px] overflow-y-auto">
                  {filteredMembers.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMemberId(m.user.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedMemberId === m.user.id
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-mono font-bold">
                          {m.user.displayName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-mono truncate">{m.user.displayName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                          {m.group?.name || m.role}
                        </p>
                      </div>
                    </button>
                  ))}
                  {filteredMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8 font-mono">
                      No members found
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Member Detail */}
            <div>
              {selectedMemberId && memberAnalytics ? (
                <MemberAnalyticsCard data={memberAnalytics} />
              ) : (
                <Card className="bg-card border-border">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground font-mono">
                      Select a member to view their analytics
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrgAnalytics;
