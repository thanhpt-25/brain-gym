export const SCENARIO_GENERATION_QUEUE = 'SCENARIO_GENERATION';

export interface ScenarioGenerationJobData {
  scenarioId: string;
  topic: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  orgId: string;
  userId: string;
}

export interface ScenarioGenerationJobResult {
  scenarioId: string;
  passage: string;
  diagram?: string;
  questions: Array<{
    question: string;
    correctAnswer: string;
    distractors: string[];
    reasoning: string;
  }>;
  tokensUsed: number;
  costUsd: number;
}
