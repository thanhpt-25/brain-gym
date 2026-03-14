import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Brain, TrendingUp, AlertTriangle, Trophy, Clock, Target,
  ChevronRight, ArrowLeft, CheckCircle2, XCircle, BookOpen, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/auth.store';
import { examHistory, ExamHistoryItem } from '@/data/mockDashboardData';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, ResponsiveContainer,
} from 'recharts';

/* ──────────────── helpers ──────────────── */

function getScoreTrend(history: ExamHistoryItem[]) {
  return [...history]
    .filter((h) => h.mode === 'exam')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((h) => ({
      date: new Date(h.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      score: h.percentage,
      cert: h.certCode,
      fullDate: h.date,
    }));
}

interface WeakTopic {
  domain: string;
  correct: number;
  total: number;
  percentage: number;
  cert: string;
}

function getWeakTopics(history: ExamHistoryItem[]): WeakTopic[] {
  const map: Record<string, { correct: number; total: number; cert: string }> = {};
  history.forEach((h) => {
    h.domainResults.forEach((d) => {
      const key = `${d.domain}__${h.certCode}`;
      if (!map[key]) map[key] = { correct: 0, total: 0, cert: h.certCode };
      map[key].correct += d.correct;
      map[key].total += d.total;
    });
  });
  return Object.entries(map)
    .map(([key, v]) => ({
      domain: key.split('__')[0],
      ...v,
      percentage: Math.round((v.correct / v.total) * 100),
    }))
    .sort((a, b) => a.percentage - b.percentage);
}

/* ──────────────── component ──────────────── */

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [certFilter, setCertFilter] = useState<string>('all');

  const filtered = useMemo(
    () => (certFilter === 'all' ? examHistory : examHistory.filter((h) => h.certId === certFilter)),
    [certFilter],
  );

  const scoreTrend = useMemo(() => getScoreTrend(filtered), [filtered]);
  const weakTopics = useMemo(() => getWeakTopics(filtered), [filtered]);

  const totalExams = filtered.filter((h) => h.mode === 'exam').length;
  const totalPassed = filtered.filter((h) => h.mode === 'exam' && h.passed).length;
  const avgScore = totalExams
    ? Math.round(filtered.filter((h) => h.mode === 'exam').reduce((s, h) => s + h.percentage, 0) / totalExams)
    : 0;
  const bestScore = totalExams
    ? Math.max(...filtered.filter((h) => h.mode === 'exam').map((h) => h.percentage))
    : 0;

  const uniqueCerts = Array.from(new Set(examHistory.map((h) => h.certId))).map((id) => {
    const item = examHistory.find((h) => h.certId === id)!;
    return { id, code: item.certCode, icon: item.icon };
  });

  const chartConfig = {
    score: { label: 'Score %', color: 'hsl(var(--primary))' },
    percentage: { label: 'Accuracy %', color: 'hsl(var(--accent))' },
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Brain className="h-6 w-6 text-primary" />
            <span className="font-mono text-lg font-bold text-gradient-cyan">Dashboard</span>
          </div>
          <span className="text-sm font-mono text-muted-foreground">
            {user?.displayName || 'Guest'}
          </span>
        </div>
      </nav>

      <div className="container pt-24 pb-16 space-y-8">
        {/* Cert filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={certFilter === 'all' ? 'default' : 'outline'}
            className="font-mono text-xs"
            onClick={() => setCertFilter('all')}
          >
            All
          </Button>
          {uniqueCerts.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={certFilter === c.id ? 'default' : 'outline'}
              className="font-mono text-xs"
              onClick={() => setCertFilter(c.id)}
            >
              {c.icon} {c.code}
            </Button>
          ))}
        </div>

        {/* Stats overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: FileText, label: 'Exams Taken', value: totalExams, color: 'text-primary' },
            { icon: Trophy, label: 'Passed', value: totalPassed, color: 'text-accent' },
            { icon: Target, label: 'Avg Score', value: `${avgScore}%`, color: 'text-primary' },
            { icon: TrendingUp, label: 'Best Score', value: `${bestScore}%`, color: 'text-accent' },
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

        <Tabs defaultValue="trend" className="space-y-6">
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
                {/* Bar chart */}
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

                {/* List */}
                <div className="space-y-3">
                  {weakTopics.map((t, i) => (
                    <div key={t.domain + t.cert} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{t.domain}</div>
                        <div className="text-xs text-muted-foreground">{t.cert} · {t.correct}/{t.total}</div>
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── History ── */}
          <TabsContent value="history">
            <div className="space-y-3">
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Chưa có lịch sử thi.</p>
              )}
              {filtered
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((h, i) => (
                  <motion.div
                    key={h.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="glass-card hover:border-primary/30 transition-colors">
                      <CardContent className="p-4 flex items-center gap-4">
                        <span className="text-2xl">{h.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-semibold text-sm">{h.certCode}</span>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                              h.mode === 'study'
                                ? 'bg-accent/10 text-accent border border-accent/20'
                                : 'bg-primary/10 text-primary border border-primary/20'
                            }`}>
                              {h.mode === 'study' ? <BookOpen className="inline w-3 h-3 mr-0.5 -mt-0.5" /> : null}
                              {h.mode}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-3">
                            <span>{new Date(h.date).toLocaleDateString('vi-VN')}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {h.timeTaken}m
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <div className={`text-lg font-bold font-mono ${h.passed ? 'text-accent' : 'text-destructive'}`}>
                              {h.percentage}%
                            </div>
                            <div className="text-[10px] text-muted-foreground">{h.score}/{h.total}</div>
                          </div>
                          {h.passed ? (
                            <CheckCircle2 className="h-5 w-5 text-accent" />
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
