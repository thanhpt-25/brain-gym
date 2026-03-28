import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '@/services/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, AlertTriangle, Loader2, BookOpen, Brain, Building2, Award, Cpu } from 'lucide-react';

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getDashboard,
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const stats = [
    { label: 'Total Users', value: data.users.total, sub: `+${data.users.newLast7d} this week`, icon: Users, color: 'text-primary' },
    { label: 'Providers', value: data.providers.total, icon: Building2, color: 'text-cyan-500' },
    { label: 'Certifications', value: data.certifications.total, icon: Award, color: 'text-violet-500' },
    { label: 'Total Questions', value: data.questions.total, sub: `${data.questions.pending} pending`, icon: FileText, color: 'text-accent' },
    { label: 'Total Exams', value: data.exams.total, icon: BookOpen, color: 'text-blue-500' },
    { label: 'Exam Attempts', value: data.attempts.total, icon: Brain, color: 'text-emerald-500' },
    { label: 'Pending Reports', value: data.reports.pending, icon: AlertTriangle, color: data.reports.pending > 0 ? 'text-warning' : 'text-muted-foreground' },
    { label: 'AI Generations', value: data.aiGeneration.completed, sub: `${data.aiGeneration.failed} failed`, icon: Cpu, color: 'text-purple-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <p className="text-2xl font-mono font-bold">{s.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground font-mono">{s.label}</p>
              {s.sub && <p className="text-[10px] text-muted-foreground mt-1">{s.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm font-mono">Question Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Approved', value: data.questions.approved, color: 'bg-accent' },
                { label: 'Pending', value: data.questions.pending, color: 'bg-warning' },
                { label: 'Draft', value: data.questions.draft, color: 'bg-secondary' },
                { label: 'Rejected', value: data.questions.rejected, color: 'bg-destructive' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs font-mono w-20 text-muted-foreground">{item.label}</span>
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all`}
                      style={{ width: `${data.questions.total ? (item.value / data.questions.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono w-12 text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm font-mono">User Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-muted-foreground">Last 7 days</span>
                <span className="text-lg font-mono font-bold text-accent">+{data.users.newLast7d}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-muted-foreground">Last 30 days</span>
                <span className="text-lg font-mono font-bold text-primary">+{data.users.newLast30d}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-xs font-mono text-muted-foreground">Total registered</span>
                <span className="text-lg font-mono font-bold">{data.users.total}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
