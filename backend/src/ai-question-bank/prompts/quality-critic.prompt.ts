import { Difficulty } from '@prisma/client';
import { RawGeneratedQuestion } from '../providers/llm-provider.interface';

const DIFFICULTY_CRITERIA: Record<Difficulty, string> = {
  [Difficulty.EASY]: `These are EASY difficulty questions — they must still read like real exam items (a short, concrete situation testing ONE concept), just simpler than MEDIUM. Evaluate quality and exam realism, not complexity.
- 0.85–1.0 (HIGH): Brief realistic situation testing a single concept, factually accurate, unambiguous correct answer, distractors are plausible adjacent options or common misconceptions.
- 0.60–0.84 (MEDIUM): Minor clarity issues or slightly obvious distractors, but factually sound and well-structured.
- 0.00–0.59 (LOW): Reject. A bare definition / one-line "What is X?" with no context, factually wrong, ambiguous correct answer, all distractors obviously wrong, or missing/shallow explanation.`,
  [Difficulty.MEDIUM]: `These are MEDIUM difficulty questions — evaluate applied reasoning and scenario quality.
- 0.85–1.0 (HIGH): Realistic scenario with clear business/technical constraint, BEST-answer framing ("MOST cost-effective" etc.), plausible distractors that are valid solutions to a different problem.
- 0.60–0.84 (MEDIUM): Scenario present but constraint is vague, or distractors are somewhat weak, but fundamentally sound.
- 0.00–0.59 (LOW): Reject. No real scenario, distractors obviously wrong, ambiguous answer, or explanation fails to address why wrong answers are wrong.`,
  [Difficulty.HARD]: `These are HARD difficulty questions — evaluate multi-constraint reasoning rigorously.
- 0.85–1.0 (HIGH): Multiple simultaneous constraints (cost + compliance + performance), distractors each satisfy some but not all constraints, thorough explanation addresses every trade-off.
- 0.60–0.84 (MEDIUM): Somewhat complex but constraints could be sharper or distractors slightly too easy to eliminate.
- 0.00–0.59 (LOW): Reject. Not actually hard, distractors obviously wrong, ambiguous answer, difficulty relies on obscure trivia rather than reasoning, or missing explanation.`,
};

export function buildCriticSystemPrompt(
  difficulty: Difficulty = Difficulty.MEDIUM,
): string {
  return `You are a certification exam quality reviewer. Score each question from 0.0 to 1.0.

## Scoring Criteria (difficulty-specific)
${DIFFICULTY_CRITERIA[difficulty]}

## Structural Checks (apply to ALL difficulties — deduct 0.10–0.20 per issue found)
- Options are NOT grammatically parallel or vary wildly in length (correct answer noticeably longer)
- The explanation is not in Markdown: it should bold the correct answer (e.g. **✅ Correct — X:** ...) and list each wrong option with its distractor-type label (e.g. - **Y** (near-miss): ...)
- The explanation does NOT explain why EACH wrong answer specifically fails
- The stem contains inadvertent clues that point to the correct answer (article/tense/length asymmetry)
- "All of the above", "None of the above", or nested sub-lists appear in options
- Two or more options are arguably correct for SINGLE-choice questions
- The question is a bare one-liner that lacks the concrete context (numbers, named technologies, constraints) a candidate needs — situational context belongs inline in the question text, not necessarily in a separate scenario field

## Instructions
- Do NOT penalise a question for being simple if it matches the intended difficulty level.
- Apply structural deductions on top of the content score.
- You MUST respond with valid JSON only — no markdown, no extra text.`;
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
      "feedback": "Brief reason for the score, noting any structural issues found"
    }
  ]
}`;
}
