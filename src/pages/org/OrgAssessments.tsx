import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '@/stores/org.store';
import { getAssessments, updateAssessmentStatus } from '@/services/assessments';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Loader2, ClipboardList, Users, MoreHorizontal,
  Pencil, Eye, Play, Pause, Archive, ChevronLeft, ChevronRight, Clock,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Assessment, AssessmentStatus } from '@/types/assessment-types';

const statusColors: Record<AssessmentStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  ACTIVE: 'bg-emerald-500/15 text-emerald-400',
  CLOSED: 'bg-amber-500/15 text-amber-400',
  ARCHIVED: 'bg-zinc-500/15 text-zinc-400',
};

const OrgAssessments = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || '';
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['org-assessments', slug, page],
    queryFn: () => getAssessments(slug, page),
    enabled: !!slug,
  });

  const statusMutation = useMutation({
    mutationFn: ({ aid, status }: { aid: string; status: AssessmentStatus }) =>
      updateAssessmentStatus(slug, aid, status),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['org-assessments', slug] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Update failed'),
  });

  const items = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-mono font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Assessments
          </h1>
          <p className="text-sm text-muted-foreground font-mono">
            {meta?.total ?? 0} assessments
          </p>
        </div>
        <Button
          size="sm"
          className="glow-cyan"
          onClick={() => navigate(`/org/${slug}/assessments/create`)}
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-mono text-sm">No assessments yet</p>
          <Button
            className="mt-4 glow-cyan"
            onClick={() => navigate(`/org/${slug}/assessments/create`)}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Create first assessment
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: Assessment) => (
            <Card
              key={item.id}
              className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => navigate(`/org/${slug}/assessments/${item.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-mono font-medium truncate">
                        {item.title}
                      </span>
                      <Badge className={`text-[10px] ${statusColors[item.status]}`}>
                        {item.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {item.questionCount} Q
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {item.timeLimit} min
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {item._count?.candidateInvites ?? 0} invited
                      </span>
                      {item.submittedCount != null && item.submittedCount > 0 && (
                        <span>
                          {item.submittedCount} submitted
                          {item.avgScore != null && ` · avg ${item.avgScore.toFixed(1)}%`}
                        </span>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => navigate(`/org/${slug}/assessments/${item.id}`)}>
                        <Eye className="h-4 w-4 mr-2" /> View Results
                      </DropdownMenuItem>
                      {item.status === 'DRAFT' && (
                        <DropdownMenuItem onClick={() => navigate(`/org/${slug}/assessments/${item.id}/edit`)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {item.status === 'DRAFT' && (
                        <DropdownMenuItem
                          onClick={() => statusMutation.mutate({ aid: item.id, status: 'ACTIVE' })}
                        >
                          <Play className="h-4 w-4 mr-2" /> Activate
                        </DropdownMenuItem>
                      )}
                      {item.status === 'ACTIVE' && (
                        <DropdownMenuItem
                          onClick={() => statusMutation.mutate({ aid: item.id, status: 'CLOSED' })}
                        >
                          <Pause className="h-4 w-4 mr-2" /> Close
                        </DropdownMenuItem>
                      )}
                      {(item.status === 'CLOSED' || item.status === 'DRAFT') && (
                        <DropdownMenuItem
                          onClick={() => statusMutation.mutate({ aid: item.id, status: 'ARCHIVED' })}
                        >
                          <Archive className="h-4 w-4 mr-2" /> Archive
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.lastPage > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono text-muted-foreground">
            {page} / {meta.lastPage}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= meta.lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default OrgAssessments;
