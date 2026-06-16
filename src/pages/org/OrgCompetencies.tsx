import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrgStore } from "@/stores/org.store";
import {
  getCompetencies,
  createCompetency,
  updateCompetency,
  deleteCompetency,
} from "@/services/competency";
import type {
  Competency,
  CreateCompetencyPayload,
  UpdateCompetencyPayload,
} from "@/services/competency";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Award,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";

// ─── Form Modal ───────────────────────────────────────────────────────────────

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  initial?: Competency | null;
  onSave: (data: CreateCompetencyPayload | UpdateCompetencyPayload) => void;
  isPending: boolean;
}

const CompetencyFormModal = ({
  open,
  onClose,
  initial,
  onSave,
  isPending,
}: FormModalProps) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [scaleMin, setScaleMin] = useState(String(initial?.scaleMin ?? 1));
  const [scaleMax, setScaleMax] = useState(String(initial?.scaleMax ?? 5));

  const handleOpen = () => {
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setScaleMin(String(initial?.scaleMin ?? 1));
    setScaleMax(String(initial?.scaleMax ?? 5));
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      scaleMin: Number(scaleMin),
      scaleMax: Number(scaleMax),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
        else handleOpen();
      }}
    >
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            {initial ? "Edit Competency" : "New Competency"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Name *
            </label>
            <Input
              className="mt-1 font-mono text-sm bg-muted/30 border-border"
              placeholder="e.g. Problem Solving"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Description
            </label>
            <Textarea
              className="mt-1 font-mono text-xs bg-muted/30 border-border resize-none min-h-[72px]"
              placeholder="Optional competency description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                Scale Min
              </label>
              <Input
                type="number"
                min={1}
                className="mt-1 font-mono text-sm bg-muted/30 border-border"
                value={scaleMin}
                onChange={(e) => setScaleMin(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                Scale Max
              </label>
              <Input
                type="number"
                max={10}
                className="mt-1 font-mono text-sm bg-muted/30 border-border"
                value={scaleMax}
                onChange={(e) => setScaleMax(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="glow-cyan"
            onClick={handleSubmit}
            disabled={isPending || !name.trim()}
          >
            {isPending ? "Saving…" : initial ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const OrgCompetencies = () => {
  const queryClient = useQueryClient();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const orgId = currentOrg?.id || "";

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Competency | null>(null);

  const { data: competencies = [], isLoading } = useQuery({
    queryKey: ["competencies", orgId],
    queryFn: () => getCompetencies(orgId),
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCompetencyPayload) =>
      createCompetency(orgId, data),
    onSuccess: () => {
      toast.success("Competency created");
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["competencies", orgId] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Create failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCompetencyPayload }) =>
      updateCompetency(orgId, id, data),
    onSuccess: () => {
      toast.success("Updated");
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ["competencies", orgId] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCompetency(orgId, id),
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["competencies", orgId] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Delete failed"),
  });

  const toggleActive = (c: Competency) => {
    updateMutation.mutate({ id: c.id, data: { isActive: !c.isActive } });
  };

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
            <Award className="h-6 w-6 text-primary" />
            Competencies
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define the competency framework for your organisation
          </p>
        </div>
        <Button className="glow-cyan" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Competency
        </Button>
      </div>

      {competencies.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Award className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground font-mono text-sm">
            No competencies yet
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Create first competency
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {competencies.map((c) => (
            <Card
              key={c.id}
              className={`bg-card border-border transition-opacity ${c.isActive ? "" : "opacity-50"}`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-mono font-semibold text-sm truncate">
                      {c.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Sliders className="h-3 w-3 shrink-0" />
                      Scale {c.scaleMin}–{c.scaleMax}
                    </p>
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
                      <DropdownMenuItem onClick={() => setEditTarget(c)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActive(c)}>
                        {c.isActive ? (
                          <>
                            <ToggleLeft className="h-3.5 w-3.5 mr-2" />{" "}
                            Deactivate
                          </>
                        ) : (
                          <>
                            <ToggleRight className="h-3.5 w-3.5 mr-2" />{" "}
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-400 focus:text-red-400"
                        onClick={() => {
                          if (
                            confirm(
                              `Delete "${c.name}"? This cannot be undone.`,
                            )
                          ) {
                            deleteMutation.mutate(c.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {c.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {c.description}
                  </p>
                )}

                <Badge
                  className={
                    c.isActive
                      ? "bg-emerald-500/15 text-emerald-400 text-[10px]"
                      : "bg-zinc-500/15 text-zinc-400 text-[10px]"
                  }
                >
                  {c.isActive ? "Active" : "Inactive"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CompetencyFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={(data) =>
          createMutation.mutate(data as CreateCompetencyPayload)
        }
        isPending={createMutation.isPending}
      />

      <CompetencyFormModal
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

export default OrgCompetencies;
