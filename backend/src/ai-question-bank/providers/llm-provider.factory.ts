import { LlmProvider } from '@prisma/client';
import { LlmProviderInterface } from './llm-provider.interface';
import { OpenAiProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';

export function createLlmProvider(
  provider: LlmProvider,
  apiKey: string,
  modelId?: string,
): LlmProviderInterface {
  switch (provider) {
    case LlmProvider.OPENAI:
      return new OpenAiProvider(apiKey, modelId);
    case LlmProvider.ANTHROPIC:
      return new AnthropicProvider(apiKey, modelId);
    case LlmProvider.GEMINI:
      return new GeminiProvider(apiKey, modelId);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}
