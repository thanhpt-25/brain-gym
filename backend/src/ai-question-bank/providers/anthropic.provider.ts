import { LlmProviderInterface, GenerationParams, TokenEstimate } from './llm-provider.interface';

export class AnthropicProvider implements LlmProviderInterface {
    private readonly modelId: string;

    constructor(private readonly apiKey: string, modelId?: string) {
        this.modelId = modelId || 'claude-haiku-4-5-20251001';
    }

    async generateRaw(systemPrompt: string, userPrompt: string) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: this.modelId,
                max_tokens: 4096,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
            }),
            signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Anthropic API error ${response.status}: ${(error as any)?.error?.message || response.statusText}`);
        }

        const data = await response.json() as any;
        return {
            content: data.content[0].text,
            promptTokens: data.usage?.input_tokens || 0,
            completionTokens: data.usage?.output_tokens || 0,
        };
    }

    async validateApiKey(): Promise<boolean> {
        const response = await fetch('https://api.anthropic.com/v1/models', {
            headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            signal: AbortSignal.timeout(10000),
        });
        return response.ok;
    }

    estimateTokens(params: GenerationParams): TokenEstimate {
        const basePromptTokens = 800;
        const sourceTokens = params.sourceChunks
            ? params.sourceChunks.reduce((sum, c) => sum + Math.ceil(c.length / 4), 0)
            : 0;
        return {
            estimatedPromptTokens: basePromptTokens + sourceTokens,
            estimatedCompletionTokens: params.questionCount * 200,
        };
    }
}
