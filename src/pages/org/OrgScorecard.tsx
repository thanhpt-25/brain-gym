import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrgStore } from "@/stores/org.store";
import {
  getScorecard,
  getDomainMappings,
  upsertDomainMappings,
  downloadScorecardCsv,
  type Scorecard,
  type DomainMapping,
} from "@/services/scorecard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Download,
  Loader2,
  Settings,
  Save,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { toast } from "sonner";

// ─── Scorecard view ───────────────────────────────────────────────────────────

const ScorecardView = ({
  scorecard,
  onDownload,
  downloading,
}: {
  scorecard: Scorecard;
  onDownload: () => void;
  downloading: boolean;
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="font-mono font-semibold text-sm">
          {scorecard.candidate.name ?? scorecard.candidate.email}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {scorecard.candidate.email}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {scorecard.candidate.overallScore != null && (
          <Badge className="font-mono text-xs bg-primary/15 text-primary">
            {Number(scorecard.candidate.overallScore).toFixed(1)}% overall
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          className="font-mono text-xs"
          onClick={onDownload}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5 mr-1.5" />
          )}
          CSV
        </Button>
      </div>
    </div>

    {scorecard.competencies.length === 0 ? (
      <p className="text-xs text-muted-foreground text-center py-8">
        No domain mappings configured for this assessment yet.
      </p>
    ) : (
      <div className="space-y-3">
        {scorecard.competencies.map((c) => {
          const rangePct =
            ((c.score - c.scaleMin) / (c.scaleMax - c.scaleMin)) * 100;
          const gapIcon =
            c.gap == null ? null : c.gap >= 0 ? (
              <TrendingUp className="h-3 w-3 text-emerald-400" />
            ) : (
              <TrendingDown className="h-3 w-3 text-rose-400" />
            );

          return (
            <Card key={c.competencyId} className="bg-card/60 border-border">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold">
                    {c.name}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    {c.requiredLevel != null && (
                      <span className="text-muted-foreground">
                        req {c.requiredLevel}
                      </span>
                    )}
                    <span className="text-foreground font-semibold">
                      {c.score.toFixed(1)} / {c.scaleMax}
                    </span>
                    {gapIcon && (
                      <span className="flex items-center gap-0.5">
                        {gapIcon}
                        <span
                          className={
                            c.gap! >= 0 ? "text-emerald-400" : "text-rose-400"
                          }
                        >
                          {c.gap! >= 0 ? "+" : ""}
                          {c.gap!.toFixed(1)}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <Progress
                  value={Math.max(0, Math.min(100, rangePct))}
                  className="h-1.5"
                />
                <p className="text-[10px] text-muted-foreground font-mono">
                  {c.pct.toFixed(1)}% domain accuracy
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    )}
  </div>
);

// ─── Domain mapping editor ────────────────────────────────────────────────────

const DomainMappingEditor = ({
  assessmentId,
  mappings,
  onSave,
  isPending,
}: {
  assessmentId: string;
  mappings: DomainMapping[];
  onSave: (
    mappings: Array<{
      domainKey: string;
      competencyId: string;
      weight: number;
    }>,
  ) => void;
  isPending: boolean;
}) => {
  const [rows, setRows] = useState<
    Array<{ domainKey: string; competencyId: string; weight: string }>
  >(
    mappings.length > 0
      ? mappings.map((m) => ({
          domainKey: m.domainKey,
          competencyId: m.competencyId,
          weight: m.weight.toString(),
        }))
      : [{ domainKey: "", competencyId: "", weight: "1" }],
  );

  const addRow = () =>
    setRows((r) => [...r, { domainKey: "", competencyId: "", weight: "1" }]);

  const removeRow = (i: number) =>
    setRows((r) => r.filter((_, idx) => idx !== i));

  const update = (i: number, field: string, value: string) =>
    setRows((r) =>
      r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)),
    );

  const handleSave = () => {
    const valid = rows.filter(
      (r) => r.domainKey.trim() && r.competencyId.trim(),
    );
    onSave(
      valid.map((r) => ({
        domainKey: r.domainKey.trim(),
        competencyId: r.competencyId.trim(),
        weight: Number(r.weight) || 1,
      })),
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Map each exam domain key to a competency. The scorecard aggregates
        per-domain accuracy into competency scores using the configured weight.
      </p>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-center"
          >
            <Input
              className="font-mono text-xs bg-muted/30 border-border h-8"
              placeholder="Domain key"
              value={row.domainKey}
              onChange={(e) => update(i, "domainKey", e.target.value)}
            />
            <Input
              className="font-mono text-xs bg-muted/30 border-border h-8"
              placeholder="Competency ID"
              value={row.competencyId}
              onChange={(e) => update(i, "competencyId", e.target.value)}
            />
            <Input
              type="number"
              min={0}
              step={0.1}
              className="font-mono text-xs bg-muted/30 border-border h-8"
              placeholder="Weight"
              value={row.weight}
              onChange={(e) => update(i, "weight", e.target.value)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => removeRow(i)}
              disabled={rows.length === 1}
            >
              ×
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-1">
        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-xs"
          onClick={addRow}
        >
          + Add row
        </Button>
        <Button
          size="sm"
          className="glow-cyan font-mono text-xs"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1.5" />
          )}
          Save mappings
        </Button>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const OrgScorecard = () => {
  const queryClient = useQueryClient();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || "";
  const { assessmentId = "", inviteId = "" } = useParams<{
    assessmentId: string;
    inviteId: string;
  }>();

  const [csvDownloading, setCsvDownloading] = useState(false);

  const { data: scorecard, isLoading: scorecardLoading } = useQuery<Scorecard>({
    queryKey: ["scorecard", slug, assessmentId, inviteId],
    queryFn: () => getScorecard(slug, assessmentId, inviteId),
    enabled: !!slug && !!assessmentId && !!inviteId,
  });

  const { data: mappings = [], isLoading: mappingsLoading } = useQuery<
    DomainMapping[]
  >({
    queryKey: ["domain-mappings", slug, assessmentId],
    queryFn: () => getDomainMappings(slug, assessmentId),
    enabled: !!slug && !!assessmentId,
  });

  const saveMappingsMutation = useMutation({
    mutationFn: (
      data: Array<{ domainKey: string; competencyId: string; weight: number }>,
    ) => upsertDomainMappings(slug, assessmentId, data),
    onSuccess: () => {
      toast.success("Domain mappings saved");
      queryClient.invalidateQueries({
        queryKey: ["domain-mappings", slug, assessmentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["scorecard", slug, assessmentId, inviteId],
      });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Save failed"),
  });

  const handleDownload = async () => {
    setCsvDownloading(true);
    try {
      await downloadScorecardCsv(slug, assessmentId, inviteId);
    } catch {
      toast.error("CSV download failed");
    } finally {
      setCsvDownloading(false);
    }
  };

  if (scorecardLoading || mappingsLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-mono font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Competency Scorecard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Weighted competency scores derived from domain performance
        </p>
      </div>

      <Tabs defaultValue="scorecard">
        <TabsList className="font-mono text-xs">
          <TabsTrigger value="scorecard" className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Scorecard
          </TabsTrigger>
          <TabsTrigger value="mapping" className="flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Domain Mapping
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scorecard" className="mt-4">
          {scorecard ? (
            <ScorecardView
              scorecard={scorecard}
              onDownload={handleDownload}
              downloading={csvDownloading}
            />
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-mono">
                Scorecard not available — assessment may not be submitted yet.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="mapping" className="mt-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <DomainMappingEditor
                assessmentId={assessmentId}
                mappings={mappings}
                onSave={(data) => saveMappingsMutation.mutate(data)}
                isPending={saveMappingsMutation.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrgScorecard;
