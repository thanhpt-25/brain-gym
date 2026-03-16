import api from './api';

export interface Tag {
    id: string;
    name: string;
    certificationId?: string;
}

export const getTags = async (certificationId?: string): Promise<Tag[]> => {
    const params = new URLSearchParams();
    if (certificationId) params.append('certificationId', certificationId);

    const response = await api.get<Tag[]>(`/tags?${params.toString()}`);
    return response.data;
};
