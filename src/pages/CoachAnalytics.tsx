import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MessageSquare,
  BarChart3,
  TrendingUp,
  Zap,
  DollarSign,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/components/Navbar';
import Breadcrumb from '@/components/Breadcrumb';
import { getCoachAnalytics } from '@/services/api';

const CoachAnalytics = () => {
  const navigate = useNavigate();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['coach-analytics'],
    queryFn: getCoachAnalytics,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Navbar title="Coach Analytics" />
        <div className="container pt-24 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            Loading analytics...
          </div>
        </div>
      </div>
    );
  }

  if (!analytics || analytics.totalSessions === 0) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Navbar title="Coach Analytics" />
        <div className="container pt-24 space-y-4">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Coach Analytics' },
            ]}
          />
          <Card className="glass-card">
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="font-mono font-semibold mb-2">No Coach Sessions Yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Start a coach session to see analytics and insights here.
              </p>
              <Button onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar title="Coach Analytics" />

      <div className="container pt-24 space-y-8">
        <div className="flex items-center gap-2 mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => navigate('/dashboard')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Coach Analytics' },
            ]}
          />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              icon: MessageSquare,
              label: 'Total Sessions',
              value: analytics.totalSessions,
              color: 'text-primary',
            },
            {
              icon: TrendingUp,
              label: 'Avg Messages',
              value: analytics.avgMessagesPerSession.toFixed(1),
              color: 'text-accent',
            },
            {
              icon: BarChart3,
              label: 'Avg Response Time',
              value: `${analytics.averageResponseTime}s`,
              color: 'text-cyan-500',
            },
            {
              icon: DollarSign,
              label: 'Total Cost',
              value: `$${analytics.totalCostUsd.toFixed(2)}`,
              color: 'text-green-500',
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card className="glass-card">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold font-mono">
                      {stat.value}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {stat.label}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Topics and Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Topics */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base font-mono flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> Top Topics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analytics.topicDistribution && analytics.topicDistribution.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.topicDistribution.map(
                      (item: { topic: string; count: number }, idx: number) => (
                        <div
                          key={item.topic}
                          className="space-y-2 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setSelectedTopic(
                            selectedTopic === item.topic ? null : item.topic
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <Badge variant="secondary" className="font-mono">
                              {item.topic}
                            </Badge>
                            <span className="text-xs font-mono text-muted-foreground">
                              {item.count} mentions
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
                              style={{
                                width: `${(item.count / Math.max(...analytics.topicDistribution.map((t: any) => t.count), 1)) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">
                    No topics detected yet
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Sessions Over Time */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base font-mono flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-accent" /> Sessions
                  Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.sessionsByDay && analytics.sessionsByDay.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-end justify-between gap-1 h-24">
                        {analytics.sessionsByDay.map(
                          (day: { date: string; sessionCount: number }, idx: number) => {
                            const maxSessions = Math.max(
                              ...analytics.sessionsByDay.map((d: any) => d.sessionCount),
                              1
                            );
                            const heightPercent = (day.sessionCount / maxSessions) * 100;
                            return (
                              <div
                                key={idx}
                                className="flex-1 flex flex-col items-center gap-1"
                              >
                                <div
                                  className="w-full bg-primary/60 rounded-sm transition-colors hover:bg-primary"
                                  style={{
                                    height: `${heightPercent}%`,
                                    minHeight: '2px',
                                  }}
                                  title={`${day.date}: ${day.sessionCount} sessions`}
                                />
                              </div>
                            );
                          }
                        )}
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                        <span>{analytics.sessionsByDay[0]?.date}</span>
                        <span>
                          {analytics.sessionsByDay[
                            analytics.sessionsByDay.length - 1
                          ]?.date}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">
                      No session data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Usage Summary */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48 }}
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base font-mono">Usage Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Total Messages Exchanged</div>
                  <div className="text-xl font-bold font-mono">
                    {analytics.totalSessions > 0
                      ? Math.round(
                        analytics.avgMessagesPerSession * analytics.totalSessions
                      )
                      : 0}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Average Session Length</div>
                  <div className="text-xl font-bold font-mono">
                    {analytics.avgMessagesPerSession.toFixed(1)} messages
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">
                    Cumulative Learning Time
                  </div>
                  <div className="text-xl font-bold font-mono">
                    {Math.round((analytics.totalSessions * 10) / 60)}h{' '}
                    {(analytics.totalSessions * 10) % 60}m
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default CoachAnalytics;
