import api from './api';
import { Question, PaginatedResponse } from '@/types/api-types';

export type PaginatedQuestions = PaginatedResponse<Question>;

export const getQuestions = async (certificationId?: string, page = 1, limit = 10, isTrapQuestion?: boolean, status?: string): Promise<PaginatedQuestions> => {
    const params = new URLSearchParams();
    if (certificationId) params.append('certificationId', certificationId);
    if (isTrapQuestion !== undefined) params.append('isTrapQuestion', isTrapQuestion.toString());
    if (status) params.append('status', status);
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

export const updateQuestionStatus = async (id: string, status: string): Promise<Question> => {
    const response = await api.put<Question>(`/questions/${id}/status`, { status });
    return response.data;
};
