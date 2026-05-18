import api from "./api";

export interface ScenarioQuestion {
  id: string;
  order: number;
  title: string;
  choices: Array<{
    id: string;
    label: string;
    content: string;
  }>;
}

export interface Scenario {
  id: string;
  orgId: string;
  passage: string;
  diagramUrl: string | null;
  timeLimit: number;
  questions: ScenarioQuestion[];
}

export interface ScenarioAttemptPayload {
  answers: Record<string, string>;
}

export interface ScenarioAttemptResult {
  attemptId: string;
  scenarioId: string;
  userId: string;
  score: number;
  completedAt: string;
  questionResults: Array<{
    questionId: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
  }>;
  totalQuestions: number;
  correctCount: number;
}

export interface ScenarioProgress {
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
  recentAttempts: Array<{
    id: string;
    scenarioId: string;
    score: number;
    attemptedAt: string;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  userId: string;
  score: number;
  timeSpent: number;
  completedAt: string;
}

export const getScenario = async (scenarioId: string): Promise<Scenario> => {
  const response = await api.get(`/scenarios/${scenarioId}`);
  return response.data;
};

export const submitScenarioAttempt = async (
  scenarioId: string,
  answers: Record<string, string>,
): Promise<ScenarioAttemptResult> => {
  const response = await api.post(`/scenarios/${scenarioId}/attempts`, {
    answers,
  });
  return response.data;
};

export const getUserScenarioProgress = async (): Promise<ScenarioProgress> => {
  const response = await api.get("/user/scenarios/progress");
  return response.data;
};

export const getScenarioLeaderboard = async (
  scenarioId: string,
): Promise<LeaderboardEntry[]> => {
  const response = await api.get(`/scenarios/${scenarioId}/leaderboard`);
  return response.data;
};
