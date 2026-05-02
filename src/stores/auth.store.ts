import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useOrgStore } from './org.store';

interface OrgMembership {
    orgId: string;
    slug: string;
    name: string;
    role: string;
}

interface User {
    id: string;
    email: string;
    displayName: string;
    role: string;
    plan: string;
    orgMemberships: OrgMembership[];
}

interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;

    // Actions
    setAuth: (user: User, accessToken: string, refreshToken: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,

            setAuth: (user, accessToken, refreshToken) =>
                set({
                    user,
                    accessToken,
                    refreshToken,
                    isAuthenticated: true,
                }),

            logout: () => {
                useOrgStore.getState().clearOrg();
                set({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                });
            },
        }),
        {
            name: 'auth-storage', // name of the item in the storage (must be unique)
            // Only persist tokens and user info, nothing else.
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                isAuthenticated: state.isAuthenticated
            }),
        }
    )
);
