export interface Question {
  id: string;
  title: string;
  description?: string;
  choices: Choice[];
  correctAnswers: string[]; // choice IDs
  explanation: string;
  referenceUrl?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  domain: string;
  certificationId: string;
}

export interface Choice {
  id: string;
  text: string;
}

export interface Certification {
  id: string;
  provider: string;
  name: string;
  code: string;
  description: string;
  domains: string[];
  questionCount: number;
  timeMinutes: number;
  passingScore: number;
  icon: string;
  color: string;
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
