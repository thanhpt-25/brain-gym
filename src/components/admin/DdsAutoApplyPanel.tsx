import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Zap,
  RotateCcw,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Shield,
  X,
} from "lucide-react";
import api from "../../services/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface AutoApplyDecision {
  shouldApply: boolean;
  reason: string;
  cohort: string;
  approvedCount: number;
  threshold: number;
}

interface QuestionVariant {
  id: string;
  questionId: string;
  reason: string;
  status: string;
  createdAt: string;
}

interface AutoApplyReadiness {
  cleanApprovals: number;
  threshold: number;
  rollbackCount: number;
  lastRollbackAt: string | null;
  readyToPromote: boolean;
  progressPercent: number;
}

interface CohortConfig {
  cohortName: string;
  shadowModeEnabled: boolean;
  canaryArmed: boolean;
  promotedAt: string | null;
  canaryPausedAt: string | null;
}

async function fetchAutoApplied(): Promise<QuestionVariant[]> {
  const res = await api.get<QuestionVariant[]>(
    "/ai-question-bank/dds/pending",
    { params: { limit: 50 } },
  );
  return res.data.filter((v) => v.status === "AUTO_APPLIED");
}

async function fetchAutoApplyReadiness(): Promise<AutoApplyReadiness> {
  const res = await api.get<AutoApplyReadiness>(
    "/ai-question-bank/dds/auto-apply/readiness",
  );
  return res.data;
}

async function fetchCohortConfig(): Promise<CohortConfig | null> {
  const res = await api.get<CohortConfig>(
    "/ai-question-bank/dds/auto-apply/cohort-config",
  );
  return res.data;
}

async function promoteCohortToLive() {
  return api.post("/ai-question-bank/dds/auto-apply/promote");
}

async function evaluateVariant(variantId: string): Promise<AutoApplyDecision> {
  const res = await api.get<AutoApplyDecision>(
    `/ai-question-bank/dds/variants/${variantId}/auto-apply/evaluate`,
  );
  return res.data;
}

async function triggerAutoApply(variantId: string) {
  return api.post(`/ai-question-bank/dds/variants/${variantId}/auto-apply`);
}

async function rollbackVariant(variantId: string) {
  return api.patch(`/ai-question-bank/dds/variants/${variantId}/rollback`);
}

export function DdsAutoApplyPanel() {
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [decision, setDecision] = useState<AutoApplyDecision | null>(null);
  const qc = useQueryClient();

  const { data: variants, isLoading } = useQuery({
    queryKey: ["dds-auto-applied"],
    queryFn: fetchAutoApplied,
    staleTime: 30_000,
  });

  const { data: readiness, isLoading: readinessLoading } = useQuery({
    queryKey: ["dds-auto-apply-readiness"],
    queryFn: fetchAutoApplyReadiness,
    staleTime: 60_000,
  });

  const { data: cohortConfig, isLoading: cohortLoading } = useQuery({
    queryKey: ["dds-cohort-config"],
    queryFn: fetchCohortConfig,
    staleTime: 30_000,
  });

  const evaluate = useMutation({
    mutationFn: (variantId: string) => {
      setEvaluatingId(variantId);
      return evaluateVariant(variantId);
    },
    onSuccess: (data) => setDecision(data),
    onSettled: () => setEvaluatingId(null),
  });

  const apply = useMutation({
    mutationFn: (variantId: string) => triggerAutoApply(variantId),
    onSuccess: () => {
      setDecision(null);
      qc.invalidateQueries({ queryKey: ["dds-auto-applied"] });
      qc.invalidateQueries({ queryKey: ["dds-auto-apply-readiness"] });
    },
  });

  const rollback = useMutation({
    mutationFn: (variantId: string) => rollbackVariant(variantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dds-auto-applied"] });
      qc.invalidateQueries({ queryKey: ["dds-auto-apply-readiness"] });
    },
  });

  const promote = useMutation({
    mutationFn: promoteCohortToLive,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dds-auto-apply-readiness"] });
      qc.invalidateQueries({ queryKey: ["dds-auto-applied"] });
    },
  });

  const shadowMode = import.meta.env.VITE_DDS_SHADOW_MODE !== "false";

  return (
    <div className="space-y-6" aria-label="DDS auto-apply management">
      {/* ── Page header ── */}
      <div className="glass-card glow-cyan relative overflow-hidden p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-40 bg-grid"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(190 95% 50% / 0.25), transparent 70%)" }}
          aria-hidden="true"
        />
        <div className="relative flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Auto-Apply Control
            </div>
            <h3 className="flex items-center gap-3 font-mono-display text-2xl font-semibold">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <Zap className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-gradient-cyan">DDS Auto-Apply</span>
            </h3>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
              Variants meeting the cohort approval threshold are auto-applied.
              In shadow mode, decisions are logged but not committed.
            </p>
          </div>
          {shadowMode && (
            <Badge
              variant="outline"
              className="shrink-0 gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-500 font-mono text-[10px] uppercase tracking-wider px-2.5 py-1"
              aria-label="Shadow mode active"
            >
              <ShieldAlert className="h-3 w-3" aria-hidden="true" />
              Shadow Mode
            </Badge>
          )}
        </div>
      </div>

      {/* ── Decision result (appears after Evaluate) ── */}
      {decision && evaluatingId && (
        <Alert
          className={
            decision.shouldApply
              ? "border-emerald-500/30 bg-emerald-500/10 [&>svg]:text-emerald-600"
              : "border-destructive/30 bg-destructive/10 [&>svg]:text-destructive"
          }
          role="status"
        >
          {decision.shouldApply ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-semibold text-sm leading-none">
                {decision.shouldApply ? "Ready to apply" : "Not ready"}
              </p>
              <AlertDescription className="text-muted-foreground">
                {decision.reason}
              </AlertDescription>
              <p className="text-xs text-muted-foreground">
                {decision.approvedCount}/{decision.threshold} approvals (cohort:{" "}
                {decision.cohort})
              </p>
              {decision.shouldApply && (
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => apply.mutate(evaluatingId)}
                  disabled={apply.isPending}
                  aria-label="Confirm auto-apply"
                >
                  {apply.isPending ? (
                    <Loader2
                      className="h-3 w-3 mr-1.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <CheckCircle2
                      className="h-3 w-3 mr-1.5"
                      aria-hidden="true"
                    />
                  )}
                  {shadowMode ? "Simulate apply" : "Apply now"}
                </Button>
              )}
            </div>
            <button
              className="rounded-sm opacity-60 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setDecision(null)}
              aria-label="Dismiss evaluation result"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Alert>
      )}

      {/* ── Gate 2 + Canary side-by-side grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gate 2 Readiness */}
        <Card role="status" className="glass-card border-border/60 hover:border-primary/40 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.16em] text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
                Gate 2 · Readiness
              </h4>
              {readiness?.readyToPromote && (
                <Badge
                  className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"
                  aria-label="Ready to promote"
                >
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Ready
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {readinessLoading ? (
              <div
                className="flex items-center gap-2 py-6 text-sm text-muted-foreground"
                aria-busy="true"
              >
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading Gate 2 readiness…
              </div>
            ) : readiness ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-3">
                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                      Clean Approvals
                    </p>
                    <p className="font-mono-display text-3xl font-bold tabular-nums leading-none text-gradient-cyan">
                      {readiness.cleanApprovals}
                      <span className="text-muted-foreground/60 text-xl">
                        /{readiness.threshold}
                      </span>
                    </p>
                    <div
                      className="h-1.5 w-full rounded-full bg-secondary/60 overflow-hidden"
                      role="none"
                    >
                      <div
                        className="dds-metric-fill h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-[width] duration-300"
                        role="progressbar"
                        aria-valuenow={readiness.cleanApprovals}
                        aria-valuemin={0}
                        aria-valuemax={readiness.threshold}
                        aria-label={`${readiness.cleanApprovals} of ${readiness.threshold} clean approvals`}
                        style={{ width: `${readiness.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-3">
                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                      Rollbacks
                    </p>
                    <p
                      className={cn(
                        "font-mono-display text-3xl font-bold tabular-nums leading-none",
                        readiness.rollbackCount > 0
                          ? "text-destructive"
                          : "text-gradient-cyan",
                      )}
                    >
                      {readiness.rollbackCount}
                    </p>
                    {readiness.rollbackCount > 0 &&
                      readiness.lastRollbackAt && (
                        <p className="text-xs text-muted-foreground">
                          Last:{" "}
                          {new Date(
                            readiness.lastRollbackAt,
                          ).toLocaleDateString()}
                        </p>
                      )}
                  </div>
                </div>

                {!readiness.readyToPromote && readiness.rollbackCount > 0 && (
                  <Alert
                    variant="destructive"
                    className="py-2 text-xs"
                    role="alert"
                  >
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <AlertDescription>
                      Cannot promote: recent rollbacks detected. Must reach zero
                      rollbacks.
                    </AlertDescription>
                  </Alert>
                )}

                {!readiness.readyToPromote &&
                  readiness.cleanApprovals < readiness.threshold && (
                    <Alert
                      className="py-2 text-xs border-amber-500/30 bg-amber-500/10 [&>svg]:text-amber-600"
                      role="alert"
                    >
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      <AlertDescription className="text-amber-700 dark:text-amber-400">
                        {readiness.threshold - readiness.cleanApprovals} more
                        clean approvals needed.
                      </AlertDescription>
                    </Alert>
                  )}

                <Separator />

                <Button
                  size="sm"
                  className="w-full font-mono uppercase tracking-wider text-xs hover:glow-cyan transition-shadow"
                  onClick={() => promote.mutate()}
                  disabled={!readiness.readyToPromote || promote.isPending}
                  aria-label="Promote DDS cohort to live mode"
                >
                  {promote.isPending ? (
                    <Loader2
                      className="h-3.5 w-3.5 mr-1.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Zap className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                  )}
                  {shadowMode ? "Simulate promote" : "Promote to live"}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Canary Status — .dds-canary-status class kept for tests */}
        {cohortConfig && !cohortLoading && (
          <Card
            className="dds-canary-status glass-card border-border/60 hover:border-sky-500/40 transition-colors"
            role="status"
          >
            <CardHeader className="pb-3">
              <h4 className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.16em] text-muted-foreground">
                <Shield className="h-4 w-4 text-sky-400" aria-hidden="true" />
                Canary · Status
              </h4>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                {cohortConfig.canaryArmed ? (
                  <span
                    className="dds-canary-armed inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold bg-emerald-500/15 text-emerald-600"
                    aria-label="Canary armed"
                  >
                    <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                    Armed
                  </span>
                ) : cohortConfig.promotedAt ? (
                  <span
                    className="dds-canary-paused inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold bg-amber-500/15 text-amber-600"
                    aria-label="Canary paused"
                  >
                    <Loader2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Paused
                  </span>
                ) : (
                  <span className="dds-canary-inactive inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold bg-secondary text-muted-foreground">
                    ○ Inactive
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {cohortConfig.promotedAt && (
                  <p className="text-xs text-muted-foreground">
                    Promoted:{" "}
                    {new Date(cohortConfig.promotedAt).toLocaleDateString()}
                  </p>
                )}
                {cohortConfig.canaryPausedAt && (
                  <p className="text-xs text-muted-foreground">
                    Paused:{" "}
                    {new Date(cohortConfig.canaryPausedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Auto-applied variants list ── */}
      <Card className="glass-card border-border/60">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <h4 className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.16em] text-muted-foreground">
              <Zap className="h-4 w-4 text-primary" aria-hidden="true" />
              Auto-Applied Variants
            </h4>
            {variants && variants.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-auto text-xs font-mono bg-primary/10 text-primary border border-primary/20"
              >
                {variants.length}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div
              className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
              aria-busy="true"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading auto-applied variants…
            </div>
          ) : !variants || variants.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No auto-applied variants yet.
            </p>
          ) : (
            <ul
              className="divide-y divide-border/60"
              aria-label="Auto-applied variants"
            >
              {variants.map((v) => (
                <li
                  key={v.id}
                  className="group flex items-center justify-between px-6 py-4 hover:bg-primary/5 transition-colors relative"
                >
                  <span
                    className="absolute left-0 top-0 h-full w-[2px] bg-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 space-y-1 pr-4">
                    <p className="text-sm font-medium truncate">{v.reason}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => evaluate.mutate(v.id)}
                      disabled={evaluate.isPending && evaluatingId === v.id}
                      aria-label="Evaluate auto-apply eligibility"
                    >
                      {evaluate.isPending && evaluatingId === v.id ? (
                        <Loader2
                          className="h-3 w-3 mr-1.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Zap className="h-3 w-3 mr-1.5" aria-hidden="true" />
                      )}
                      Evaluate
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rollback.mutate(v.id)}
                      disabled={rollback.isPending}
                      aria-label="Rollback this variant"
                    >
                      {rollback.isPending ? (
                        <Loader2
                          className="h-3 w-3 mr-1.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <RotateCcw
                          className="h-3 w-3 mr-1.5"
                          aria-hidden="true"
                        />
                      )}
                      Rollback
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
