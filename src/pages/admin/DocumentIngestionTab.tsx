import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileText,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  estimateIngestion,
  createIngestionJob,
  listIngestionJobs,
  type IngestionJob,
} from "@/services/document-ingestion";
import api from "@/services/api";

type Certification = { id: string; name: string; code: string };

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  EXTRACTING: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ENRICHING: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "COMPLETED")
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (status === "FAILED")
    return <XCircle className="h-3.5 w-3.5 text-red-400" />;
  if (status === "PENDING")
    return <Clock className="h-3.5 w-3.5 text-yellow-400" />;
  return <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />;
};

export function DocumentIngestionTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [certificationId, setCertificationId] = useState("");
  const [declaredSource, setDeclaredSource] = useState("");
  const [attestation, setAttestation] = useState(false);
  const [estimate, setEstimate] = useState<{
    wordCount: number;
    estimatedPages: number;
    estimatedCostUsd: number;
  } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [page, setPage] = useState(1);

  const { data: certsData } = useQuery<{ data: Certification[] }>({
    queryKey: ["admin-certifications"],
    queryFn: async () => {
      const res = await api.get("/certifications?limit=200");
      return res.data;
    },
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["ingestion-jobs", page],
    queryFn: () => listIngestionJobs(page, 20),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      createIngestionJob(
        selectedFile!,
        certificationId,
        attestation,
        declaredSource || undefined,
      ),
    onSuccess: () => {
      toast.success("Ingestion job created");
      setSelectedFile(null);
      setCertificationId("");
      setDeclaredSource("");
      setAttestation(false);
      setEstimate(null);
      qc.invalidateQueries({ queryKey: ["ingestion-jobs"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Failed to create job"),
  });

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setEstimate(null);
    if (certificationId) {
      await runEstimate(file, certificationId);
    }
  };

  const runEstimate = async (file: File, certId: string) => {
    if (!file || !certId) return;
    setEstimating(true);
    try {
      const est = await estimateIngestion(file, certId);
      setEstimate(est);
    } catch {
      toast.error("Estimate failed");
    } finally {
      setEstimating(false);
    }
  };

  const canSubmit =
    selectedFile && certificationId && attestation && !submitMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-mono text-sm flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> Ingest Document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File picker */}
          <div className="space-y-2">
            <Label className="font-mono text-xs">
              Document (TXT / plain text)
            </Label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                selectedFile
                  ? "border-primary/40 bg-primary/5"
                  : "border-border hover:border-primary/30"
              }`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) handleFileSelect(f);
              }}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="font-mono text-sm">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground font-mono">
                    Drop a file or click to browse
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
          </div>

          {/* Certification */}
          <div className="space-y-2">
            <Label className="font-mono text-xs">Certification</Label>
            <select
              className="w-full h-9 rounded-md border border-border bg-muted px-3 text-sm font-mono"
              value={certificationId}
              onChange={(e) => {
                setCertificationId(e.target.value);
                if (selectedFile && e.target.value) {
                  runEstimate(selectedFile, e.target.value);
                }
              }}
            >
              <option value="">Select certification…</option>
              {certsData?.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Declared source */}
          <div className="space-y-2">
            <Label className="font-mono text-xs">
              Declared Source{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              placeholder="e.g. Official AWS SAA-C03 exam guide, 2024 ed."
              value={declaredSource}
              onChange={(e) => setDeclaredSource(e.target.value)}
              className="bg-muted border-border font-mono text-xs"
            />
          </div>

          {/* Estimate */}
          {estimating && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Loader2 className="h-3 w-3 animate-spin" /> Estimating…
            </div>
          )}
          {estimate && !estimating && (
            <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs font-mono">
              <span>
                Words:{" "}
                <span className="text-foreground font-semibold">
                  {estimate.wordCount.toLocaleString()}
                </span>
              </span>
              <span>
                Pages:{" "}
                <span className="text-foreground font-semibold">
                  ~{estimate.estimatedPages}
                </span>
              </span>
              <span>
                Est. cost:{" "}
                <span className="text-primary font-semibold">
                  ${estimate.estimatedCostUsd.toFixed(4)}
                </span>
              </span>
            </div>
          )}

          {/* Rights attestation */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={attestation}
              onChange={(e) => setAttestation(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-xs text-muted-foreground font-mono leading-relaxed group-hover:text-foreground transition-colors">
              I confirm I have the rights to use this content for training data
              generation, and that source text will not be stored verbatim (
              always-paraphrase policy).
            </span>
          </label>

          <div className="flex justify-end">
            <Button
              className="glow-cyan"
              disabled={!canSubmit}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1.5" />
              )}
              Start Ingestion
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Jobs list */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-mono text-sm">Ingestion Jobs</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                qc.invalidateQueries({ queryKey: ["ingestion-jobs"] })
              }
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !jobsData?.data?.length ? (
            <p className="text-sm text-muted-foreground font-mono text-center py-6">
              No jobs yet
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-xs">File</TableHead>
                    <TableHead className="font-mono text-xs">Status</TableHead>
                    <TableHead className="font-mono text-xs">
                      Questions
                    </TableHead>
                    <TableHead className="font-mono text-xs">Cost</TableHead>
                    <TableHead className="font-mono text-xs">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobsData.data.map((job: IngestionJob) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{job.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-[10px] gap-1 ${STATUS_COLORS[job.status] ?? ""}`}
                        >
                          <StatusIcon status={job.status} />
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {job.status === "COMPLETED"
                          ? `${job._count?.questions ?? job.enrichedCount ?? 0} DRAFT`
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {job.estimatedCostUsd != null
                          ? `$${job.estimatedCostUsd.toFixed(4)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* Pagination */}
              {jobsData.total > 20 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-mono self-center text-muted-foreground">
                    Page {page} of {Math.ceil(jobsData.total / 20)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= Math.ceil(jobsData.total / 20)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
