import api from './api';

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterCredentials extends LoginCredentials {
    displayName: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        email: string;
        displayName: string;
        role: string;
    };
}

export const authService = {
    login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
        const response = await api.post<AuthResponse>('/auth/login', credentials);
        return response.data;
    },

    register: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
        const response = await api.post<AuthResponse>('/auth/register', credentials);
        return response.data;
    },

    getProfile: async () => {
        const response = await api.get('/users/me');
        return response.data;
    },
};
