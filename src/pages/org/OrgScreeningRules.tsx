import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrgStore } from "@/stores/org.store";
import {
  getScreeningRules,
  createScreeningRule,
  updateScreeningRule,
  deleteScreeningRule,
  type ScreeningRule,
} from "@/services/screening";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";

// ─── Rule Form Modal ──────────────────────────────────────────────────────────

interface RuleFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (
    data: Omit<ScreeningRule, "id" | "assessmentId" | "createdAt">,
  ) => void;
  isPending: boolean;
  initial?: ScreeningRule | null;
}

const RuleFormModal = ({
  open,
  onClose,
  onSave,
  isPending,
  initial,
}: RuleFormProps) => {
  const [action, setAction] = useState<"SHORTLIST" | "REJECT">(
    initial?.action ?? "SHORTLIST",
  );
  const [minScore, setMinScore] = useState(initial?.minScore?.toString() ?? "");
  const [maxScore, setMaxScore] = useState(initial?.maxScore?.toString() ?? "");
  const [minIntegrity, setMinIntegrity] = useState(
    initial?.minIntegrity?.toString() ?? "",
  );
  const [priority, setPriority] = useState(
    initial?.priority?.toString() ?? "0",
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const handleSave = () => {
    const payload: Omit<ScreeningRule, "id" | "assessmentId" | "createdAt"> = {
      action,
      priority: Number(priority) || 0,
      isActive,
      minScore: minScore !== "" ? Number(minScore) : undefined,
      maxScore: maxScore !== "" ? Number(maxScore) : undefined,
      minIntegrity: minIntegrity !== "" ? Number(minIntegrity) : undefined,
    };
    onSave(payload);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {initial ? "Edit Rule" : "New Screening Rule"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Action *
            </label>
            <Select
              value={action}
              onValueChange={(v) => setAction(v as typeof action)}
            >
              <SelectTrigger className="mt-1 font-mono text-sm bg-muted/30 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SHORTLIST">Shortlist candidate</SelectItem>
                <SelectItem value="REJECT">Reject candidate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                Min score %
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                className="mt-1 font-mono text-sm bg-muted/30 border-border"
                placeholder="e.g. 70"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                Max score %
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                className="mt-1 font-mono text-sm bg-muted/30 border-border"
                placeholder="e.g. 100"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                Min integrity %
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                className="mt-1 font-mono text-sm bg-muted/30 border-border"
                placeholder="e.g. 80"
                value={minIntegrity}
                onChange={(e) => setMinIntegrity(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                Priority
              </label>
              <Input
                type="number"
                min={0}
                className="mt-1 font-mono text-sm bg-muted/30 border-border"
                placeholder="0 = lowest"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-xs font-mono text-muted-foreground">
              Rule is active
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="glow-cyan"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? "Saving…" : initial ? "Save changes" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const OrgScreeningRules = () => {
  const queryClient = useQueryClient();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || "";
  const { assessmentId = "" } = useParams<{ assessmentId: string }>();

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ScreeningRule | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["screening-rules", slug, assessmentId],
    queryFn: () => getScreeningRules(slug, assessmentId),
    enabled: !!slug && !!assessmentId,
  });

  const createMutation = useMutation({
    mutationFn: (
      data: Omit<ScreeningRule, "id" | "assessmentId" | "createdAt">,
    ) => createScreeningRule(slug, assessmentId, data),
    onSuccess: () => {
      toast.success("Rule created");
      setShowCreate(false);
      queryClient.invalidateQueries({
        queryKey: ["screening-rules", slug, assessmentId],
      });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Create failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Omit<ScreeningRule, "id" | "assessmentId" | "createdAt">>;
    }) => updateScreeningRule(slug, assessmentId, id, data),
    onSuccess: () => {
      toast.success("Rule updated");
      setEditTarget(null);
      queryClient.invalidateQueries({
        queryKey: ["screening-rules", slug, assessmentId],
      });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteScreeningRule(slug, assessmentId, id),
    onSuccess: () => {
      toast.success("Rule deleted");
      queryClient.invalidateQueries({
        queryKey: ["screening-rules", slug, assessmentId],
      });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Delete failed"),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Screening Rules
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rules are evaluated in priority order (highest first) after
            submission
          </p>
        </div>
        <Button className="glow-cyan" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground font-mono text-sm">
            No screening rules yet
          </p>
          <p className="text-xs text-muted-foreground">
            Candidates are not auto-screened until at least one rule is added.
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add first rule
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <Card
              key={rule.id}
              className={`bg-card border-border transition-opacity ${rule.isActive ? "" : "opacity-50"}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono shrink-0">
                      <ArrowUpDown className="h-3 w-3" />P{rule.priority}
                    </span>

                    <Badge
                      className={`text-[10px] shrink-0 ${
                        rule.action === "SHORTLIST"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-rose-500/15 text-rose-400"
                      }`}
                    >
                      {rule.action}
                    </Badge>

                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground font-mono">
                      {rule.minScore != null && (
                        <span>score ≥ {rule.minScore}%</span>
                      )}
                      {rule.maxScore != null && (
                        <span>score ≤ {rule.maxScore}%</span>
                      )}
                      {rule.minIntegrity != null && (
                        <span>integrity ≥ {rule.minIntegrity}%</span>
                      )}
                    </div>

                    {!rule.isActive && (
                      <Badge className="text-[10px] bg-zinc-500/15 text-zinc-400">
                        Inactive
                      </Badge>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="text-xs font-mono w-40"
                    >
                      <DropdownMenuItem onClick={() => setEditTarget(rule)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-400 focus:text-red-400"
                        onClick={() => {
                          if (confirm("Delete this rule?"))
                            deleteMutation.mutate(rule.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RuleFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />

      <RuleFormModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        initial={editTarget}
        onSave={(data) =>
          editTarget && updateMutation.mutate({ id: editTarget.id, data })
        }
        isPending={updateMutation.isPending}
      />
    </div>
  );
};

export default OrgScreeningRules;
