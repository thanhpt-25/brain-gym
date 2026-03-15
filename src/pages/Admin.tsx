import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUsers, updateUserRole, AdminUser,
  getPendingQuestions, updateQuestionStatus, PendingQuestion,
  getReports, updateReportStatus, AdminReport,
} from '@/services/admin';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Brain, ArrowLeft, Users, FileText, AlertTriangle, CheckCircle2, XCircle,
  Search, Loader2, Shield,
} from 'lucide-react';
import { toast } from 'sonner';

const ROLES = ['LEARNER', 'CONTRIBUTOR', 'REVIEWER', 'ADMIN'];
const REPORT_STATUSES = ['PENDING', 'RESOLVED', 'DISMISSED'];

const statusColor: Record<string, string> = {
  DRAFT: 'bg-secondary text-secondary-foreground',
  PENDING: 'bg-warning/10 text-warning border border-warning/30',
  APPROVED: 'bg-accent/10 text-accent border border-accent/30',
  REJECTED: 'bg-destructive/10 text-destructive border border-destructive/30',
  RESOLVED: 'bg-accent/10 text-accent border border-accent/30',
  DISMISSED: 'bg-secondary text-muted-foreground',
};

const AdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  if (user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-mono font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">Admin access required.</p>
          <Button onClick={() => navigate('/')}>Back Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Brain className="h-6 w-6 text-primary" />
            <span className="font-mono text-lg font-bold text-gradient-cyan">Admin Panel</span>
          </div>
        </div>
      </nav>

      <div className="container pt-24 pb-16">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="bg-secondary">
            <TabsTrigger value="users" className="font-mono text-xs"><Users className="h-3 w-3 mr-1" /> Users</TabsTrigger>
            <TabsTrigger value="moderation" className="font-mono text-xs"><FileText className="h-3 w-3 mr-1" /> Moderation</TabsTrigger>
            <TabsTrigger value="reports" className="font-mono text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="moderation"><ModerationTab /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

function UsersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, page],
    queryFn: () => getUsers(search || undefined, page, 20),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Role updated');
    },
    onError: () => toast.error('Failed to update role'),
  });

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-mono flex items-center justify-between">
          <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> User Management</span>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-8 text-sm"
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono">User</TableHead>
                  <TableHead className="font-mono">Email</TableHead>
                  <TableHead className="font-mono text-center">Role</TableHead>
                  <TableHead className="font-mono text-center">Points</TableHead>
                  <TableHead className="font-mono text-center">Qs</TableHead>
                  <TableHead className="font-mono text-center">Exams</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-sm">{u.displayName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-center">
                      <Select
                        value={u.role}
                        onValueChange={role => roleMutation.mutate({ userId: u.id, role })}
                      >
                        <SelectTrigger className="h-7 w-[130px] text-xs font-mono mx-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => <SelectItem key={r} value={r} className="text-xs font-mono">{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">{u.points}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{u._count.questions}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{u._count.examAttempts}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data && data.meta.lastPage > 1 && (
              <div className="flex justify-center mt-4 gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <span className="py-2 px-3 text-xs font-mono text-muted-foreground">Page {page}/{data.meta.lastPage}</span>
                <Button size="sm" variant="outline" disabled={page >= data.meta.lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ModerationTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-pending', page],
    queryFn: () => getPendingQuestions(page, 10),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateQuestionStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending'] });
      toast.success('Question status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-mono flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Question Moderation Queue
          {data && <Badge variant="secondary" className="font-mono">{data.meta.total} pending</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : data?.data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No pending questions 🎉</p>
        ) : (
          <div className="space-y-4">
            {data?.data.map(q => (
              <div key={q.id} className="p-4 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">{q.certification.code}</span>
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                        q.difficulty === 'EASY' ? 'bg-accent/10 text-accent' :
                        q.difficulty === 'MEDIUM' ? 'bg-warning/10 text-warning' :
                        'bg-destructive/10 text-destructive'
                      }`}>{q.difficulty}</span>
                      <span className="text-xs text-muted-foreground">by {q.author.displayName}</span>
                    </div>
                    <h4 className="text-sm font-medium">{q.title}</h4>
                    {q.description && <p className="text-xs text-muted-foreground mt-1">{q.description}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-accent border-accent/30 hover:bg-accent/10 h-8"
                      onClick={() => statusMutation.mutate({ id: q.id, status: 'APPROVED' })}
                      disabled={statusMutation.isPending}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8"
                      onClick={() => statusMutation.mutate({ id: q.id, status: 'REJECTED' })}
                      disabled={statusMutation.isPending}
                    >
                      <XCircle className="h-3 w-3 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  {q.choices.map(c => (
                    <div key={c.id} className={`text-xs px-3 py-1.5 rounded ${
                      c.isCorrect ? 'bg-accent/10 text-accent' : 'text-muted-foreground'
                    }`}>
                      {c.label.toUpperCase()}. {c.content} {c.isCorrect && '✓'}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {data && data.meta.lastPage > 1 && (
              <div className="flex justify-center gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <span className="py-2 px-3 text-xs font-mono text-muted-foreground">Page {page}/{data.meta.lastPage}</span>
                <Button size="sm" variant="outline" disabled={page >= data.meta.lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportsTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', statusFilter, page],
    queryFn: () => getReports(statusFilter || undefined, page, 20),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateReportStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      toast.success('Report updated');
    },
    onError: () => toast.error('Failed to update report'),
  });

  const reasonLabel: Record<string, string> = {
    WRONG_ANSWER: 'Wrong Answer',
    OUTDATED: 'Outdated',
    DUPLICATE: 'Duplicate',
    INAPPROPRIATE: 'Inappropriate',
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-mono flex items-center justify-between">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> Reports</span>
          <div className="flex gap-2">
            {REPORT_STATUSES.map(s => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                className="font-mono text-xs h-7"
                onClick={() => { setStatusFilter(s); setPage(1); }}
              >
                {s}
              </Button>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : data?.data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No {statusFilter.toLowerCase()} reports</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono">Question</TableHead>
                  <TableHead className="font-mono">Reason</TableHead>
                  <TableHead className="font-mono">Reporter</TableHead>
                  <TableHead className="font-mono">Date</TableHead>
                  <TableHead className="font-mono text-center">Status</TableHead>
                  <TableHead className="font-mono text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm max-w-[200px] truncate">{r.question.title}</TableCell>
                    <TableCell>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-warning/10 text-warning">
                        {reasonLabel[r.reason] || r.reason}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.user.displayName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('vi-VN')}</TableCell>
                    <TableCell className="text-center">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${statusColor[r.status] || ''}`}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === 'PENDING' && (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-accent"
                            onClick={() => resolveMutation.mutate({ id: r.id, status: 'RESOLVED' })}
                          >
                            Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => resolveMutation.mutate({ id: r.id, status: 'DISMISSED' })}
                          >
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data && data.meta.lastPage > 1 && (
              <div className="flex justify-center mt-4 gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <span className="py-2 px-3 text-xs font-mono text-muted-foreground">Page {page}/{data.meta.lastPage}</span>
                <Button size="sm" variant="outline" disabled={page >= data.meta.lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminPage;
