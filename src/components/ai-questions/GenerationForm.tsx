import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Zap, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { getCertifications } from "@/services/certifications";
import {
  getLlmConfigs,
  estimateTokens,
  generateQuestions,
  getJobStatus,
} from "@/services/ai-questions";
import {
  LlmProvider,
  Difficulty,
  QuestionType,
  JobStatusResult,
} from "@/types/api-types";
import MaterialLibrary from "./MaterialLibrary";

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  GEMINI: "Google Gemini",
};

const POLL_INTERVAL_MS = 3000;

interface Props {
  onResult: (
    result: JobStatusResult,
    certificationId: string,
    domainId?: string,
  ) => void;
}

export default function GenerationForm({ onResult }: Props) {
  const [provider, setProvider] = useState<LlmProvider | "">("");
  const [certificationId, setCertificationId] = useState("");
  const [domainId, setDomainId] = useState("all");
  const [materialId, setMaterialId] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [questionType, setQuestionType] = useState<QuestionType | "MIXED">(
    "MIXED",
  );
  const [questionCount, setQuestionCount] = useState(5);
  const [estimate, setEstimate] = useState<{
    totalEstimatedTokens: number;
  } | null>(null);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [pendingCertId, setPendingCertId] = useState("");
  const [pendingDomainId, setPendingDomainId] = useState<string | undefined>();

  const { data: configs = [] } = useQuery({
    queryKey: ["llm-configs"],
    queryFn: getLlmConfigs,
  });
  const { data: certs = [] } = useQuery({
    queryKey: ["certifications"],
    queryFn: getCertifications,
  });

  const selectedCert = certs.find((c: any) => c.id === certificationId);
  const domains: any[] = selectedCert?.domains || [];

  // Poll job status until completed/failed
  useQuery({
    queryKey: ["ai-gen-job", pendingJobId],
    queryFn: () => getJobStatus(pendingJobId!),
    enabled: !!pendingJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "COMPLETED" || status === "FAILED"
        ? false
        : POLL_INTERVAL_MS;
    },
    onSuccess: (data: JobStatusResult) => {
      if (data.status === "COMPLETED" && data.questions) {
        setPendingJobId(null);
        onResult(data, pendingCertId, pendingDomainId);
      }
    },
  } as any);

  const estimateMutation = useMutation({
    mutationFn: () =>
      estimateTokens({
        provider: provider as LlmProvider,
        certificationId,
        domainId: domainId !== "all" ? domainId : undefined,
        materialId: materialId || undefined,
        difficulty,
        questionType:
          questionType === "MIXED" ? undefined : (questionType as QuestionType),
        questionCount,
      }),
    onSuccess: (data) => setEstimate(data),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      generateQuestions({
        provider: provider as LlmProvider,
        certificationId,
        domainId: domainId !== "all" ? domainId : undefined,
        materialId: materialId || undefined,
        difficulty,
        questionType:
          questionType === "MIXED" ? undefined : (questionType as QuestionType),
        questionCount,
      }),
    onSuccess: (data) => {
      setPendingJobId(data.jobId);
      setPendingCertId(certificationId);
      setPendingDomainId(domainId !== "all" ? domainId : undefined);
    },
  });

  const isGenerating = generateMutation.isPending || !!pendingJobId;
  const canGenerate = provider && certificationId;

  return (
    <div className="space-y-5">
      {/* Provider */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">AI Provider</label>
        <Select
          value={provider || undefined}
          onValueChange={(v) => setProvider(v as LlmProvider)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select provider..." />
          </SelectTrigger>
          <SelectContent>
            {configs.length === 0 && (
              <SelectItem value="_none" disabled>
                No keys configured
              </SelectItem>
            )}
            {configs.map((c: any) => (
              <SelectItem key={c.provider} value={c.provider}>
                {PROVIDER_LABELS[c.provider as LlmProvider]}{" "}
                {c.modelId && `(${c.modelId})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Certification */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Certification</label>
        <Select
          value={certificationId || undefined}
          onValueChange={(v) => {
            setCertificationId(v);
            setDomainId("all");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select certification..." />
          </SelectTrigger>
          <SelectContent>
            {certs.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({c.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Domain */}
      {domains.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Domain <span className="text-muted-foreground">(optional)</span>
          </label>
          <Select value={domainId} onValueChange={setDomainId}>
            <SelectTrigger>
              <SelectValue placeholder="All domains" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All domains</SelectItem>
              {domains.map((d: any) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Difficulty + Type */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Difficulty</label>
          <Select
            value={difficulty}
            onValueChange={(v) => setDifficulty(v as Difficulty)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EASY">Easy</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HARD">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Question Type</label>
          <Select
            value={questionType}
            onValueChange={(v) => setQuestionType(v as any)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MIXED">Mixed</SelectItem>
              <SelectItem value="SINGLE">Single Answer</SelectItem>
              <SelectItem value="MULTIPLE">Multiple Answer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Count */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Question Count</label>
          <Badge variant="secondary">{questionCount}</Badge>
        </div>
        <Slider
          min={1}
          max={20}
          step={1}
          value={[questionCount]}
          onValueChange={([v]) => setQuestionCount(v)}
        />
      </div>

      {/* Source Material */}
      <MaterialLibrary
        certificationId={certificationId || undefined}
        selectedId={materialId}
        onSelect={(id) => setMaterialId(materialId === id ? "" : id)}
      />

      {/* Estimate */}
      {estimate && (
        <Card className="bg-muted/40">
          <CardContent className="py-2 px-3 flex items-center gap-2 text-xs">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              Estimated{" "}
              <strong>~{estimate.totalEstimatedTokens.toLocaleString()}</strong>{" "}
              tokens
            </span>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!canGenerate || estimateMutation.isPending}
          onClick={() => estimateMutation.mutate()}
        >
          {estimateMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : null}
          Estimate Cost
        </Button>
        <Button
          className="flex-1"
          disabled={!canGenerate || isGenerating}
          onClick={() => generateMutation.mutate()}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {pendingJobId ? "Processing…" : "Queuing…"}
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Generate {questionCount} Questions
            </>
          )}
        </Button>
      </div>

      {generateMutation.isError && (
        <p className="text-xs text-destructive">
          {(generateMutation.error as any)?.response?.data?.message ||
            "Generation failed"}
        </p>
      )}
    </div>
  );
}
