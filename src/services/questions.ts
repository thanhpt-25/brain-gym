import api from './api';
import { Question } from '@/types/exam';

export interface PaginatedQuestions {
    data: Question[];
    meta: {
        total: number;
        page: number;
        lastPage: number;
    };
}

export const getQuestions = async (certificationId?: string, page = 1, limit = 10): Promise<PaginatedQuestions> => {
    const params = new URLSearchParams();
    if (certificationId) params.append('certificationId', certificationId);
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const response = await api.get<PaginatedQuestions>(`/questions?${params.toString()}`);
    return response.data;
};

export const getQuestionById = async (id: string): Promise<Question> => {
    const response = await api.get<Question>(`/questions/${id}`);
    return response.data;
};

export const createQuestion = async (data: Partial<Question>): Promise<Question> => {
    const response = await api.post<Question>('/questions', data);
    return response.data;
};

export const voteQuestion = async (id: string, value: number): Promise<Question> => {
    const response = await api.post<Question>(`/questions/${id}/vote?value=${value}`);
    return response.data;
};
