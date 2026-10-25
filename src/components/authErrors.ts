import type { TFunction } from 'i18next';

import { ApiError } from '../api/http';

/** The localized message for an API error code, or a generic one. */
export function authErrorMessage(t: TFunction, error: unknown): string {
    const code = error instanceof ApiError
        ? error.code
        : 'generic';
    // For TOO_MANY_ATTEMPTS: the wait from Retry-After, rounded up to whole minutes.
    const minutes = error instanceof ApiError && error.retryAfterSeconds
        ? Math.ceil(error.retryAfterSeconds / 60)
        : 1;
    return t(`auth.errors.${code}`, {
        minutes,
        defaultValue: t('auth.errors.generic'),
    });
}

const EMAIL = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;

export function validateEmail(t: TFunction) {
    return (value: string) => EMAIL.test(value.trim())
        ? null
        : t('auth.errors.emailInvalid');
}

/** Our own message for empty required fields; the browser's would follow the browser's language. */
export function validateRequired(t: TFunction) {
    return (value: string) => value === ''
        ? t('auth.errors.required')
        : null;
}
