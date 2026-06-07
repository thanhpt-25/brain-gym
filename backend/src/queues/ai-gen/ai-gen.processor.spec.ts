import { Difficulty, QuestionType } from '@prisma/client';
import {
  buildFewShotExample,
  isNewFormatExplanation,
  mapRawToPreview,
} from './ai-gen.processor';

const NEW_FORMAT_EXPLANATION =
  '**✅ Correct — A:** because.\n\n**Why the other options are wrong:**\n- **B** (near-miss): nope.';
const LEGACY_EXPLANATION =
  '[Correct] A: because. [Wrong-B: near-miss] B: nope.';

describe('mapRawToPreview', () => {
  const baseRaw = {
    question: 'A team needs a managed queue. Which service should they use?',
    options: ['A. SQS', 'B. S3', 'C. EC2', 'D. IAM'],
    correct_answer: 'A',
    explanation: NEW_FORMAT_EXPLANATION,
    tags: ['messaging'],
  };

  it('maps an ordinary question with no scenario to description=null, isScenario=false', () => {
    const preview = mapRawToPreview(
      baseRaw,
      0.9,
      QuestionType.SINGLE,
      Difficulty.EASY,
    );

    expect(preview.title).toBe(baseRaw.question);
    expect(preview.description).toBeNull();
    expect(preview.isScenario).toBe(false);
    expect(preview.qualityTier).toBe('HIGH');
    expect(preview.choices).toHaveLength(4);
    expect(preview.choices[0]).toEqual({
      label: 'A',
      content: 'SQS',
      isCorrect: true,
    });
  });

  it('captures a scenario passage into description and flags isScenario', () => {
    const preview = mapRawToPreview(
      {
        ...baseRaw,
        scenario: '  A long technical context passage.  ',
        is_scenario: true,
      },
      0.7,
      QuestionType.SINGLE,
      Difficulty.HARD,
    );

    expect(preview.description).toBe('A long technical context passage.');
    expect(preview.isScenario).toBe(true);
    expect(preview.qualityTier).toBe('MEDIUM');
  });

  it('treats whitespace-only scenario as absent', () => {
    const preview = mapRawToPreview(
      { ...baseRaw, scenario: '   ' },
      0.5,
      QuestionType.SINGLE,
      Difficulty.MEDIUM,
    );

    expect(preview.description).toBeNull();
    expect(preview.isScenario).toBe(false);
    expect(preview.qualityTier).toBeNull();
  });

  it('respects is_scenario=true even without scenario text', () => {
    const preview = mapRawToPreview(
      { ...baseRaw, is_scenario: true },
      0.9,
      QuestionType.SINGLE,
      Difficulty.MEDIUM,
    );

    expect(preview.description).toBeNull();
    expect(preview.isScenario).toBe(true);
  });

  it('infers MULTIPLE type from a comma-separated answer key', () => {
    const preview = mapRawToPreview(
      { ...baseRaw, correct_answer: 'A,C' },
      0.9,
      undefined,
      Difficulty.MEDIUM,
    );

    expect(preview.questionType).toBe(QuestionType.MULTIPLE);
    expect(
      preview.choices.filter((c) => c.isCorrect).map((c) => c.label),
    ).toEqual(['A', 'C']);
  });
});

describe('isNewFormatExplanation', () => {
  it('accepts the current Markdown format', () => {
    expect(isNewFormatExplanation(NEW_FORMAT_EXPLANATION)).toBe(true);
  });

  it('rejects the legacy bracket format', () => {
    expect(isNewFormatExplanation(LEGACY_EXPLANATION)).toBe(false);
  });

  it('rejects null and empty explanations', () => {
    expect(isNewFormatExplanation(null)).toBe(false);
    expect(isNewFormatExplanation('')).toBe(false);
  });
});

describe('buildFewShotExample', () => {
  const choices = [
    { label: 'A', content: 'SQS', isCorrect: true },
    { label: 'B', content: 'S3', isCorrect: false },
  ];

  it('omits the scenario field for ordinary questions', () => {
    const json = buildFewShotExample({
      title: 'Which service is a managed queue?',
      description: null,
      explanation: NEW_FORMAT_EXPLANATION,
      isScenario: false,
      choices,
      tags: [{ tag: { name: 'messaging' } }],
    });
    const parsed = JSON.parse(json);

    expect(parsed.scenario).toBeUndefined();
    expect(parsed.is_scenario).toBe(false);
    expect(parsed.correct_answer).toBe('A');
    expect(parsed.tags).toEqual(['messaging']);
  });

  it('includes the scenario field for true scenario-mode questions', () => {
    const json = buildFewShotExample({
      title: 'Which option fits?',
      description: 'A standalone technical passage.',
      explanation: NEW_FORMAT_EXPLANATION,
      isScenario: true,
      choices,
      tags: [],
    });
    const parsed = JSON.parse(json);

    expect(parsed.scenario).toBe('A standalone technical passage.');
    expect(parsed.is_scenario).toBe(true);
  });
});
