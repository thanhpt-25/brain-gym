import { Difficulty } from '@prisma/client';
import { RawGeneratedQuestion } from '../providers/llm-provider.interface';

const DIFFICULTY_CRITERIA: Record<Difficulty, string> = {
  [Difficulty.EASY]: `These are EASY difficulty questions — evaluate quality, not complexity.
- 0.85–1.0 (HIGH): Clear recall question, factually accurate, unambiguous correct answer, distractors plausible but wrong.
- 0.60–0.84 (MEDIUM): Minor clarity issues or slightly obvious distractors, but factually sound.
- 0.00–0.59 (LOW): Reject. Factually wrong, ambiguous correct answer, all distractors obviously wrong, or missing explanation.`,
  [Difficulty.MEDIUM]: `These are MEDIUM difficulty questions — evaluate both quality and depth.
- 0.85–1.0 (HIGH): Scenario-based reasoning, plausible distractors, unambiguously correct answer, clear explanation.
- 0.60–0.84 (MEDIUM): Minor clarity issues or slightly weak distractors, but fundamentally sound.
- 0.00–0.59 (LOW): Reject. Factually questionable, trivially easy distractors, ambiguous answer, or poor explanation.`,
  [Difficulty.HARD]: `These are HARD difficulty questions — evaluate complexity and depth rigorously.
- 0.85–1.0 (HIGH): Complex multi-step reasoning or subtle trade-offs, highly plausible distractors, unambiguous correct answer, thorough explanation.
- 0.60–0.84 (MEDIUM): Somewhat complex but distractors could be stronger or reasoning slightly shallow.
- 0.00–0.59 (LOW): Reject. Not actually hard, distractors obviously wrong, ambiguous answer, or missing explanation.`,
};

export function buildCriticSystemPrompt(
  difficulty: Difficulty = Difficulty.MEDIUM,
): string {
  return `You are a certification exam quality reviewer. Evaluate each question and return a numeric confidence score from 0.0 to 1.0.

${DIFFICULTY_CRITERIA[difficulty]}

Do NOT penalise a question for being simple if it matches the intended difficulty level.
You MUST respond with valid JSON only — no markdown, no extra text.`;
}

export function buildCriticUserPrompt(
  questions: RawGeneratedQuestion[],
): string {
  return `Review these ${questions.length} exam questions and score each one.

Questions:
${JSON.stringify(questions, null, 2)}

Return a JSON object with this exact schema:
{
  "results": [
    {
      "index": 0,
      "score": 0.92,
      "feedback": "Brief reason for the score"
    }
  ]
}`;
}
