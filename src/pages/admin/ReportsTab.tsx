import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getReports, updateReportStatus } from '@/services/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const REPORT_STATUSES = ['PENDING', 'RESOLVED', 'DISMISSED'];
const statusColor: Record<string, string> = {
  PENDING: 'bg-warning/10 text-warning border border-warning/30',
  RESOLVED: 'bg-accent/10 text-accent border border-accent/30',
  DISMISSED: 'bg-secondary text-muted-foreground',
};
const reasonLabel: Record<string, string> = {
  WRONG_ANSWER: 'Wrong Answer', OUTDATED: 'Outdated', DUPLICATE: 'Duplicate', INAPPROPRIATE: 'Inappropriate',
};

export default function ReportsTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', statusFilter, page],
    queryFn: () => getReports(statusFilter || undefined, page, 20),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateReportStatus(id, status),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-reports'] }); toast.success('Report updated'); },
    onError: () => toast.error('Failed to update report'),
  });

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-mono flex items-center justify-between">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> Reports</span>
          <div className="flex gap-2">
            {REPORT_STATUSES.map(s => (
              <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'} className="font-mono text-xs h-7" onClick={() => { setStatusFilter(s); setPage(1); }}>
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
                    <TableCell><span className="text-xs font-mono px-2 py-0.5 rounded bg-warning/10 text-warning">{reasonLabel[r.reason] || r.reason}</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.user.displayName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('vi-VN')}</TableCell>
                    <TableCell className="text-center"><span className={`text-xs font-mono px-2 py-0.5 rounded-full ${statusColor[r.status] || ''}`}>{r.status}</span></TableCell>
                    <TableCell className="text-right">
                      {r.status === 'PENDING' && (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-accent" onClick={() => resolveMutation.mutate({ id: r.id, status: 'RESOLVED' })}>Resolve</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => resolveMutation.mutate({ id: r.id, status: 'DISMISSED' })}>Dismiss</Button>
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
