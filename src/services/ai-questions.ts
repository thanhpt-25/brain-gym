import api from "./api";
import {
  LlmConfig,
  LlmProvider,
  SourceMaterial,
  GenerationResult,
  JobStatusResult,
  TokenEstimate,
  GenerationJob,
  GeneratedQuestionPreview,
} from "../types/api-types";
import { Difficulty, QuestionType } from "../types/api-types";

// ─── LLM Config ──────────────────────────────────────────────────────────────

export const getLlmConfigs = async (): Promise<LlmConfig[]> => {
  const res = await api.get<LlmConfig[]>("/ai-questions/config");
  return res.data;
};

export const saveLlmConfig = async (payload: {
  provider: LlmProvider;
  apiKey: string;
  modelId?: string;
}): Promise<LlmConfig> => {
  const res = await api.post<LlmConfig>("/ai-questions/config", payload);
  return res.data;
};

export const deleteLlmConfig = async (provider: LlmProvider): Promise<void> => {
  await api.delete(`/ai-questions/config/${provider}`);
};

export const validateLlmConfig = async (
  provider: LlmProvider,
): Promise<{ valid: boolean }> => {
  const res = await api.post<{ valid: boolean }>(
    `/ai-questions/config/${provider}/validate`,
  );
  return res.data;
};

// ─── Materials ───────────────────────────────────────────────────────────────

export const getMaterials = async (
  certificationId?: string,
): Promise<SourceMaterial[]> => {
  const res = await api.get<SourceMaterial[]>("/ai-questions/materials", {
    params: certificationId ? { certificationId } : {},
  });
  return res.data;
};

export const uploadTextMaterial = async (payload: {
  title: string;
  contentType: "TEXT" | "URL";
  certificationId?: string;
  textContent?: string;
  sourceUrl?: string;
}): Promise<SourceMaterial> => {
  const res = await api.post<SourceMaterial>(
    "/ai-questions/materials",
    payload,
  );
  return res.data;
};

export const uploadPdfMaterial = async (
  file: File,
  title: string,
  certificationId?: string,
): Promise<SourceMaterial> => {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);
  form.append("contentType", "PDF");
  if (certificationId) form.append("certificationId", certificationId);

  const res = await api.post<SourceMaterial>(
    "/ai-questions/materials/pdf",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return res.data;
};

export const deleteMaterial = async (id: string): Promise<void> => {
  await api.delete(`/ai-questions/materials/${id}`);
};

// ─── Generation ──────────────────────────────────────────────────────────────

export const estimateTokens = async (payload: {
  provider: LlmProvider;
  certificationId: string;
  domainId?: string;
  materialId?: string;
  difficulty?: Difficulty;
  questionType?: QuestionType;
  questionCount: number;
}): Promise<TokenEstimate> => {
  const res = await api.post<TokenEstimate>("/ai-questions/estimate", payload);
  return res.data;
};

export const generateQuestions = async (payload: {
  provider: LlmProvider;
  certificationId: string;
  domainId?: string;
  materialId?: string;
  difficulty?: Difficulty;
  questionType?: QuestionType;
  questionCount: number;
}): Promise<GenerationResult> => {
  const res = await api.post<GenerationResult>(
    "/ai-questions/generate",
    payload,
  );
  return res.data;
};

export const getJobStatus = async (jobId: string): Promise<JobStatusResult> => {
  const res = await api.get<JobStatusResult>(`/ai-questions/jobs/${jobId}`);
  return res.data;
};

export const saveGeneratedQuestions = async (payload: {
  jobId: string;
  certificationId: string;
  domainId?: string;
  questions: (Omit<GeneratedQuestionPreview, "qualityTier"> & {
    sourceChunkId?: string;
  })[];
}): Promise<{ saved: number; discarded: number; questionIds: string[] }> => {
  const res = await api.post("/ai-questions/save", payload);
  return res.data;
};

// ─── History ─────────────────────────────────────────────────────────────────

export const getGenerationHistory = async (
  page = 1,
  limit = 10,
): Promise<{
  data: GenerationJob[];
  meta: { total: number; page: number; lastPage: number };
}> => {
  const res = await api.get("/ai-questions/history", {
    params: { page, limit },
  });
  return res.data;
};
