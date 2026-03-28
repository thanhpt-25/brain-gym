import { LlmProviderInterface, GenerationParams, TokenEstimate } from './llm-provider.interface';

export class OpenAiProvider implements LlmProviderInterface {
    private readonly modelId: string;

    constructor(private readonly apiKey: string, modelId?: string) {
        this.modelId = modelId || 'gpt-4o-mini';
    }

    async generateRaw(systemPrompt: string, userPrompt: string) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.modelId,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.7,
            }),
            signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`OpenAI API error ${response.status}: ${(error as any)?.error?.message || response.statusText}`);
        }

        const data = await response.json() as any;
        return {
            content: data.choices[0].message.content,
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
        };
    }

    async validateApiKey(): Promise<boolean> {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${this.apiKey}` },
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
