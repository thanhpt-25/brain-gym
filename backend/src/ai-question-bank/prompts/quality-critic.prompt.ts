import { RawGeneratedQuestion } from '../providers/llm-provider.interface';

export function buildCriticSystemPrompt(): string {
  return `You are a certification exam quality reviewer. Evaluate each question and return a numeric confidence score from 0.0 to 1.0.

Scoring criteria:
- 0.85–1.0 (HIGH): Exam-ready. Realistic scenario, plausible distractors, unambiguously correct answer, clear explanation.
- 0.60–0.84 (MEDIUM): Needs minor review. Minor clarity issues or slightly weak distractors, but fundamentally sound.
- 0.00–0.59 (LOW): Reject. Factually questionable, trivially easy distractors, ambiguous correct answer, or poor explanation.

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
