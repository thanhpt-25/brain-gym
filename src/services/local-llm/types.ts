import { Difficulty, QuestionType } from "@/types/api-types";

export type LocalLlmDialect = "openai" | "anthropic" | "ollama";

export interface LocalLlmConfig {
  dialect: LocalLlmDialect;
  baseUrl: string;
  modelId: string;
  apiKey?: string;
}

export interface LocalModelInfo {
  id: string;
  name: string;
}

export type ConnectionTestResult =
  | { ok: true; models: LocalModelInfo[] }
  | {
      ok: false;
      reason: "cors" | "unreachable" | "wrong_dialect" | "empty";
      hint: string;
    };

export interface LocalGenerationParams {
  certificationName: string;
  certificationCode: string;
  domainName?: string;
  difficulty: Difficulty;
  questionCount: number;
  questionType?: QuestionType;
}
