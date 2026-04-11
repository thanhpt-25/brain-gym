import {
  LlmProviderInterface,
  GenerationParams,
  TokenEstimate,
} from './llm-provider.interface';

export class GeminiProvider implements LlmProviderInterface {
  private readonly modelId: string;

  constructor(
    private readonly apiKey: string,
    modelId?: string,
  ) {
    this.modelId = modelId || 'gemini-1.5-flash';
  }

  async generateRaw(systemPrompt: string, userPrompt: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Gemini API error ${response.status}: ${JSON.stringify(error?.error)}`,
      );
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return {
      content,
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
    };
  }

  async validateApiKey(): Promise<boolean> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
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
