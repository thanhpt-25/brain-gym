import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, RefreshCw, FileText, Link, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getAdminGenerationJobs, getAdminSourceMaterials, deleteSourceMaterial } from '@/services/admin';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  PROCESSING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPLETED: 'bg-green-500/10 text-green-400 border-green-500/20',
  FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const CONTENT_TYPE_ICON: Record<string, React.ReactNode> = {
  PDF: <FileText className="h-3 w-3" />,
  URL: <Link className="h-3 w-3" />,
  TEXT: <Type className="h-3 w-3" />,
};

export function AiGenerationTab() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'jobs' | 'materials'>('jobs');
  const [statusFilter, setStatusFilter] = useState('all');
  const [jobPage, setJobPage] = useState(1);
  const [matPage, setMatPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: jobsData, isLoading: jobsLoading, isError: jobsError } = useQuery({
    queryKey: ['admin-generation-jobs', statusFilter, jobPage],
    queryFn: () => getAdminGenerationJobs({ status: statusFilter === 'all' ? undefined : statusFilter, page: jobPage }),
  });

  const { data: matsData, isLoading: matsLoading, isError: matsError } = useQuery({
    queryKey: ['admin-source-materials', matPage],
    queryFn: () => getAdminSourceMaterials({ page: matPage }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSourceMaterial(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-source-materials'] }); setDeleteId(null); toast.success('Material deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete material'),
  });

  const jobs = jobsData?.data ?? [];
  const mats = matsData?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setTab('jobs')} className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${tab === 'jobs' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          Generation Jobs {jobsData?.meta?.total !== undefined && `(${jobsData.meta.total})`}
        </button>
        <button onClick={() => setTab('materials')} className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${tab === 'materials' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          Source Materials {matsData?.meta?.total !== undefined && `(${matsData.meta.total})`}
        </button>
      </div>

      {tab === 'jobs' && (
        <>
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setJobPage(1); }}>
              <SelectTrigger className="w-40 font-mono text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => qc.invalidateQueries({ queryKey: ['admin-generation-jobs'] })}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>

          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-xs">User</TableHead>
                  <TableHead className="font-mono text-xs">Certification</TableHead>
                  <TableHead className="font-mono text-xs">Domain</TableHead>
                  <TableHead className="font-mono text-xs">Provider</TableHead>
                  <TableHead className="font-mono text-xs">Questions</TableHead>
                  <TableHead className="font-mono text-xs">Status</TableHead>
                  <TableHead className="font-mono text-xs">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobsLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground font-mono text-xs py-8">Loading...</TableCell></TableRow>
                ) : jobsError ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-destructive font-mono text-xs py-8">Failed to load generation jobs. Try refreshing.</TableCell></TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground font-mono text-xs py-8">No jobs found</TableCell></TableRow>
                ) : (jobs as any[]).map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="text-xs font-mono">{j.user?.displayName || j.user?.email || j.userId}</TableCell>
                    <TableCell className="text-xs font-mono">{j.certification?.code}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{j.domain?.name || '—'}</TableCell>
                    <TableCell className="text-xs font-mono">{j.provider}</TableCell>
                    <TableCell className="text-xs font-mono">{j._count?.questions ?? 0} / {j.questionCount}</TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${STATUS_COLORS[j.status] || ''}`}>{j.status}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{new Date(j.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {jobsData?.meta && jobsData.meta.lastPage > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" variant="ghost" className="font-mono text-xs" disabled={jobPage === 1} onClick={() => setJobPage(p => p - 1)}>Prev</Button>
              <span className="text-xs font-mono text-muted-foreground">{jobPage} / {jobsData.meta.lastPage}</span>
              <Button size="sm" variant="ghost" className="font-mono text-xs" disabled={jobPage >= jobsData.meta.lastPage} onClick={() => setJobPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}

      {tab === 'materials' && (
        <>
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-xs">Title</TableHead>
                  <TableHead className="font-mono text-xs">Type</TableHead>
                  <TableHead className="font-mono text-xs">Certification</TableHead>
                  <TableHead className="font-mono text-xs">Chunks</TableHead>
                  <TableHead className="font-mono text-xs">Status</TableHead>
                  <TableHead className="font-mono text-xs">Created</TableHead>
                  <TableHead className="font-mono text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matsLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground font-mono text-xs py-8">Loading...</TableCell></TableRow>
                ) : matsError ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-destructive font-mono text-xs py-8">Failed to load source materials. Try refreshing.</TableCell></TableRow>
                ) : mats.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground font-mono text-xs py-8">No materials found</TableCell></TableRow>
                ) : (mats as any[]).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm font-medium max-w-[200px] truncate">{m.title}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                        {CONTENT_TYPE_ICON[m.contentType]} {m.contentType}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{m.certification?.code || '—'}</TableCell>
                    <TableCell className="text-xs font-mono">{m._count?.chunks ?? m.chunkCount ?? 0}</TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${STATUS_COLORS[m.status?.toUpperCase()] || 'bg-secondary text-muted-foreground border-border'}`}>
                        {m.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{new Date(m.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(m.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {matsData?.meta && matsData.meta.lastPage > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" variant="ghost" className="font-mono text-xs" disabled={matPage === 1} onClick={() => setMatPage(p => p - 1)}>Prev</Button>
              <span className="text-xs font-mono text-muted-foreground">{matPage} / {matsData.meta.lastPage}</span>
              <Button size="sm" variant="ghost" className="font-mono text-xs" disabled={matPage >= matsData.meta.lastPage} onClick={() => setMatPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="glass-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="font-mono">Delete Source Material?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the material and all its processed chunks.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="font-mono text-xs">Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending} className="font-mono text-xs">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
