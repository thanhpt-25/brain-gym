import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrgStore } from "@/stores/org.store";
import {
  getCampaigns,
  createCampaign,
  activateCampaign,
  deleteCampaign,
  type Campaign,
  type CreateCampaignPayload,
} from "@/services/campaigns";
import { issueCertificationsByCampaign } from "@/services/competency-cert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Megaphone,
  Plus,
  MoreVertical,
  Trash2,
  Play,
  CalendarClock,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-zinc-500/15 text-zinc-400",
  ACTIVE: "bg-emerald-500/15 text-emerald-400",
  CLOSED: "bg-rose-500/15 text-rose-400",
};

// ─── Create Modal ─────────────────────────────────────────────────────────────

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateCampaignPayload) => void;
  isPending: boolean;
  catalogItems: { id: string; title: string }[];
}

const CreateCampaignModal = ({
  open,
  onClose,
  onSave,
  isPending,
  catalogItems,
}: CreateModalProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<
    "MONTHLY_3" | "MONTHLY_6" | "MONTHLY_12"
  >("MONTHLY_3");

  const reset = () => {
    setName("");
    setDescription("");
    setCatalogItemId("");
    setDueDate("");
    setRecurrenceEnabled(false);
    setRecurrenceInterval("MONTHLY_3");
  };

  const handleSave = () => {
    if (!name.trim() || !catalogItemId) return;
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      catalogItemId,
      dueDate: dueDate || undefined,
      recurrenceEnabled,
      recurrenceInterval: recurrenceEnabled ? recurrenceInterval : undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            New Campaign
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Name *
            </label>
            <Input
              className="mt-1 font-mono text-sm bg-muted/30 border-border"
              placeholder="e.g. Q3 Onboarding Assessment"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Catalog Item *
            </label>
            <Select value={catalogItemId} onValueChange={setCatalogItemId}>
              <SelectTrigger className="mt-1 font-mono text-sm bg-muted/30 border-border">
                <SelectValue placeholder="Select catalog item…" />
              </SelectTrigger>
              <SelectContent>
                {catalogItems.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={c.id}
                    className="font-mono text-xs"
                  >
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Description
            </label>
            <Textarea
              className="mt-1 font-mono text-xs bg-muted/30 border-border resize-none min-h-[60px]"
              placeholder="Optional…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Due Date
            </label>
            <Input
              type="date"
              className="mt-1 font-mono text-sm bg-muted/30 border-border"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="recurrence"
              checked={recurrenceEnabled}
              onChange={(e) => setRecurrenceEnabled(e.target.checked)}
              className="accent-primary"
            />
            <label
              htmlFor="recurrence"
              className="text-xs font-mono text-muted-foreground cursor-pointer"
            >
              Enable recurrence
            </label>
          </div>

          {recurrenceEnabled && (
            <div>
              <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                Interval
              </label>
              <Select
                value={recurrenceInterval}
                onValueChange={(v) =>
                  setRecurrenceInterval(v as typeof recurrenceInterval)
                }
              >
                <SelectTrigger className="mt-1 font-mono text-sm bg-muted/30 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY_3">Every 3 months</SelectItem>
                  <SelectItem value="MONTHLY_6">Every 6 months</SelectItem>
                  <SelectItem value="MONTHLY_12">Every 12 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="glow-cyan"
            onClick={handleSave}
            disabled={isPending || !name.trim() || !catalogItemId}
          >
            {isPending ? "Creating…" : "Create campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Campaign Card ────────────────────────────────────────────────────────────

interface CampaignCardProps {
  campaign: Campaign;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  onIssueCerts: (id: string) => void;
  activating: boolean;
  issuingCerts: boolean;
}

const CampaignCard = ({
  campaign,
  onActivate,
  onDelete,
  onIssueCerts,
  activating,
  issuingCerts,
}: CampaignCardProps) => (
  <Card className="bg-card border-border">
    <CardContent className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-mono font-semibold text-sm truncate">
            {campaign.name}
          </h3>
          {campaign.catalogItem && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {campaign.catalogItem.title}
            </p>
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
          <DropdownMenuContent align="end" className="text-xs font-mono w-44">
            {campaign.status === "DRAFT" && (
              <DropdownMenuItem
                onClick={() => onActivate(campaign.id)}
                disabled={activating}
              >
                <Play className="h-3.5 w-3.5 mr-2 text-emerald-400" /> Activate
              </DropdownMenuItem>
            )}
            {campaign.status === "CLOSED" && (
              <DropdownMenuItem
                onClick={() => onIssueCerts(campaign.id)}
                disabled={issuingCerts}
              >
                <ShieldCheck className="h-3.5 w-3.5 mr-2 text-violet-400" />
                {issuingCerts ? "Đang cấp..." : "Cấp chứng nhận"}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-400 focus:text-red-400"
              disabled={campaign.status !== "DRAFT"}
              onClick={() => {
                if (confirm(`Delete "${campaign.name}"?`))
                  onDelete(campaign.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={`text-[10px] ${STATUS_BADGE[campaign.status] ?? ""}`}>
          {campaign.status}
        </Badge>
        {campaign.recurrenceEnabled && (
          <Badge className="text-[10px] bg-violet-500/15 text-violet-400">
            <RefreshCw className="h-2.5 w-2.5 mr-1" />
            Recurring
          </Badge>
        )}
        {campaign.dueDate && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
            <CalendarClock className="h-3 w-3" />
            Due {new Date(campaign.dueDate).toLocaleDateString()}
            {campaign.daysRemaining != null && campaign.daysRemaining >= 0 && (
              <span className="text-amber-400">
                ({campaign.daysRemaining}d left)
              </span>
            )}
          </span>
        )}
      </div>

      {campaign.status === "ACTIVE" && campaign.progress && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>Progress</span>
            <span>
              {campaign.progress.completed}/{campaign.progress.total} (
              {campaign.progress.pct}%)
            </span>
          </div>
          <Progress value={campaign.progress.pct} className="h-1.5" />
        </div>
      )}
    </CardContent>
  </Card>
);

// ─── Main page ────────────────────────────────────────────────────────────────

const OrgCampaigns = () => {
  const queryClient = useQueryClient();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || "";

  const [showCreate, setShowCreate] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns", slug],
    queryFn: () => getCampaigns(slug),
    enabled: !!slug,
  });

  // TODO: replace with real catalog items query
  const catalogItems: { id: string; title: string }[] = [];

  const createMutation = useMutation({
    mutationFn: (data: CreateCampaignPayload) => createCampaign(slug, data),
    onSuccess: () => {
      toast.success("Campaign created");
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["campaigns", slug] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Create failed"),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => activateCampaign(slug, id),
    onSuccess: () => {
      toast.success("Campaign activated");
      queryClient.invalidateQueries({ queryKey: ["campaigns", slug] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Activate failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCampaign(slug, id),
    onSuccess: () => {
      toast.success("Campaign deleted");
      queryClient.invalidateQueries({ queryKey: ["campaigns", slug] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Delete failed"),
  });

  const issueCertsMutation = useMutation({
    mutationFn: (campaignId: string) =>
      issueCertificationsByCampaign(org!.id, campaignId),
    onSuccess: (result) => {
      toast.success(
        `Đã cấp ${result.issued} chứng nhận mới, nâng cấp ${result.upgraded}`,
      );
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Issue certs failed"),
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
            <Megaphone className="h-6 w-6 text-primary" />
            Campaigns
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage periodic assessment campaigns for your team
          </p>
        </div>
        <Button className="glow-cyan" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Megaphone className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground font-mono text-sm">
            No campaigns yet
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Create first campaign
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onActivate={(id) => activateMutation.mutate(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
              onIssueCerts={(id) => issueCertsMutation.mutate(id)}
              activating={activateMutation.isPending}
              issuingCerts={issueCertsMutation.isPending}
            />
          ))}
        </div>
      )}

      <CreateCampaignModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
        catalogItems={catalogItems}
      />
    </div>
  );
};

export default OrgCampaigns;
