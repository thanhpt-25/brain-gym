import { Difficulty, QuestionType } from "@/types/api-types";
import type { LocalGenerationParams } from "./types";

// Mirrors backend/src/ai-question-bank/prompts/question-generation.prompt.ts
// so both cloud and local paths produce questions in the same format.

export function buildLocalSystemPrompt(): string {
  return `You are an expert certification exam question writer. Your job is to create high-quality, exam-realistic multiple-choice questions.

Rules:
- Questions must be factually accurate.
- Distractors (wrong answers) must be plausible — not obviously wrong.
- Correct answers must be unambiguously correct.
- Explanations must clearly justify why the correct answer is right and why the distractors are wrong.
- You MUST respond with valid JSON only — no markdown, no extra text.`;
}

export function buildLocalUserPrompt(params: LocalGenerationParams): string {
  const difficultyGuide: Record<Difficulty, string> = {
    [Difficulty.EASY]: "straightforward recall and basic understanding",
    [Difficulty.MEDIUM]: "application of concepts and scenario-based reasoning",
    [Difficulty.HARD]:
      "complex multi-step reasoning, architecture trade-offs, or subtle distinctions",
  };

  const typeGuide =
    params.questionType === QuestionType.MULTIPLE
      ? "MULTIPLE choice (2-3 correct answers out of 5-6 options)"
      : "SINGLE choice (exactly 1 correct answer out of 4 options)";

  return `Generate ${params.questionCount} ${typeGuide} questions for the **${params.certificationName} (${params.certificationCode})** certification exam.
${params.domainName ? `Domain/Topic: ${params.domainName}` : ""}
Difficulty: ${params.difficulty} — focus on ${difficultyGuide[params.difficulty]}.

Return a JSON object with this exact schema:
{
  "questions": [
    {
      "question": "Full question text",
      "options": ["A. Option text", "B. Option text", "C. Option text", "D. Option text"],
      "correct_answer": "A",
      "explanation": "Detailed explanation of why the answer is correct and others are wrong",
      "source_passage": "Optional: passage the question is based on",
      "confidence_hint": "high"
    }
  ]
}

For MULTIPLE choice, correct_answer is comma-separated like "A,C".
confidence_hint must be one of: "high", "medium", "low" — your estimate of question quality.`;
}
