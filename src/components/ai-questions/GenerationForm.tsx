import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Zap, Loader2, Info, Cpu } from "lucide-react";
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
import {
  localLlmConfigStorage,
  generateLocalQuestions,
} from "@/services/local-llm";
import type { LocalGenerationParams } from "@/services/local-llm";

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  GEMINI: "Google Gemini",
};

const LOCAL_PROVIDER = "LOCAL" as const;
type ProviderValue = LlmProvider | typeof LOCAL_PROVIDER | "";

const POLL_INTERVAL_MS = 3000;

interface Props {
  onResult: (
    result: JobStatusResult,
    certificationId: string,
    domainId?: string,
  ) => void;
}

export default function GenerationForm({ onResult }: Props) {
  const [provider, setProvider] = useState<ProviderValue>("");
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
  const [isGeneratingLocal, setIsGeneratingLocal] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { data: configs = [] } = useQuery({
    queryKey: ["llm-configs"],
    queryFn: getLlmConfigs,
  });
  const { data: certs = [] } = useQuery({
    queryKey: ["certifications"],
    queryFn: getCertifications,
  });

  const localConfig = localLlmConfigStorage.get();
  const selectedCert = (certs as Array<{ id: string; domains?: any[] }>).find(
    (c) => c.id === certificationId,
  );
  const domains: Array<{ id: string; name: string }> =
    selectedCert?.domains || [];

  // Poll cloud job status
  const { data: jobStatusData } = useQuery({
    queryKey: ["ai-gen-job", pendingJobId],
    queryFn: () => getJobStatus(pendingJobId!),
    enabled: !!pendingJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "COMPLETED" || status === "FAILED"
        ? false
        : POLL_INTERVAL_MS;
    },
  });

  useEffect(() => {
    if (jobStatusData?.status === "COMPLETED" && jobStatusData.questions) {
      setPendingJobId(null);
      onResult(jobStatusData, pendingCertId, pendingDomainId);
    }
  }, [jobStatusData, onResult, pendingCertId, pendingDomainId]);

  // ─── Cloud generation ────────────────────────────────────────────────────────

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

  const generateCloudMutation = useMutation({
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

  // ─── Local generation ────────────────────────────────────────────────────────

  const handleLocalGenerate = async () => {
    if (!localConfig) return;
    setLocalError(null);
    setIsGeneratingLocal(true);

    try {
      const cert = (certs as any[]).find((c) => c.id === certificationId);
      const domain =
        domainId !== "all" ? domains.find((d: any) => d.id === domainId) : null;

      const params: LocalGenerationParams = {
        certificationName: cert?.name ?? certificationId,
        certificationCode: cert?.code ?? certificationId,
        domainName: domain?.name,
        difficulty,
        questionCount,
        questionType:
          questionType === "MIXED" ? undefined : (questionType as QuestionType),
      };

      const result = await generateLocalQuestions(localConfig, params);

      if (result.previews.length === 0) {
        setLocalError(
          `Model returned no valid questions (${result.discarded} discarded). Try again or choose a different model.`,
        );
        return;
      }

      if (result.discarded > 0) {
        setLocalError(
          `${result.previews.length} of ${result.previews.length + result.discarded} questions parsed successfully.`,
        );
      }

      // Synthetic JobStatusResult — jobId starts with "local-" so the page
      // can detect it and wire up the intake submit path.
      const syntheticResult: JobStatusResult = {
        jobId: `local-${Date.now()}`,
        status: "COMPLETED",
        questions: result.previews,
      };

      onResult(
        syntheticResult,
        certificationId,
        domainId !== "all" ? domainId : undefined,
      );
    } catch (err: unknown) {
      setLocalError(
        err instanceof Error ? err.message : "Local generation failed.",
      );
    } finally {
      setIsGeneratingLocal(false);
    }
  };

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const isLocalSelected = provider === LOCAL_PROVIDER;
  const isCloudGenerating = generateCloudMutation.isPending || !!pendingJobId;
  const canGenerate = provider !== "" && certificationId !== "";

  return (
    <div className="space-y-5">
      {/* Provider */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">AI Provider</label>
        <Select
          value={provider || undefined}
          onValueChange={(v) => {
            setProvider(v as ProviderValue);
            setEstimate(null);
            setLocalError(null);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select provider..." />
          </SelectTrigger>
          <SelectContent>
            {configs.length === 0 && !localConfig && (
              <SelectItem value="_none" disabled>
                No providers configured
              </SelectItem>
            )}
            {(configs as any[]).map((c) => (
              <SelectItem key={c.provider} value={c.provider}>
                {PROVIDER_LABELS[c.provider as LlmProvider]}{" "}
                {c.modelId && `(${c.modelId})`}
              </SelectItem>
            ))}
            {localConfig && (
              <SelectItem value={LOCAL_PROVIDER}>
                <span className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" />
                  Local — {localConfig.modelId}
                </span>
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        {configs.length === 0 && !localConfig && (
          <p className="text-xs text-muted-foreground">
            Add a cloud API key or configure a Local LLM in{" "}
            <strong>AI Settings</strong>.
          </p>
        )}

        {isLocalSelected && localConfig && (
          <Card className="bg-muted/40">
            <CardContent className="py-2 px-3 flex items-center gap-2 text-xs">
              <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
              <span>
                <strong>{localConfig.modelId}</strong> via {localConfig.baseUrl}
              </span>
            </CardContent>
          </Card>
        )}
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
            {(certs as any[]).map((c) => (
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

      {/* Source material — cloud only */}
      {!isLocalSelected && (
        <MaterialLibrary
          certificationId={certificationId || undefined}
          selectedId={materialId}
          onSelect={(id) => setMaterialId(materialId === id ? "" : id)}
        />
      )}

      {/* Token estimate — cloud only */}
      {estimate && !isLocalSelected && (
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

      {/* Local info banner */}
      {isLocalSelected && (
        <Card className="bg-muted/40">
          <CardContent className="py-2 px-3 flex items-center gap-2 text-xs">
            <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              Generated in the browser — no cloud API calls, no quota usage.
              Questions go to <strong>Pending</strong> for admin review.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Local error / partial-parse warning */}
      {localError && (
        <p className="text-xs text-yellow-700 bg-yellow-50 rounded p-2">
          {localError}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!isLocalSelected && (
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
        )}

        {isLocalSelected ? (
          <Button
            className="flex-1"
            disabled={!canGenerate || isGeneratingLocal}
            onClick={handleLocalGenerate}
          >
            {isGeneratingLocal ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating locally…
              </>
            ) : (
              <>
                <Cpu className="h-4 w-4 mr-2" />
                Generate {questionCount} Questions (Local)
              </>
            )}
          </Button>
        ) : (
          <Button
            className="flex-1"
            disabled={!canGenerate || isCloudGenerating}
            onClick={() => generateCloudMutation.mutate()}
          >
            {isCloudGenerating ? (
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
        )}
      </div>

      {generateCloudMutation.isError && (
        <p className="text-xs text-destructive">
          {(generateCloudMutation.error as any)?.response?.data?.message ||
            "Generation failed"}
        </p>
      )}
    </div>
  );
}
