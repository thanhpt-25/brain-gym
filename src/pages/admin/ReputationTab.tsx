import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, AlertCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/services/api";

export interface ReputationFlag {
  id: string;
  flaggedUserId: string;
  voterId: string;
  explanationId: string;
  squadId: string;
  reason: string;
  pointsHeld: number;
  status: "pending" | "cleared" | "confirmed";
  createdAt: string;
  resolvedAt: string | null;
}

interface ResolveRequest {
  flagId: string;
  resolution: "cleared" | "confirmed";
}

async function listFlags(
  squadId: string,
  status?: string,
): Promise<ReputationFlag[]> {
  const res = await api.get<ReputationFlag[]>(
    `/squads/peer-review/${squadId}/flags`,
    {
      params: { status },
    },
  );
  return res.data;
}

async function resolveFlag(
  flagId: string,
  resolution: "cleared" | "confirmed",
): Promise<ReputationFlag> {
  const res = await api.patch<ReputationFlag>(
    `/squads/peer-review/flags/${flagId}/resolve`,
    { resolution },
  );
  return res.data;
}

export function ReputationTab() {
  const qc = useQueryClient();
  const [squadId, setSquadId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [resolveDialog, setResolveDialog] = useState<ResolveRequest | null>(
    null,
  );

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["reputation-flags", squadId, filterStatus],
    queryFn: () =>
      squadId ? listFlags(squadId, filterStatus) : Promise.resolve([]),
    enabled: !!squadId,
  });

  const resolveMutation = useMutation({
    mutationFn: (req: ResolveRequest) =>
      resolveFlag(req.flagId, req.resolution),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["reputation-flags", squadId, filterStatus],
      });
      setResolveDialog(null);
      toast.success("Flag resolved");
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || "Failed to resolve flag"),
  });

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case "velocity_burst":
        return "Velocity Burst";
      case "vote_ring":
        return "Vote Ring";
      default:
        return reason;
    }
  };

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case "velocity_burst":
        return "text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-200";
      case "vote_ring":
        return "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-200";
      default:
        return "text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-200";
      case "cleared":
        return "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-200";
      case "confirmed":
        return "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-200";
      default:
        return "text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const pendingCount = flags.filter((f) => f.status === "pending").length;
  const confirmedCount = flags.filter((f) => f.status === "confirmed").length;
  const clearedCount = flags.filter((f) => f.status === "cleared").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Shield className="h-4 w-4 text-amber-600" />
        <span className="text-sm text-muted-foreground font-mono">
          Reputation anomaly detection: vote-velocity bursts & vote-ring
          patterns
        </span>
      </div>

      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="text-xs font-mono font-bold text-muted-foreground block mb-2">
            Select Squad
          </label>
          <input
            type="text"
            placeholder="Enter squad ID"
            value={squadId}
            onChange={(e) => setSquadId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background font-mono"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48 font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cleared">Cleared</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-4 rounded-lg border border-border">
          <div className="text-xs font-mono text-muted-foreground mb-1">
            Pending
          </div>
          <div className="text-2xl font-bold font-mono">{pendingCount}</div>
        </div>
        <div className="glass-card p-4 rounded-lg border border-border">
          <div className="text-xs font-mono text-muted-foreground mb-1">
            Confirmed
          </div>
          <div className="text-2xl font-bold font-mono text-red-600">
            {confirmedCount}
          </div>
        </div>
        <div className="glass-card p-4 rounded-lg border border-border">
          <div className="text-xs font-mono text-muted-foreground mb-1">
            Cleared
          </div>
          <div className="text-2xl font-bold font-mono text-green-600">
            {clearedCount}
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {!squadId ? (
          <div className="p-8 text-center text-muted-foreground font-mono text-xs">
            Enter a squad ID to view reputation flags
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-mono text-xs">
            Loading flags...
          </div>
        ) : flags.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-mono text-xs">
            No {filterStatus ? `${filterStatus} ` : ""}flags found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-xs">Reason</TableHead>
                <TableHead className="font-mono text-xs">Voter ID</TableHead>
                <TableHead className="font-mono text-xs">
                  Flagged User
                </TableHead>
                <TableHead className="font-mono text-xs">Points Held</TableHead>
                <TableHead className="font-mono text-xs">Status</TableHead>
                <TableHead className="font-mono text-xs">Created</TableHead>
                <TableHead className="font-mono text-xs w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs font-mono font-bold ${getReasonColor(
                        flag.reason,
                      )}`}
                    >
                      {getReasonLabel(flag.reason)}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {flag.voterId.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {flag.flaggedUserId.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold">
                    {flag.pointsHeld}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs font-mono font-bold ${getStatusColor(
                        flag.status,
                      )}`}
                    >
                      {flag.status}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(flag.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {flag.status === "pending" && (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                          title="Mark as cleared (vote was legitimate)"
                          onClick={() =>
                            setResolveDialog({
                              flagId: flag.id,
                              resolution: "cleared",
                            })
                          }
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          title="Mark as confirmed (vote was suspicious)"
                          onClick={() =>
                            setResolveDialog({
                              flagId: flag.id,
                              resolution: "confirmed",
                            })
                          }
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Resolve Confirmation Dialog */}
      <Dialog
        open={!!resolveDialog}
        onOpenChange={(o) => !o && setResolveDialog(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Resolve Reputation Flag
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              Confirm the resolution status for this flag
            </DialogDescription>
          </DialogHeader>

          {resolveDialog && (
            <div className="space-y-3 py-4">
              <div className="p-3 bg-muted rounded text-xs font-mono">
                <div className="mb-2">
                  <span className="text-muted-foreground">Status: </span>
                  <span className="font-bold">
                    {resolveDialog.resolution === "cleared"
                      ? "✓ Cleared (vote was legitimate)"
                      : "✗ Confirmed (vote was suspicious)"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setResolveDialog(null)}
              className="font-mono text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                resolveDialog && resolveMutation.mutate(resolveDialog)
              }
              disabled={resolveMutation.isPending}
              className={`font-mono text-xs ${
                resolveDialog?.resolution === "cleared"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {resolveMutation.isPending ? "Resolving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
