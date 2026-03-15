import api from './api';

export interface StartAttemptResponse {
    attemptId: string;
    examId: string;
    title: string;
    certification: {
        id: string;
        name: string;
        code: string;
        provider: string;
        domains?: { id: string; name: string }[];
    };
    timeLimit: number;
    totalQuestions: number;
    questions: AttemptQuestion[];
}

export interface AttemptQuestion {
    id: string;
    title: string;
    description?: string;
    questionType: string;
    difficulty: string;
    domain?: { id: string; name: string };
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
        choices: { id: string; label: string; content: string; isCorrect: boolean }[];
    }[];
}

export const startAttempt = async (examId: string): Promise<StartAttemptResponse> => {
    const response = await api.post<StartAttemptResponse>(`/exams/${examId}/start`);
    return response.data;
};

export const saveAnswer = async (attemptId: string, data: SubmitAnswerPayload) => {
    const response = await api.post(`/attempts/${attemptId}/answer`, data);
    return response.data;
};

export const submitAttempt = async (attemptId: string, data: SubmitAttemptPayload): Promise<AttemptResult> => {
    const response = await api.post<AttemptResult>(`/attempts/${attemptId}/submit`, data);
    return response.data;
};

export const getAttemptResult = async (attemptId: string): Promise<AttemptResult> => {
    const response = await api.get<AttemptResult>(`/attempts/${attemptId}`);
    return response.data;
};

export const getMyAttempts = async (page = 1, limit = 10) => {
    const response = await api.get(`/attempts/me?page=${page}&limit=${limit}`);
    return response.data;
};
