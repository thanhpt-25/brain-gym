import api from './api';
import {
    StartAttemptResponse,
    AttemptQuestion,
    SubmitAnswerPayload,
    SubmitAttemptPayload,
    AttemptResult
} from '@/types/api-types';

export type { StartAttemptResponse, AttemptQuestion, SubmitAnswerPayload, SubmitAttemptPayload, AttemptResult };

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

export const finishAttempt = async (attemptId: string): Promise<AttemptResult> => {
    const response = await api.post<AttemptResult>(`/attempts/${attemptId}/finish`);
    return response.data;
};
