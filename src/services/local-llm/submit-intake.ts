import type {
  Difficulty,
  GeneratedQuestionPreview,
  QuestionType,
} from "@/types/api-types";
import api from "@/services/api";

export interface IntakeContext {
  certificationId: string;
  domainId?: string;
  difficulty?: Difficulty;
  questionType?: QuestionType;
  /** Model that generated these questions, for provenance tracking. */
  localModelId?: string;
}

export interface IntakeResponse {
  saved: number;
  discarded: number;
  questionIds: string[];
}

export async function submitLocalQuestionsToIntake(
  questions: GeneratedQuestionPreview[],
  context: IntakeContext,
): Promise<IntakeResponse> {
  const payload = {
    questions: questions.map((q) => ({
      question: q.title,
      choices: q.choices,
      explanation: q.explanation || undefined,
      quality_score: q.qualityScore ?? 0.6,
    })),
    certificationId: context.certificationId,
    domainId: context.domainId,
    difficulty: context.difficulty,
    questionType: context.questionType,
    source: "LOCAL_LLM",
    localModelId: context.localModelId,
  };

  const res = await api.post<IntakeResponse>(
    "/ai-questions/intake-browser",
    payload,
  );
  return res.data;
}
