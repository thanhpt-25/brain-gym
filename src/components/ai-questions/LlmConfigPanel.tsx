import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Trash2, CheckCircle2, XCircle, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getLlmConfigs, saveLlmConfig, deleteLlmConfig, validateLlmConfig } from '@/services/ai-questions';
import { LlmProvider } from '@/types/api-types';
import { toast } from 'sonner';

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  OPENAI: 'OpenAI',
  ANTHROPIC: 'Anthropic',
  GEMINI: 'Google Gemini',
};

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  OPENAI: 'gpt-4o-mini',
  ANTHROPIC: 'claude-haiku-4-5-20251001',
  GEMINI: 'gemini-1.5-flash',
};

export default function LlmConfigPanel() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [provider, setProvider] = useState<LlmProvider>('OPENAI');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');
  const [validating, setValidating] = useState<LlmProvider | null>(null);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['llm-configs'],
    queryFn: getLlmConfigs,
  });

  const saveMutation = useMutation({
    mutationFn: saveLlmConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-configs'] });
      setAdding(false);
      setApiKey('');
      setModelId('');
      toast.success('API key saved');
    },
    onError: () => toast.error('Failed to save API key'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLlmConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-configs'] });
      toast.success('API key removed');
    },
  });

  const handleValidate = async (p: LlmProvider) => {
    setValidating(p);
    try {
      const result = await validateLlmConfig(p);
      toast[result.valid ? 'success' : 'error'](
        result.valid ? `${PROVIDER_LABELS[p]} key is valid` : `${PROVIDER_LABELS[p]} key is invalid or expired`
      );
    } catch {
      toast.error('Validation request failed');
    } finally {
      setValidating(null);
    }
  };

  const handleSave = () => {
    if (!apiKey.trim()) return;
    saveMutation.mutate({ provider, apiKey: apiKey.trim(), modelId: modelId || DEFAULT_MODELS[provider] });
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">AI Provider Keys</h3>
          <p className="text-xs text-muted-foreground">Keys are encrypted at rest. Bring your own key (BYOK).</p>
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
            <Select value={provider} onValueChange={v => setProvider(v as LlmProvider)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDER_LABELS) as LlmProvider[]).map(p => (
                  <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="password"
              placeholder={`${PROVIDER_LABELS[provider]} API Key`}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <Input
              placeholder={`Model ID (default: ${DEFAULT_MODELS[provider]})`}
              value={modelId}
              onChange={e => setModelId(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={!apiKey.trim() || saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setApiKey(''); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {configs.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground text-center py-4">No API keys configured yet.</p>
      )}

      {configs.map(config => (
        <Card key={config.id}>
          <CardContent className="py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-sm font-medium">{PROVIDER_LABELS[config.provider]}</span>
                {config.modelId && <span className="text-xs text-muted-foreground ml-2">{config.modelId}</span>}
                <div className="text-xs text-muted-foreground font-mono">{config.maskedKey}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant={config.isActive ? 'default' : 'secondary'} className="text-xs">
                {config.isActive ? 'Active' : 'Disabled'}
              </Badge>
              <Button
                size="sm" variant="ghost"
                onClick={() => handleValidate(config.provider)}
                disabled={validating === config.provider}
              >
                {validating === config.provider
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <CheckCircle2 className="h-3 w-3" />}
              </Button>
              <Button
                size="sm" variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate(config.provider)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card className="bg-muted/30 border-dashed">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-xs text-muted-foreground">MCP Mode (Claude Desktop / NotebookLM)</CardTitle>
        </CardHeader>
        <CardContent className="pb-3 text-xs text-muted-foreground space-y-1">
          <p>Connect your MCP-compatible AI tool to push questions directly:</p>
          <code className="block bg-background rounded p-2 font-mono text-xs">
            POST /api/v1/ai-questions/mcp/intake
          </code>
          <p>Use your Bearer token as the Authorization header. Questions are auto-routed through the quality gate.</p>
        </CardContent>
      </Card>
    </div>
  );
}
