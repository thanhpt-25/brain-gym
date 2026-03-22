import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Brain, TrendingUp, Trophy, Target, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/auth.store';
import { getCertifications } from '@/services/certifications';
import {
  getAnalyticsSummary, getAnalyticsHistory, getAnalyticsDomains, getWeakTopics,
  getReadiness, getMistakePatterns,
} from '@/services/analytics';
import { getFlashcardStats } from '@/services/flashcards';
import Navbar from '@/components/Navbar';
import Breadcrumb from '@/components/Breadcrumb';
import { StatsSkeleton } from '@/components/PageSkeleton';

import ReadinessScore from '@/components/dashboard/ReadinessScore';
import MistakePatternChart from '@/components/dashboard/MistakePatternChart';
import { ScoreTrendChart } from '@/components/dashboard/ScoreTrendChart';
import { WeakTopicsChart } from '@/components/dashboard/WeakTopicsChart';
import { FlashcardStatsPanel } from '@/components/dashboard/FlashcardStatsPanel';
import { ExamHistoryList } from '@/components/dashboard/ExamHistoryList';

const Dashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [certFilter, setCertFilter] = useState<string>('');

  const { data: certifications } = useQuery({
    queryKey: ['certifications'],
    queryFn: getCertifications,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['analytics-summary', certFilter],
    queryFn: () => getAnalyticsSummary(certFilter || undefined),
    enabled: isAuthenticated,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['analytics-history', certFilter],
    queryFn: () => getAnalyticsHistory(certFilter || undefined, 1, 50),
    enabled: isAuthenticated,
  });

  const { data: domains } = useQuery({
    queryKey: ['analytics-domains', certFilter],
    queryFn: () => getAnalyticsDomains(certFilter || undefined),
    enabled: isAuthenticated,
  });

  const { data: weakTopics } = useQuery({
    queryKey: ['analytics-weak', certFilter],
    queryFn: () => getWeakTopics(certFilter || undefined, 8),
    enabled: isAuthenticated,
  });

  const { data: readinessData } = useQuery({
    queryKey: ['readiness', certFilter],
    queryFn: () => getReadiness(certFilter),
    enabled: isAuthenticated && !!certFilter,
  });

  const { data: mistakePatterns } = useQuery({
    queryKey: ['mistake-patterns', certFilter],
    queryFn: () => getMistakePatterns(certFilter || undefined),
    enabled: isAuthenticated,
  });

  const { data: flashStats } = useQuery({
    queryKey: ['flashcard-stats'],
    queryFn: getFlashcardStats,
    enabled: isAuthenticated,
  });

  const history = historyData?.data ?? [];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-mono font-bold mb-2">Đăng nhập để xem Dashboard</h2>
          <Button className="glow-cyan font-mono" onClick={() => navigate('/auth')}>Đăng nhập</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Dashboard" />

      <div className="container pt-24 pb-16 space-y-8">
        <Breadcrumb items={[{ label: 'Dashboard' }]} className="mb-2" />

        {/* Cert filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={!certFilter ? 'default' : 'outline'}
            className="font-mono text-xs"
            onClick={() => setCertFilter('')}
          >
            All
          </Button>
          {certifications?.map(c => (
            <Button
              key={c.id}
              size="sm"
              variant={certFilter === c.id ? 'default' : 'outline'}
              className="font-mono text-xs"
              onClick={() => setCertFilter(c.id)}
            >
              {c.code}
            </Button>
          ))}
        </div>

        {/* Stats overview */}
        {summaryLoading ? (
          <StatsSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: FileText, label: 'Exams Taken', value: summary?.totalExams ?? 0, color: 'text-primary' },
              { icon: Trophy, label: 'Passed', value: summary?.totalPassed ?? 0, color: 'text-accent' },
              { icon: Target, label: 'Avg Score', value: `${summary?.avgScore ?? 0}%`, color: 'text-primary' },
              { icon: TrendingUp, label: 'Best Score', value: `${summary?.bestScore ?? 0}%`, color: 'text-accent' },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="glass-card">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-primary/10">
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold font-mono">{s.value}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Readiness + Mistake Patterns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ReadinessScore
            summary={summary}
            domains={domains ?? undefined}
            weakTopics={weakTopics ?? undefined}
            readiness={readinessData}
            isCertSelected={!!certFilter}
          />
          <MistakePatternChart
            history={history}
            patterns={mistakePatterns}
          />
        </div>

        <Tabs defaultValue="trend" className="space-y-6">
          <TabsList className="bg-secondary">
            <TabsTrigger value="trend" className="font-mono text-xs">Score Trend</TabsTrigger>
            <TabsTrigger value="weak" className="font-mono text-xs">Weak Topics</TabsTrigger>
            <TabsTrigger value="flashcards" className="font-mono text-xs">Flashcards</TabsTrigger>
            <TabsTrigger value="history" className="font-mono text-xs">History</TabsTrigger>
          </TabsList>

          <TabsContent value="trend">
            <ScoreTrendChart history={history} />
          </TabsContent>

          <TabsContent value="weak">
            <WeakTopicsChart weakTopics={weakTopics} domains={domains} />
          </TabsContent>

          <TabsContent value="flashcards">
            <FlashcardStatsPanel stats={flashStats} />
          </TabsContent>

          <TabsContent value="history">
            <ExamHistoryList certificationId={certFilter || undefined} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
