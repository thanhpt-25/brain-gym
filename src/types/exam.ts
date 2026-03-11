export enum QuestionType {
  SINGLE = 'SINGLE',
  MULTIPLE = 'MULTIPLE',
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export interface Choice {
  id: string;
  label: string; // 'a', 'b', 'c', 'd'
  content: string;
  isCorrect: boolean;
  sortOrder?: number;
}

export interface Question {
  id: string;
  title: string;
  description?: string;
  questionType?: QuestionType;
  choices: Choice[];
  explanation: string;
  referenceUrl?: string;
  difficulty: Difficulty | 'EASY' | 'MEDIUM' | 'HARD';
  tags?: any[];
  domainId?: string;
  domain?: { id: string; name: string };
  certificationId: string;
}

export interface Certification {
  id: string;
  provider: string;
  name: string;
  code: string;
  description: string;
  domains?: { id: string; name: string }[];
  questionCount?: number;
  timeMinutes?: number;
  passingScore?: number;
  icon?: string;
  color?: string;
}

export interface MockExam {
  id: string;
  title: string;
  certificationId: string;
  questions: Question[];
  timeMinutes: number;
  createdBy: string;
  isPublic: boolean;
}

export interface ExamAttempt {
  examId: string;
  answers: Record<string, string[]>; // questionId -> selected choiceIds
  markedForReview: Set<string>;
  startTime: number;
  endTime?: number;
}

export interface ExamResult {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  domainBreakdown: Record<string, { correct: number; total: number }>;
  questionResults: {
    questionId: string;
    correct: boolean;
    selectedAnswers: string[];
    correctAnswers: string[];
  }[];
  timeTaken: number;
}
