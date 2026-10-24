import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrgStore } from "@/stores/org.store";
import {
  getAssessmentResults,
  inviteCandidates,
  updateAssessmentStatus,
  exportAssessmentCsv,
  updateBlindReview,
} from "@/services/assessments";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  ClipboardList,
  UserPlus,
  Download,
  Play,
  Pause,
  Users,
  Upload,
  Briefcase,
  Database,
  EyeOff,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import InviteCandidatesModal from "@/components/org/InviteCandidatesModal";
import CsvImportModal from "@/components/org/CsvImportModal";
import CandidateRanking from "@/components/org/CandidateRanking";
import AssessmentFunnel from "@/components/org/AssessmentFunnel";

const statusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-emerald-500/15 text-emerald-400",
  CLOSED: "bg-amber-500/15 text-amber-400",
  ARCHIVED: "bg-zinc-500/15 text-zinc-400",
};

const AssessmentResults = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { aid } = useParams();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || "";
  const [showInvite, setShowInvite] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["assessment-results", slug, aid],
    queryFn: () => getAssessmentResults(slug, aid!),
    enabled: !!slug && !!aid,
  });

  const inviteMutation = useMutation({
    mutationFn: (candidates: { email: string; name?: string }[]) =>
      inviteCandidates(slug, aid!, { candidates }),
    onSuccess: (result) => {
      toast.success(`${result.invited} candidate(s) invited`);
      setShowInvite(false);
      setShowCsvImport(false);
      queryClient.invalidateQueries({
        queryKey: ["assessment-results", slug, aid],
      });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Invite failed"),
  });

  const reinviteMutation = useMutation({
    mutationFn: (email: string) =>
      inviteCandidates(slug, aid!, { candidates: [{ email }] }),
    onSuccess: () => {
      toast.success("Invite re-sent");
      queryClient.invalidateQueries({
        queryKey: ["assessment-results", slug, aid],
      });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Re-invite failed"),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "ACTIVE" | "CLOSED") =>
      updateAssessmentStatus(slug, aid!, status),
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({
        queryKey: ["assessment-results", slug, aid],
      });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Update failed"),
  });

  const blindReviewMutation = useMutation({
    mutationFn: (enabled: boolean) => updateBlindReview(slug, aid!, enabled),
    onSuccess: (res) => {
      toast.success(
        res.blindReviewEnabled
          ? "Blind review enabled"
          : "Blind review disabled",
      );
      queryClient.invalidateQueries({
        queryKey: ["assessment-results", slug, aid],
      });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Update failed"),
  });

  const handleExport = async () => {
    try {
      const csv = await exportAssessmentCsv(slug, aid!);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `assessment-${aid}-results.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
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
        <p className="text-muted-foreground font-mono text-sm">
          Assessment not found
        </p>
      </div>
    );
  }

  const { assessment, funnel, candidates } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/org/${slug}/assessments`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-mono font-bold flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary" />
              {assessment.title}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge
                className={`text-[10px] ${statusColors[assessment.status]}`}
              >
                {assessment.status}
              </Badge>
              {assessment.jobRole && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                  <Briefcase className="h-3 w-3" />
                  {assessment.jobRole.title}
                  {assessment.jobRole.department &&
                    ` · ${assessment.jobRole.department}`}
                </span>
              )}
              <span className="text-xs text-muted-foreground font-mono">
                {assessment.questionCount} questions · {assessment.timeLimit}{" "}
                min
                {assessment.passingScore != null &&
                  ` · ${assessment.passingScore}% to pass`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {assessment.status === "DRAFT" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => statusMutation.mutate("ACTIVE")}
              disabled={statusMutation.isPending}
            >
              <Play className="h-4 w-4 mr-1.5" /> Activate
            </Button>
          )}
          {assessment.status === "ACTIVE" && (
            <>
              <Button
                size="sm"
                className="glow-cyan"
                onClick={() => setShowInvite(true)}
              >
                <UserPlus className="h-4 w-4 mr-1.5" /> Invite
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCsvImport(true)}
              >
                <Upload className="h-4 w-4 mr-1.5" /> Import CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => statusMutation.mutate("CLOSED")}
                disabled={statusMutation.isPending}
              >
                <Pause className="h-4 w-4 mr-1.5" /> Close
              </Button>
            </>
          )}
          {candidates.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              navigate(`/org/${slug}/assessments/${aid}/pool-stats`)
            }
          >
            <Database className="h-4 w-4 mr-1.5" /> Pool Stats
          </Button>
          <Button
            size="sm"
            variant={assessment.blindReviewEnabled ? "default" : "outline"}
            onClick={() =>
              blindReviewMutation.mutate(!assessment.blindReviewEnabled)
            }
            disabled={blindReviewMutation.isPending}
            title={
              assessment.blindReviewEnabled
                ? "Disable blind review"
                : "Enable blind review — masks candidate PII"
            }
          >
            {assessment.blindReviewEnabled ? (
              <>
                <EyeOff className="h-4 w-4 mr-1.5" /> Blind
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1.5" /> Blind Review
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Funnel */}
      <AssessmentFunnel funnel={funnel} />

      {/* Stage pipeline summary */}
      {candidates.length > 0 && <StageSummary candidates={candidates} />}

      {/* Candidate table */}
      {candidates.length > 0 ? (
        <CandidateRanking
          candidates={candidates}
          passingScore={assessment.passingScore}
          slug={slug}
          aid={aid!}
          onReinvite={
            assessment.status === "ACTIVE"
              ? (email) => reinviteMutation.mutate(email)
              : undefined
          }
          isReinviting={reinviteMutation.isPending}
        />
      ) : (
        <div className="text-center py-12">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-mono text-sm">
            No candidates yet
          </p>
          {assessment.status === "ACTIVE" && (
            <div className="flex justify-center gap-2 mt-4">
              <Button className="glow-cyan" onClick={() => setShowInvite(true)}>
                <UserPlus className="h-4 w-4 mr-1.5" /> Invite Candidates
              </Button>
              <Button variant="outline" onClick={() => setShowCsvImport(true)}>
                <Upload className="h-4 w-4 mr-1.5" /> Import CSV
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Invite modal */}
      <InviteCandidatesModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onInvite={(candidates) => inviteMutation.mutate(candidates)}
        isPending={inviteMutation.isPending}
      />

      {/* CSV import modal */}
      <CsvImportModal
        open={showCsvImport}
        onClose={() => setShowCsvImport(false)}
        onImport={(candidates) => inviteMutation.mutate(candidates)}
        isPending={inviteMutation.isPending}
      />
    </div>
  );
};

// ─── Stage summary bar ────────────────────────────────────────────────────────

import type { CandidateInvite, CandidateStage } from "@/types/assessment-types";

const STAGES: { stage: CandidateStage; label: string; color: string }[] = [
  { stage: "APPLIED", label: "Applied", color: "bg-blue-500/20 text-blue-400" },
  {
    stage: "SCREENING",
    label: "Screening",
    color: "bg-amber-500/20 text-amber-400",
  },
  {
    stage: "SHORTLISTED",
    label: "Shortlisted",
    color: "bg-violet-500/20 text-violet-400",
  },
  {
    stage: "INTERVIEW",
    label: "Interview",
    color: "bg-sky-500/20 text-sky-400",
  },
  {
    stage: "HIRED",
    label: "Hired",
    color: "bg-emerald-500/20 text-emerald-400",
  },
  { stage: "REJECTED", label: "Rejected", color: "bg-red-500/20 text-red-400" },
];

const StageSummary = ({ candidates }: { candidates: CandidateInvite[] }) => {
  const counts = candidates.reduce<Record<string, number>>((acc, c) => {
    const stage = c.stage ?? "APPLIED";
    acc[stage] = (acc[stage] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex gap-2 flex-wrap">
      {STAGES.map(({ stage, label, color }) => {
        const count = counts[stage] ?? 0;
        if (count === 0) return null;
        return (
          <span
            key={stage}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-mono ${color}`}
          >
            {label}
            <span className="font-bold">{count}</span>
          </span>
        );
      })}
    </div>
  );
};

export default AssessmentResults;
