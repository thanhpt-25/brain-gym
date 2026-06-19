import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, Plus, Trash2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { listMcpKeys, generateMcpKey, revokeMcpKey } from "@/services/mcp-keys";
import { McpApiKeyCreated } from "@/types/api-types";

export default function McpApiKeysTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showGenerate, setShowGenerate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<McpApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["mcp-keys"],
    queryFn: listMcpKeys,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateMcpKey(newKeyName.trim()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["mcp-keys"] });
      setCreatedKey(data);
      setNewKeyName("");
    },
    onError: () => {
      toast({ title: "Failed to generate key", variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeMcpKey,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mcp-keys"] });
      toast({ title: "API key revoked" });
    },
    onError: () => {
      toast({ title: "Failed to revoke key", variant: "destructive" });
    },
  });

  const handleCopy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey.plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseCreated = () => {
    setCreatedKey(null);
    setShowGenerate(false);
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString() : "Never";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">MCP API Keys</h3>
          <p className="text-sm text-muted-foreground">
            Use these keys to let Claude Desktop or any MCP-compatible tool push questions into your account.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowGenerate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Generate key
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : keys.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Key className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No API keys yet. Generate one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <Card key={key.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1">
                  <p className="font-medium text-sm">{key.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{key.prefix}…</p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDate(key.createdAt)} · Last used {formatDate(key.lastUsedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(key.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generate key dialog */}
      <Dialog
        open={showGenerate && !createdKey}
        onOpenChange={(o) => { if (!o) setShowGenerate(false); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate MCP API Key</DialogTitle>
            <DialogDescription>
              Give this key a name so you can identify it later (e.g. "My Claude Desktop").
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="key-name">Key name</Label>
            <Input
              id="key-name"
              placeholder="My Claude Desktop"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newKeyName.trim()) generateMutation.mutate();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newKeyName.trim() || generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show created key — displayed once, never again */}
      <Dialog open={!!createdKey} onOpenChange={(o) => { if (!o) handleCloseCreated(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription className="text-destructive font-medium">
              This key will not be shown again. Copy it now.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Your new API key</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={createdKey?.plaintext ?? ""}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied
                  ? <Check className="h-4 w-4 text-green-500" />
                  : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste this into your Claude Desktop config as{" "}
              <code className="rounded bg-muted px-1">BRAIN_GYM_API_KEY</code>.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleCloseCreated}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
