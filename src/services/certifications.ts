import api from './api';
import { Certification } from '@/types/api-types';

export interface CreateCertificationPayload {
    name: string;
    providerId: string;
    code: string;
    description?: string;
    domains?: string[];
}

export interface UpdateCertificationPayload extends Partial<CreateCertificationPayload> {
    isActive?: boolean;
}

export const getCertifications = async (includeInactive?: boolean | unknown): Promise<Certification[]> => {
    const inactive = typeof includeInactive === 'boolean' ? includeInactive : false;
    const response = await api.get<Certification[]>(`/certifications?includeInactive=${inactive}`);
    return Array.isArray(response.data) ? response.data : [];
};

export const getCertificationById = async (id: string): Promise<Certification> => {
    const response = await api.get<Certification>(`/certifications/${id}`);
    return response.data;
};

export const createCertification = async (data: CreateCertificationPayload): Promise<Certification> => {
    const response = await api.post<Certification>('/certifications', data);
    return response.data;
};

export const updateCertification = async (id: string, data: UpdateCertificationPayload): Promise<Certification> => {
    const response = await api.put<Certification>(`/certifications/${id}`, data);
    return response.data;
};

export const deleteCertification = async (id: string): Promise<Certification> => {
    const response = await api.delete<Certification>(`/certifications/${id}`);
    return response.data;
};
