import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Key,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  Cpu,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getLlmConfigs,
  saveLlmConfig,
  deleteLlmConfig,
  validateLlmConfig,
} from "@/services/ai-questions";
import { LlmProvider } from "@/types/api-types";
import { toast } from "sonner";
import {
  testConnection,
  localLlmConfigStorage,
  isAllowedLocalUrl,
} from "@/services/local-llm";
import type {
  ConnectionTestResult,
  LocalLlmDialect,
  LocalModelInfo,
} from "@/services/local-llm";

// ─── Cloud providers ──────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  GEMINI: "Google Gemini",
};

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  OPENAI: "gpt-4o-mini",
  ANTHROPIC: "claude-haiku-4-5-20251001",
  GEMINI: "gemini-1.5-flash",
};

// ─── Local LLM constants ──────────────────────────────────────────────────────

const DIALECT_LABELS: Record<LocalLlmDialect, string> = {
  openai: "OpenAI-compatible (Ollama /v1, LM Studio, llama.cpp…)",
  anthropic: "Anthropic-compatible (proxy) — Advanced",
  ollama: "Ollama native",
};

const DIALECT_DEFAULTS: Record<LocalLlmDialect, string> = {
  openai: "http://localhost:11434/v1",
  anthropic: "http://localhost:8081",
  ollama: "http://localhost:11434",
};

function TestResultBadge({ result }: { result: ConnectionTestResult | null }) {
  if (!result) return null;
  const icon = result.ok ? (
    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
  ) : result.reason === "cors" || result.reason === "empty" ? (
    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
  ) : (
    <XCircle className="h-4 w-4 flex-shrink-0" />
  );

  const cls = result.ok
    ? "bg-green-50 text-green-800"
    : result.reason === "cors" || result.reason === "empty"
      ? "bg-yellow-50 text-yellow-800"
      : "bg-red-50 text-red-800";

  return (
    <div className={`flex items-start gap-2 text-xs rounded p-2 ${cls}`}>
      {icon}
      <span>
        {result.ok
          ? `Connected — ${result.models.length} model${result.models.length !== 1 ? "s" : ""} found`
          : result.hint}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LlmConfigPanel() {
  const queryClient = useQueryClient();
  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";

  // Cloud state
  const [adding, setAdding] = useState(false);
  const [provider, setProvider] = useState<LlmProvider>("OPENAI");
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState("");
  const [validating, setValidating] = useState<LlmProvider | null>(null);

  // Local LLM state — initialised from localStorage
  const [localDialect, setLocalDialect] = useState<LocalLlmDialect>(
    () => localLlmConfigStorage.get()?.dialect ?? "openai",
  );
  const [localBaseUrl, setLocalBaseUrl] = useState<string>(
    () => localLlmConfigStorage.get()?.baseUrl ?? DIALECT_DEFAULTS["openai"],
  );
  const [localApiKey, setLocalApiKey] = useState<string>(
    () => localLlmConfigStorage.get()?.apiKey ?? "",
  );
  const [localModels, setLocalModels] = useState<LocalModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localLlmConfigStorage.get()?.modelId ?? "",
  );
  const [testState, setTestState] = useState<
    "idle" | "testing" | ConnectionTestResult
  >("idle");
  const [showCorsGuide, setShowCorsGuide] = useState(false);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["llm-configs"],
    queryFn: getLlmConfigs,
  });

  const saveMutation = useMutation({
    mutationFn: saveLlmConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llm-configs"] });
      setAdding(false);
      setApiKey("");
      setModelId("");
      toast.success("API key saved");
    },
    onError: () => toast.error("Failed to save API key"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLlmConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llm-configs"] });
      toast.success("API key removed");
    },
  });

  const handleValidate = async (p: LlmProvider) => {
    setValidating(p);
    try {
      const result = await validateLlmConfig(p);
      toast[result.valid ? "success" : "error"](
        result.valid
          ? `${PROVIDER_LABELS[p]} key is valid`
          : `${PROVIDER_LABELS[p]} key is invalid or expired`,
      );
    } catch {
      toast.error("Validation request failed");
    } finally {
      setValidating(null);
    }
  };

  const handleSaveCloud = () => {
    if (!apiKey.trim()) return;
    saveMutation.mutate({
      provider,
      apiKey: apiKey.trim(),
      modelId: modelId || DEFAULT_MODELS[provider],
    });
  };

  const handleDialectChange = (d: LocalLlmDialect) => {
    setLocalDialect(d);
    setLocalBaseUrl(DIALECT_DEFAULTS[d]);
    setLocalModels([]);
    setSelectedModel("");
    setTestState("idle");
  };

  const handleTestConnection = async () => {
    if (!localBaseUrl.trim()) return;
    if (!isAllowedLocalUrl(localBaseUrl)) {
      toast.error(
        "Base URL must point to localhost, .local, or a private network address (10.x, 172.16-31.x, 192.168.x)"
      );
      return;
    }
    setTestState("testing");
    setLocalModels([]);
    setSelectedModel("");

    const result = await testConnection({
      dialect: localDialect,
      baseUrl: localBaseUrl.trim(),
      apiKey: localApiKey || undefined,
    });

    setTestState(result);
    if (result.ok) {
      setLocalModels(result.models);
      if (result.models.length > 0) setSelectedModel(result.models[0].id);
    } else if (result.reason === "cors") {
      setShowCorsGuide(true);
    }
  };

  const handleSaveLocal = () => {
    if (!selectedModel) {
      toast.error("Select a model first.");
      return;
    }
    localLlmConfigStorage.set({
      dialect: localDialect,
      baseUrl: localBaseUrl.trim(),
      modelId: selectedModel,
      apiKey: localApiKey || undefined,
    });
    toast.success("Local LLM config saved.");
  };

  const handleClearLocal = () => {
    localLlmConfigStorage.clear();
    setLocalModels([]);
    setSelectedModel("");
    setTestState("idle");
    toast.success("Local LLM config cleared.");
  };

  const savedLocalConfig = localLlmConfigStorage.get();

  if (isLoading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="space-y-6">
      {/* ── Cloud Providers ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Cloud AI Providers</h3>
            <p className="text-xs text-muted-foreground">
              Keys are encrypted at rest. Bring your own key (BYOK).
            </p>
          </div>
          {!adding && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Key
            </Button>
          )}
        </div>

        {adding && (
          <Card className="border-dashed">
            <CardContent className="pt-4 space-y-3">
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v as LlmProvider)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROVIDER_LABELS) as LlmProvider[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROVIDER_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="password"
                placeholder={`${PROVIDER_LABELS[provider]} API Key`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <Input
                placeholder={`Model ID (default: ${DEFAULT_MODELS[provider]})`}
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveCloud}
                  disabled={!apiKey.trim() || saveMutation.isPending}
                >
                  {saveMutation.isPending && (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  )}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAdding(false);
                    setApiKey("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {configs.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No API keys configured yet.
          </p>
        )}

        {configs.map((config) => (
          <Card key={config.id}>
            <CardContent className="py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">
                    {PROVIDER_LABELS[config.provider]}
                  </span>
                  {config.modelId && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {config.modelId}
                    </span>
                  )}
                  <div className="text-xs text-muted-foreground font-mono">
                    {config.maskedKey}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Badge
                  variant={config.isActive ? "default" : "secondary"}
                  className="text-xs"
                >
                  {config.isActive ? "Active" : "Disabled"}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleValidate(config.provider)}
                  disabled={validating === config.provider}
                >
                  {validating === config.provider ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(config.provider)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Local LLM ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Local LLM</h3>
          <Badge variant="secondary" className="text-xs">
            Free — no API fees
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Use any self-hosted LLM: Ollama, LM Studio, llama.cpp, vLLM, Jan, or
          any OpenAI/Anthropic-compatible server. Questions are generated in the
          browser.
        </p>

        {savedLocalConfig && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="py-2 px-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-green-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  Active: <strong>{savedLocalConfig.modelId}</strong> via{" "}
                  {savedLocalConfig.baseUrl}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs text-green-700"
                onClick={handleClearLocal}
              >
                Clear
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">API Dialect</label>
              <Select
                value={localDialect}
                onValueChange={(v) => handleDialectChange(v as LocalLlmDialect)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DIALECT_LABELS) as LocalLlmDialect[]).map(
                    (d) => (
                      <SelectItem key={d} value={d}>
                        {DIALECT_LABELS[d]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Base URL</label>
              <Input
                placeholder={DIALECT_DEFAULTS[localDialect]}
                value={localBaseUrl}
                onChange={(e) => {
                  setLocalBaseUrl(e.target.value);
                  setTestState("idle");
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">
                API Key{" "}
                <span className="text-muted-foreground font-normal">
                  (optional — usually not needed for local servers)
                </span>
              </label>
              <Input
                type="password"
                placeholder="Leave empty for local"
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
              />
            </div>

            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={!localBaseUrl.trim() || testState === "testing"}
              onClick={handleTestConnection}
            >
              {testState === "testing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
              )}
              {testState === "testing" ? "Testing…" : "Test Connection"}
            </Button>

            {testState !== "idle" && testState !== "testing" && (
              <TestResultBadge result={testState} />
            )}

            {localModels.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium">Select Model</label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model…" />
                  </SelectTrigger>
                  <SelectContent>
                    {localModels.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedModel && (
              <Button size="sm" className="w-full" onClick={handleSaveLocal}>
                Save Local Config
              </Button>
            )}
          </CardContent>
        </Card>

        {/* CORS guide */}
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowCorsGuide((v) => !v)}
        >
          {showCorsGuide ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          CORS setup guide
        </button>
        {showCorsGuide && (
          <Card className="bg-muted/40 border-dashed">
            <CardContent className="pt-3 pb-3 space-y-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                Allow browser → self-hosted LLM requests:
              </p>
              <p className="text-muted-foreground italic">
                Your app is running at: <code className="font-mono">{appOrigin}</code>
              </p>
              <div>
                <p className="font-medium mb-1">Ollama:</p>
                <code className="block bg-background rounded p-2 font-mono whitespace-pre-wrap">
                  {`OLLAMA_ORIGINS=${appOrigin} ollama serve`}
                </code>
              </div>
              <div>
                <p className="font-medium mb-1">LM Studio:</p>
                <p>
                  Settings → Local Server → CORS → enable and add origin:{" "}
                  <code className="font-mono">{appOrigin}</code>
                </p>
              </div>
              <div>
                <p className="font-medium mb-1">llama.cpp server:</p>
                <code className="block bg-background rounded p-2 font-mono whitespace-pre-wrap">
                  {`./server --cors-allowed-origins "${appOrigin}"`}
                </code>
              </div>
              <div>
                <p className="font-medium mb-1">Other self-hosted LLMs:</p>
                <p>
                  Refer to your server's documentation to enable CORS and add the
                  following origin: <code className="font-mono">{appOrigin}</code>
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── MCP Mode ── */}
      <Card className="bg-muted/30 border-dashed">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-xs text-muted-foreground">
            MCP Mode (Claude Desktop / NotebookLM)
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3 text-xs text-muted-foreground space-y-1">
          <p>Connect your MCP-compatible AI tool to push questions directly:</p>
          <code className="block bg-background rounded p-2 font-mono text-xs">
            POST /api/v1/ai-questions/mcp/intake
          </code>
          <p>
            Use your Bearer token as the Authorization header. Questions are
            auto-routed through the quality gate.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
