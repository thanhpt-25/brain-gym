import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Link, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { getAdminExams, updateExamVisibility } from '@/services/admin';

const VISIBILITY_COLORS: Record<string, string> = {
  PUBLIC: 'text-green-400',
  PRIVATE: 'text-muted-foreground',
  LINK: 'text-blue-400',
};

const VISIBILITY_ICONS: Record<string, React.ReactNode> = {
  PUBLIC: <Eye className="h-3 w-3" />,
  PRIVATE: <EyeOff className="h-3 w-3" />,
  LINK: <Link className="h-3 w-3" />,
};

export function ExamsTab() {
  const qc = useQueryClient();
  const [visFilter, setVisFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-exams', visFilter, page],
    queryFn: () => getAdminExams({ visibility: visFilter || undefined, page }),
  });

  const visMutation = useMutation({
    mutationFn: ({ id, visibility }: { id: string; visibility: string }) => updateExamVisibility(id, visibility),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-exams'] }); toast.success('Visibility updated'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update visibility'),
  });

  const exams = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={visFilter} onValueChange={v => { setVisFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40 font-mono text-xs"><SelectValue placeholder="All visibility" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All visibility</SelectItem>
            <SelectItem value="PUBLIC">Public</SelectItem>
            <SelectItem value="PRIVATE">Private</SelectItem>
            <SelectItem value="LINK">Link only</SelectItem>
          </SelectContent>
        </Select>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => qc.invalidateQueries({ queryKey: ['admin-exams'] })}>
          <RefreshCw className="h-3 w-3" />
        </Button>
        <span className="text-xs text-muted-foreground font-mono">{data?.meta?.total ?? 0} exams</span>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-mono text-xs">Title</TableHead>
              <TableHead className="font-mono text-xs">Certification</TableHead>
              <TableHead className="font-mono text-xs">Author</TableHead>
              <TableHead className="font-mono text-xs">Questions</TableHead>
              <TableHead className="font-mono text-xs">Attempts</TableHead>
              <TableHead className="font-mono text-xs">Visibility</TableHead>
              <TableHead className="font-mono text-xs">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground font-mono text-xs py-8">Loading...</TableCell></TableRow>
            ) : exams.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground font-mono text-xs py-8">No exams found</TableCell></TableRow>
            ) : (exams as any[]).map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-sm font-medium max-w-[200px] truncate">{e.title}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">{e.certification?.code}</TableCell>
                <TableCell className="text-xs font-mono">{e.author?.displayName || '—'}</TableCell>
                <TableCell className="text-xs font-mono">{e._count?.examQuestions ?? 0}</TableCell>
                <TableCell className="text-xs font-mono">{e._count?.attempts ?? 0}</TableCell>
                <TableCell>
                  <Select
                    value={e.visibility}
                    onValueChange={v => visMutation.mutate({ id: e.id, visibility: v })}
                  >
                    <SelectTrigger className={`h-7 w-28 font-mono text-[11px] border-0 bg-transparent p-0 ${VISIBILITY_COLORS[e.visibility] || ''}`}>
                      <span className="flex items-center gap-1">
                        {VISIBILITY_ICONS[e.visibility]}
                        <SelectValue />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC">Public</SelectItem>
                      <SelectItem value="PRIVATE">Private</SelectItem>
                      <SelectItem value="LINK">Link only</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">{new Date(e.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data?.meta && data.meta.lastPage > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="ghost" className="font-mono text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-xs font-mono text-muted-foreground">{page} / {data.meta.lastPage}</span>
          <Button size="sm" variant="ghost" className="font-mono text-xs" disabled={page >= data.meta.lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
