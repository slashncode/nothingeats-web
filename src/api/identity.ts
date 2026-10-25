import { request } from './http';

// /api/identity/v1 (nothingeats-identity-service). The refresh token is an httpOnly cookie scoped
// to /api/identity/v1/sessions; this app never sees it.

export interface User {
    id: string;
    email: string;
    locale: string;
    roles: string[];
    verified: boolean;
    /** The analytics decision kept with the account; null until decided. */
    analyticsConsent?: boolean | null;
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

    requestPasswordReset: (email: string) =>
        request<{ message: string }>('/api/identity/v1/password-resets', {
            method: 'POST',
            body: { email },
        }),

    requestMagicLink: (email: string) =>
        request<{ message: string }>('/api/identity/v1/magic-links', {
            method: 'POST',
            body: { email },
        }),

    loginWithMagicLink: (token: string) =>
        request<Session>('/api/identity/v1/magic-links/sessions', {
            method: 'POST',
            body: { token },
        }),

    exportAccount: () => request<unknown>('/api/identity/v1/me/export', { auth: true }),

    setConsent: (analytics: boolean) =>
        request<User>('/api/identity/v1/me/consent', {
            method: 'PUT',
            body: { analytics },
            auth: true,
        }),

    deleteAccount: (password: string) =>
        request<void>('/api/identity/v1/me/deletion', {
            method: 'POST',
            body: { password },
            auth: true,
        }),

    resetPassword: (token: string, password: string) =>
        request<void>('/api/identity/v1/password-resets/confirmations', {
            method: 'POST',
            body: { token, password },
        }),
};
