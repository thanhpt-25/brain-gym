export enum QuestionType {
  SINGLE = 'SINGLE',
  MULTIPLE = 'MULTIPLE',
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    lastPage: number;
  };
}

export interface Choice {
  id?: string;
  label: string;
  content: string;
  isCorrect: boolean;
  sortOrder?: number;
}

export interface Domain {
  id: string;
  name: string;
}

export interface Tag {
  id: string;
  name: string;
  tag?: { name: string };
}

export interface Question {
  id: string;
  title: string;
  description?: string;
  questionType: QuestionType | string;
  choices: Choice[];
  isScenario?: boolean;
  isTrapQuestion?: boolean;
  explanation: string;
  referenceUrl?: string;
  difficulty: Difficulty | string;
  tags?: (string | Tag)[];
  domainId?: string;
  domain?: Domain;
  certificationId: string;
}

export interface Certification {
  id: string;
  provider: string;
  name: string;
  code: string;
  description: string;
  domains?: Domain[];
  questionCount?: number;
  timeLimit?: number;
  passingScore?: number;
  icon?: string;
  color?: string;
  isActive: boolean;
}

export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  hint?: string;
  tags: string[];
  isStarred: boolean;
  schedule?: FlashcardReviewSchedule;
  createdAt: string;
}

export interface FlashcardReviewSchedule {
  id: string;
  nextReviewDate: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  mastery: 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED';
}

export interface Deck {
  id: string;
  name: string;
  description?: string;
  certificationId?: string;
  _count?: { flashcards: number };
  certification?: { name: string; code: string };
  createdAt: string;
  flashcards?: Flashcard[];
}

export interface CapturedWord {
  id: string;
  word: string;
  context?: string;
  examAttemptId?: string;
  questionId?: string;
  status: 'pending' | 'processed' | 'discarded';
  createdAt: string;
  question?: { text: string };
}

export interface AnalyticsSummary {
  totalExams: number;
  totalPassed: number;
  passRate: number;
  avgScore: number;
  bestScore: number;
  totalStudyTime: number;
  totalQuestions: number;
}

export interface HistoryItem {
  id: string;
  examTitle: string;
  certification: { id: string; name: string; code: string; provider: string };
  score: number;
  totalCorrect: number;
  totalQuestions: number;
  passed: boolean;
  timeSpent: number;
  domainScores: Record<string, { correct: number; total: number }> | null;
  startedAt: string;
  submittedAt: string;
}

export interface DomainPerformance {
  domain: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface ReadinessScore {
  readinessScore: number;
  domainConfidences: { domain: string; confidence: number }[];
  totalExams: number;
  weightedAvgScore: number;
}

export interface MistakePatterns {
  total: number;
  breakdown: Record<string, number>;
}

export interface StartAttemptResponse {
  attemptId: string;
  examId: string;
  title: string;
  certification: {
    id: string;
    name: string;
    code: string;
    provider: string;
    domains?: Domain[];
  };
  timeLimit: number;
  timerMode?: TimerMode;
  totalQuestions: number;
  questions: AttemptQuestion[];
}

export interface AttemptQuestion {
  id: string;
  title: string;
  description?: string;
  isScenario?: boolean;
  questionType: string;
  difficulty: string;
  domain?: Domain;
  tags: string[];
  choices: { id: string; label: string; content: string }[];
  sortOrder: number;
}

export interface SubmitAnswerPayload {
  questionId: string;
  selectedChoices: string[];
  isMarked?: boolean;
}

export interface SubmitAttemptPayload {
  answers: SubmitAnswerPayload[];
}

export interface AttemptResult {
  attemptId: string;
  examId: string;
  examTitle: string;
  certification: { id: string; name: string; code: string; provider: string };
  status: string;
  score: number;
  totalCorrect: number;
  totalQuestions: number;
  percentage: number;
  domainScores: Record<string, { correct: number; total: number }>;
  timeSpent: number;
  startedAt: string;
  submittedAt: string;
  questionResults: {
    questionId: string;
    title: string;
    description?: string;
    explanation?: string;
    domain: string;
    correct: boolean;
    selectedAnswers: string[];
    correctAnswers: string[];
    choices: Choice[];
  }[];
}

export interface ReviewSchedule {
  id: string;
  userId: string;
  questionId: string;
  nextReviewDate: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  question: Question;
}

export type TimerMode = 'STRICT' | 'ACCELERATED' | 'RELAXED';

export interface ExamSummary {
  id: string;
  title: string;
  description?: string;
  certificationId: string;
  questionCount: number;
  timeLimit: number;
  visibility: string;
  timerMode?: TimerMode;
  attemptCount: number;
  avgScore?: number;
  shareCode?: string;
  createdAt: string;
  certification: {
    id: string;
    name: string;
    code: string;
    provider: string;
  };
  author?: {
    id: string;
    displayName: string;
  };
}

export interface CreateExamPayload {
  title: string;
  description?: string;
  certificationId: string;
  questionCount: number;
  timeLimit: number;
  visibility?: string;
  timerMode?: TimerMode;
  questionIds?: string[];
}

// ─── AI Question Bank ────────────────────────────────────────────────────────

export type LlmProvider = 'OPENAI' | 'ANTHROPIC' | 'GEMINI';
export type QualityTier = 'HIGH' | 'MEDIUM' | 'LOW';
export type GenerationJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type MaterialContentType = 'PDF' | 'URL' | 'TEXT';

export interface LlmConfig {
  id: string;
  provider: LlmProvider;
  modelId?: string;
  isActive: boolean;
  maskedKey: string;
  createdAt: string;
}

export interface SourceMaterial {
  id: string;
  title: string;
  contentType: MaterialContentType;
  certificationId?: string;
  sourceUrl?: string;
  chunkCount: number;
  status: string;
  createdAt: string;
  _count: { chunks: number };
}

export interface GeneratedQuestionPreview {
  title: string;
  description?: string;
  questionType: QuestionType;
  difficulty: Difficulty;
  explanation: string;
  choices: { label: string; content: string; isCorrect: boolean }[];
  tags?: string[];
  isScenario?: boolean;
  isTrapQuestion?: boolean;
  sourcePassage?: string;
  qualityScore: number;
  qualityTier: QualityTier | null;
}

export interface GenerationResult {
  jobId: string;
  questions: GeneratedQuestionPreview[];
  tokenUsage: { prompt: number; completion: number };
}

export interface TokenEstimate {
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  totalEstimatedTokens: number;
}

export interface GenerationJob {
  id: string;
  provider: LlmProvider;
  modelId?: string;
  difficulty: Difficulty;
  questionCount: number;
  status: GenerationJobStatus;
  promptTokens?: number;
  completionTokens?: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  certification: { name: string; code: string };
  domain?: { name: string };
  _count: { questions: number };
}
