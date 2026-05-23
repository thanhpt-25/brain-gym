/**
 * US-1004: Shared LLM client for all features (DDS, embedding, coach).
 * Consolidates the Anthropic/OpenAI selection logic so callers stop
 * duplicating raw fetch calls.
 */

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmCallOptions {
  system?: string;
  messages: LlmMessage[];
  maxTokens?: number;
}

export interface LlmCallResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  modelId: string;
}

export class LlmClient {
  private readonly apiKey: string;
  private readonly isAnthropic: boolean;
  readonly modelId: string;

  constructor() {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (anthropicKey) {
      this.apiKey = anthropicKey;
      this.isAnthropic = true;
      this.modelId = process.env.LLM_MODEL_ID ?? 'claude-haiku-4-5';
    } else if (openaiKey) {
      this.apiKey = openaiKey;
      this.isAnthropic = false;
      this.modelId = process.env.LLM_MODEL_ID ?? 'gpt-3.5-turbo';
    } else {
      this.apiKey = '';
      this.isAnthropic = true;
      this.modelId = 'claude-haiku-4-5';
    }
  }

  get configured(): boolean {
    return this.apiKey !== '';
  }

  async call(opts: LlmCallOptions): Promise<LlmCallResult> {
    const maxTokens = opts.maxTokens ?? 1024;

    if (this.isAnthropic) {
      return this.callAnthropic(opts, maxTokens);
    }
    return this.callOpenAi(opts, maxTokens);
  }

  private async callAnthropic(
    opts: LlmCallOptions,
    maxTokens: number,
  ): Promise<LlmCallResult> {
    const body: Record<string, unknown> = {
      model: this.modelId,
      max_tokens: maxTokens,
      messages: opts.messages,
    };
    if (opts.system) body.system = opts.system;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as {
      content: Array<{ text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    return {
      content: data.content[0]?.text ?? '',
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      modelId: this.modelId,
    };
  }

  private async callOpenAi(
    opts: LlmCallOptions,
    maxTokens: number,
  ): Promise<LlmCallResult> {
    const messages: LlmMessage[] = opts.system
      ? [{ role: 'user', content: opts.system }, ...opts.messages]
      : opts.messages;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.modelId,
        messages,
        max_tokens: maxTokens,
      }),
    });

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content ?? '',
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      modelId: this.modelId,
    };
  }
}

// Singleton — constructed once per process.
export const llmClient = new LlmClient();
