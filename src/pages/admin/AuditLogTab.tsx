import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLogs } from '@/services/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Loader2, Search } from 'lucide-react';

const ACTION_TYPES = [
  'ALL', 'ROLE_CHANGED', 'USER_SUSPENDED', 'USER_BANNED', 'USER_REACTIVATED',
  'QUESTION_EDITED', 'QUESTION_DELETED', 'POINTS_ADJUSTED',
];

const actionColor: Record<string, string> = {
  ROLE_CHANGED: 'bg-blue-500/10 text-blue-500',
  USER_SUSPENDED: 'bg-warning/10 text-warning',
  USER_BANNED: 'bg-destructive/10 text-destructive',
  USER_REACTIVATED: 'bg-accent/10 text-accent',
  QUESTION_EDITED: 'bg-primary/10 text-primary',
  QUESTION_DELETED: 'bg-destructive/10 text-destructive',
  POINTS_ADJUSTED: 'bg-violet-500/10 text-violet-500',
};

export default function AuditLogTab() {
  const [actionFilter, setActionFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit-logs', actionFilter, page],
    queryFn: () => getAuditLogs({
      action: actionFilter !== 'ALL' ? actionFilter : undefined,
      page,
      limit: 20,
    }),
  });

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-mono flex items-center justify-between">
          <span className="flex items-center gap-2"><ScrollText className="h-4 w-4 text-primary" /> Audit Log</span>
          <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[180px] h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map(a => <SelectItem key={a} value={a} className="text-xs font-mono">{a === 'ALL' ? 'All Actions' : a}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : data?.data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No audit logs found</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono">Date</TableHead>
                  <TableHead className="font-mono">Admin</TableHead>
                  <TableHead className="font-mono">Action</TableHead>
                  <TableHead className="font-mono">Target</TableHead>
                  <TableHead className="font-mono">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('vi-VN')}
                    </TableCell>
                    <TableCell className="text-sm">{log.user.displayName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] font-mono ${actionColor[log.action] || ''}`}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {log.targetType}:{log.targetId.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {log.metadata ? JSON.stringify(log.metadata) : '-'}
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
