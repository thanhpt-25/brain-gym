import api from './api';
import { Certification } from '@/types/api-types';

export const getCertifications = async (): Promise<Certification[]> => {
    const response = await api.get<Certification[]>('/certifications');
    return Array.isArray(response.data) ? response.data : [];
};

export const getCertificationById = async (id: string): Promise<Certification> => {
    const response = await api.get<Certification>(`/certifications/${id}`);
    return response.data;
};
