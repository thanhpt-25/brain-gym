export enum QuestionType {
  SINGLE = "SINGLE",
  MULTIPLE = "MULTIPLE",
}

export enum Difficulty {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
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
  certification?: {
    id: string;
    name: string;
    code: string;
    provider?: { id: string; name: string; slug: string };
  };
}

export interface Certification {
  id: string;
  providerId: string;
  provider?: { id: string; name: string; slug: string; logoUrl?: string };
  name: string;
  code: string;
  description: string;
  domains?: Domain[];
  questionCount?: number;
  timeLimit?: number;
  passingScore?: number;
  /** Vendor exam format, e.g. { questionCount, durationMinutes }. */
  examFormat?: { questionCount?: number; durationMinutes?: number } | null;
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
  mastery: "NEW" | "LEARNING" | "REVIEW" | "MASTERED";
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
  status: "pending" | "processed" | "discarded";
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
  certification: {
    id: string;
    name: string;
    code: string;
    provider?: { id: string; name: string; slug: string };
  };
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
    provider?: { id: string; name: string; slug: string };
    domains?: Domain[];
  };
  timeLimit: number;
  timerMode?: TimerMode;
  /** Practice exams only; FULL_MOCK hides difficulty/domain labels. */
  practiceMode?: PracticeMode | null;
  /** Missing on responses from older backends — treat as END_OF_EXAM. */
  feedbackMode?: FeedbackMode;
  totalQuestions: number;
  /** Server deadline (ISO). Missing on older backends — fall back to timeLimit. */
  expiresAt?: string | null;
  /** Server clock when the response was built, to correct client clock skew. */
  serverNow?: string;
  questions: AttemptQuestion[];
}

export interface AttemptQuestion {
  id: string;
  title: string;
  description?: string;
  isScenario?: boolean;
  codeSnippet?: string | null;
  imageUrl?: string | null;
  /** MULTIPLE questions only: how many choices the answer needs ("Choose 2"). */
  selectCount?: number;
  questionType: string;
  /** null in a full mock exam, which hides labels like the real exam. */
  difficulty: string | null;
  domain?: Domain | null;
  tags: string[];
  choices: { id: string; label: string; content: string }[];
  sortOrder: number;
}

/** GET /attempts/:id/state — everything needed to resume an attempt. */
export interface AttemptState extends Partial<StartAttemptResponse> {
  attemptId: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "ABANDONED";
  answers?: {
    questionId: string;
    selectedChoices: string[];
    isMarked: boolean;
    timeSpent?: number;
  }[];
  checked?: CheckAnswerResponse[];
}

/** GET /attempts/active — the attempt the learner can pick back up. */
export interface ActiveAttemptSummary {
  attemptId: string;
  examId: string;
  certificationId: string;
  title: string;
  timerMode: TimerMode;
  feedbackMode: FeedbackMode;
  answeredCount: number;
  totalQuestions: number;
  startedAt: string;
  expiresAt: string | null;
}

export interface SubmitAnswerPayload {
  questionId: string;
  selectedChoices: string[];
  isMarked?: boolean;
  /** Total seconds spent on the question so far. */
  timeSpent?: number;
}

export interface SubmitAttemptPayload {
  answers: SubmitAnswerPayload[];
}

/** Response of POST /attempts/:id/check (INTERACTIVE mode). */
export interface CheckAnswerResponse {
  questionId: string;
  isCorrect: boolean;
  selectedChoiceIds: string[];
  correctChoiceIds: string[];
  explanation: string | null;
  checkedAt: string;
}

export type MistakeType = "CONCEPT" | "CARELESS" | "TRAP" | "TIME_PRESSURE";

export interface AttemptResult {
  attemptId: string;
  examId: string;
  examTitle: string;
  certification: {
    id: string;
    name: string;
    code: string;
    provider?: { id: string; name: string; slug: string };
  };
  status: string;
  feedbackMode?: FeedbackMode;
  score: number;
  totalCorrect: number;
  totalQuestions: number;
  percentage: number;
  /** Certification pass mark (%). Missing on older backends. */
  passingScore?: number;
  passed?: boolean;
  /** Seconds per question needed to finish on time. */
  targetSecondsPerQuestion?: number | null;
  domainScores: Record<string, { correct: number; total: number }>;
  timeSpent: number;
  startedAt: string;
  submittedAt: string;
  questionResults: {
    questionId: string;
    title: string;
    description?: string;
    codeSnippet?: string;
    imageUrl?: string;
    explanation?: string;
    domain: string;
    correct: boolean;
    checkedAt?: string;
    timeSpent?: number;
    mistakeType?: MistakeType;
    /** Hint from the time spent on a wrong answer. */
    suggestedMistakeType?: MistakeType;
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

export type TimerMode = "STRICT" | "ACCELERATED" | "RELAXED" | "TIME_PRESSURE";

/** END_OF_EXAM: grade on submit. INTERACTIVE: reveal each answer + explanation on check. */
export type FeedbackMode = "END_OF_EXAM" | "INTERACTIVE";

/** Kind of auto-generated practice exam. */
export type PracticeMode =
  | "STANDARD"
  | "QUICK_DRILL"
  | "FULL_MOCK"
  | "REVIEW"
  | "ADAPTIVE";

/** GET /attempts/:id/insights — next steps after an attempt. */
export interface AttemptInsights {
  attemptId: string;
  certificationId: string;
  missedCount: number;
  skippedCount: number;
  flaggedCount: number;
  domains: {
    domainId: string;
    name: string;
    correct: number;
    total: number;
    percentage: number;
  }[];
  weakestDomain: {
    domainId: string;
    name: string;
    percentage: number;
  } | null;
  /** Oldest first. */
  trend: {
    attemptId: string;
    submittedAt: string | null;
    score: number;
    domainScores: Record<string, { correct: number; total: number }>;
  }[];
  readiness: {
    ability: number;
    standardError: number;
    basedOnQuestions: number;
    /** Estimated % chance to pass; null without history. */
    passLikelihood: number | null;
    passingScore: number;
    examLength: number;
  };
}

export type ExamMode = "STANDARD" | "TIME_PRESSURE";

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
    provider?: { id: string; name: string; slug: string };
  };
  author?: {
    id: string;
    displayName: string;
  };
}

export interface ExamBlueprint {
  byDifficulty?: {
    EASY?: number;
    MEDIUM?: number;
    HARD?: number;
  };
  /** Quota per domain — keys are domainId, values are absolute question counts.
   *  Mutually exclusive with byDifficulty. */
  byDomain?: Record<string, number>;
}

export type ExamSelectionStrategy = "MANUAL" | "RANDOM" | "BLUEPRINT";

export interface CreateExamPayload {
  title: string;
  description?: string;
  certificationId: string;
  questionCount: number;
  timeLimit: number;
  visibility?: string;
  timerMode?: TimerMode;
  examType?: ExamMode;
  questionIds?: string[];
  selectionStrategy?: ExamSelectionStrategy;
  blueprint?: ExamBlueprint;
}

// ─── AI Question Bank ────────────────────────────────────────────────────────

export type LlmProvider = "OPENAI" | "ANTHROPIC" | "GEMINI";
export type QualityTier = "HIGH" | "MEDIUM" | "LOW";
export type GenerationJobStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";
export type MaterialContentType = "PDF" | "URL" | "TEXT" | "DOCX" | "PPTX" | "XLSX";

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
  certification?: { code: string };
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
  status: GenerationJobStatus;
}

export interface JobStatusResult {
  jobId: string;
  status: GenerationJobStatus;
  questions?: GeneratedQuestionPreview[];
  tokenUsage?: { prompt: number; completion: number };
  errorMessage?: string;
}

export interface TokenEstimate {
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  totalEstimatedTokens: number;
}

export interface GenerationJob {
  id: string;
  certificationId: string;
  domainId?: string;
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

export interface McpApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface McpApiKeyCreated extends McpApiKey {
  plaintext: string;
}
