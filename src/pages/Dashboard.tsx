import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Brain, TrendingUp, AlertTriangle, Trophy, Clock, Target,
  ArrowLeft, CheckCircle2, XCircle, FileText, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/auth.store';
import { getCertifications } from '@/services/certifications';
import {
  getAnalyticsSummary, getAnalyticsHistory, getAnalyticsDomains, getWeakTopics,
  HistoryItem, DomainPerformance,
} from '@/services/analytics';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar,
} from 'recharts';
import Navbar from '@/components/Navbar';
import ReadinessScore from '@/components/dashboard/ReadinessScore';
import MistakePatternChart from '@/components/dashboard/MistakePatternChart';

const chartConfig = {
  score: { label: 'Score %', color: 'hsl(var(--primary))' },
  percentage: { label: 'Accuracy %', color: 'hsl(var(--accent))' },
};

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
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

  const history = historyData?.data ?? [];

  const scoreTrend = useMemo(() =>
    [...history]
      .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
      .map(h => ({
        date: new Date(h.submittedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        score: h.score,
        cert: h.certification.code,
      })),
    [history],
  );

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
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
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
          <ReadinessScore summary={summary} domains={domains ?? undefined} weakTopics={weakTopics ?? undefined} />
          <MistakePatternChart history={history} />
        </div>


          <TabsList className="bg-secondary">
            <TabsTrigger value="trend" className="font-mono text-xs">Score Trend</TabsTrigger>
            <TabsTrigger value="weak" className="font-mono text-xs">Weak Topics</TabsTrigger>
            <TabsTrigger value="history" className="font-mono text-xs">History</TabsTrigger>
          </TabsList>

          {/* ── Score Trend ── */}
          <TabsContent value="trend">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base font-mono flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Score Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scoreTrend.length < 2 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Cần ít nhất 2 bài thi để hiển thị biểu đồ.
                  </p>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <LineChart data={scoreTrend} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Weak Topics ── */}
          <TabsContent value="weak">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base font-mono flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" /> Weak Topics Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {!weakTopics?.length ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Chưa có dữ liệu. Hãy hoàn thành ít nhất 1 bài thi.
                  </p>
                ) : (
                  <>
                    <ChartContainer config={chartConfig} className="h-[260px] w-full">
                      <BarChart
                        data={weakTopics.slice(0, 6)}
                        layout="vertical"
                        margin={{ top: 0, right: 12, bottom: 0, left: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis
                          dataKey="domain"
                          type="category"
                          width={180}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="percentage" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ChartContainer>

                    <DomainList domains={domains ?? []} />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── History ── */}
          <TabsContent value="history">
            <div className="space-y-3">
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Chưa có lịch sử thi.</p>
              ) : (
                history.map((h, i) => (
                  <motion.div
                    key={h.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <HistoryCard item={h} />
                  </motion.div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

function HistoryCard({ item }: { item: HistoryItem }) {
  return (
    <Card className="glass-card hover:border-primary/30 transition-colors">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-semibold text-sm">{item.certification.code}</span>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-3">
            <span>{new Date(item.submittedAt).toLocaleDateString('vi-VN')}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatTime(item.timeSpent)}
            </span>
          </div>
        </div>
        <div className="text-right flex items-center gap-3">
          <div>
            <div className={`text-lg font-bold font-mono ${item.passed ? 'text-accent' : 'text-destructive'}`}>
              {item.score}%
            </div>
            <div className="text-[10px] text-muted-foreground">{item.totalCorrect}/{item.totalQuestions}</div>
          </div>
          {item.passed ? (
            <CheckCircle2 className="h-5 w-5 text-accent" />
          ) : (
            <XCircle className="h-5 w-5 text-destructive" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DomainList({ domains }: { domains: DomainPerformance[] }) {
  return (
    <div className="space-y-3">
      {domains.map((t, i) => (
        <div key={t.domain} className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{t.domain}</div>
            <div className="text-xs text-muted-foreground">{t.correct}/{t.total}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${t.percentage}%`,
                  backgroundColor: t.percentage >= 75
                    ? 'hsl(var(--accent))'
                    : t.percentage >= 50
                      ? 'hsl(var(--warning))'
                      : 'hsl(var(--destructive))',
                }}
              />
            </div>
            <span className={`text-xs font-mono font-bold min-w-[36px] text-right ${
              t.percentage >= 75
                ? 'text-accent'
                : t.percentage >= 50
                  ? 'text-warning'
                  : 'text-destructive'
            }`}>
              {t.percentage}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Dashboard;
