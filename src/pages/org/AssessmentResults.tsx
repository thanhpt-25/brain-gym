import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '@/stores/org.store';
import {
  getAssessmentResults, inviteCandidates, updateAssessmentStatus,
  exportAssessmentCsv,
} from '@/services/assessments';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Loader2, ClipboardList, UserPlus, Download,
  Play, Pause, Users, CheckCircle2, XCircle, Clock, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import InviteCandidatesModal from '@/components/org/InviteCandidatesModal';
import CandidateRanking from '@/components/org/CandidateRanking';
import AssessmentFunnel from '@/components/org/AssessmentFunnel';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  ACTIVE: 'bg-emerald-500/15 text-emerald-400',
  CLOSED: 'bg-amber-500/15 text-amber-400',
  ARCHIVED: 'bg-zinc-500/15 text-zinc-400',
};

const AssessmentResults = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { aid } = useParams();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || '';
  const [showInvite, setShowInvite] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['assessment-results', slug, aid],
    queryFn: () => getAssessmentResults(slug, aid!),
    enabled: !!slug && !!aid,
  });

  const inviteMutation = useMutation({
    mutationFn: (candidates: { email: string; name?: string }[]) =>
      inviteCandidates(slug, aid!, { candidates }),
    onSuccess: (result) => {
      toast.success(`${result.invited} candidate(s) invited`);
      setShowInvite(false);
      queryClient.invalidateQueries({ queryKey: ['assessment-results', slug, aid] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Invite failed'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: 'ACTIVE' | 'CLOSED') =>
      updateAssessmentStatus(slug, aid!, status),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['assessment-results', slug, aid] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Update failed'),
  });

  const handleExport = async () => {
    try {
      const csv = await exportAssessmentCsv(slug, aid!);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assessment-${aid}-results.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground font-mono text-sm">Assessment not found</p>
      </div>
    );
  }

  const { assessment, funnel, candidates } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/org/${slug}/assessments`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-mono font-bold flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary" />
              {assessment.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`text-[10px] ${statusColors[assessment.status]}`}>
                {assessment.status}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                {assessment.questionCount} questions · {assessment.timeLimit} min
                {assessment.passingScore != null && ` · ${assessment.passingScore}% to pass`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {assessment.status === 'DRAFT' && (
            <Button size="sm" variant="outline" onClick={() => statusMutation.mutate('ACTIVE')}>
              <Play className="h-4 w-4 mr-1.5" /> Activate
            </Button>
          )}
          {assessment.status === 'ACTIVE' && (
            <>
              <Button size="sm" className="glow-cyan" onClick={() => setShowInvite(true)}>
                <UserPlus className="h-4 w-4 mr-1.5" /> Invite
              </Button>
              <Button size="sm" variant="outline" onClick={() => statusMutation.mutate('CLOSED')}>
                <Pause className="h-4 w-4 mr-1.5" /> Close
              </Button>
            </>
          )}
          {candidates.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
          )}
        </div>
      </div>

      {/* Funnel Stats */}
      <AssessmentFunnel funnel={funnel} />

      {/* Candidate Rankings */}
      {candidates.length > 0 ? (
        <CandidateRanking
          candidates={candidates}
          passingScore={assessment.passingScore}
        />
      ) : (
        <div className="text-center py-12">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-mono text-sm">No candidates yet</p>
          {assessment.status === 'ACTIVE' && (
            <Button className="mt-4 glow-cyan" onClick={() => setShowInvite(true)}>
              <UserPlus className="h-4 w-4 mr-1.5" /> Invite Candidates
            </Button>
          )}
        </div>
      )}

      {/* Invite Modal */}
      <InviteCandidatesModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onInvite={(candidates) => inviteMutation.mutate(candidates)}
        isPending={inviteMutation.isPending}
      />
    </div>
  );
};

export default AssessmentResults;
