import { Difficulty, QuestionType } from '@prisma/client';

export interface GenerationParams {
  certificationName: string;
  certificationCode: string;
  domainName?: string;
  difficulty: Difficulty;
  questionCount: number;
  questionType?: QuestionType;
  sourceChunks?: string[];
}

export interface GeneratedChoice {
  label: string;
  content: string;
  isCorrect: boolean;
}

export interface RawGeneratedQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  source_passage?: string;
  confidence_hint?: 'high' | 'medium' | 'low';
}

export interface GeneratedQuestion {
  title: string;
  description?: string;
  questionType: QuestionType;
  difficulty: Difficulty;
  explanation: string;
  choices: GeneratedChoice[];
  tags?: string[];
  isScenario?: boolean;
  isTrapQuestion?: boolean;
  sourcePassage?: string;
  qualityScore?: number;
}

export interface CriticResult {
  scores: number[];
  feedback: string[];
}

export interface TokenEstimate {
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
}

export interface LlmProviderInterface {
  generateRaw(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{
    content: string;
    promptTokens: number;
    completionTokens: number;
  }>;
  validateApiKey(): Promise<boolean>;
  estimateTokens(params: GenerationParams): TokenEstimate;
}
