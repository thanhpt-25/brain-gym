import { Difficulty, LlmProvider, QuestionType } from '@prisma/client';

export const AI_GEN_QUEUE = 'ai-gen';

export interface AiGenJobData {
  jobId: string;
  userId: string;
  certificationId: string;
  domainId?: string;
  materialId?: string;
  provider: LlmProvider;
  encryptedApiKey: string;
  modelId?: string;
  difficulty: Difficulty;
  questionCount: number;
  questionType?: QuestionType;
}
