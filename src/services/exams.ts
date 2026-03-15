import api from './api';

export interface ExamSummary {
    id: string;
    title: string;
    description?: string;
    certificationId: string;
    questionCount: number;
    timeLimit: number;
    visibility: string;
    attemptCount: number;
    certification: {
        id: string;
        name: string;
        code: string;
        provider: string;
    };
    author: {
        id: string;
        displayName: string;
    };
}

export interface PaginatedExams {
    data: ExamSummary[];
    meta: { total: number; page: number; lastPage: number };
}

export interface CreateExamPayload {
    title: string;
    description?: string;
    certificationId: string;
    questionCount: number;
    timeLimit: number;
    visibility?: string;
    questionIds?: string[];
}

export const getExams = async (certificationId?: string, page = 1, limit = 10): Promise<PaginatedExams> => {
    const params = new URLSearchParams();
    if (certificationId) params.append('certificationId', certificationId);
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    const response = await api.get<PaginatedExams>(`/exams?${params.toString()}`);
    return response.data;
};

export const getExamById = async (id: string) => {
    const response = await api.get(`/exams/${id}`);
    return response.data;
};

export const createExam = async (data: CreateExamPayload) => {
    const response = await api.post('/exams', data);
    return response.data;
};
