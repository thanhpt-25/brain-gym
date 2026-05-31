import { z } from "zod";

// Mirror of the prompt schema the LLM is asked to return.
// options is "A. some text" | "B. some text" etc.
export const RawQuestionSchema = z.object({
  question: z.string().min(5),
  options: z.array(z.string().min(1)).min(2).max(8),
  correct_answer: z.string().min(1),
  explanation: z.string().optional().default(""),
  source_passage: z.string().optional(),
  confidence_hint: z
    .enum(["high", "medium", "low"])
    .optional()
    .default("medium"),
});

export const RawQuestionsResponseSchema = z.object({
  questions: z.array(RawQuestionSchema).min(1),
});

export type RawQuestion = z.infer<typeof RawQuestionSchema>;
