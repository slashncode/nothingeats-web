import { request } from './http';

// /api/identity/v1 (nothingeats-identity-service). The refresh token is an httpOnly cookie scoped
// to /api/identity/v1/sessions; this app never sees it.

export interface User {
    id: string;
    email: string;
    locale: string;
    roles: string[];
    verified: boolean;
}

export interface Session {
    accessToken: string;
    tokenType: string;
    /** Seconds */
    expiresIn: number;
    user: User;
}

export const identity = {
    register: (email: string, password: string, locale: string) =>
        request<{ message: string }>('/api/identity/v1/registrations', {
            method: 'POST',
            body: { email, password, locale },
        }),

    verify: (token: string) =>
        request<void>('/api/identity/v1/verifications', {
            method: 'POST',
            body: { token },
        }),

    login: (email: string, password: string) =>
        request<Session>('/api/identity/v1/sessions', {
            method: 'POST',
            body: { email, password },
        }),

    refresh: () => request<Session>('/api/identity/v1/sessions/refresh', { method: 'POST' }),

    logout: () => request<void>('/api/identity/v1/sessions/current', { method: 'DELETE' }),

    me: () => request<User>('/api/identity/v1/me', { auth: true }),
};
