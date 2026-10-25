import type { Session, User } from '../api/identity';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { currentConsent, identifyUser, onConsentDecided, resetAnalytics, setConsent } from '../analytics/analytics';
import { setAccessToken, setUnauthorizedHandler } from '../api/http';
import { identity } from '../api/identity';
import { hasRememberedLanguage, i18next, isLanguage } from '../i18n';

export type SessionState
    = | { status: 'loading' }
        | { status: 'anonymous' }
        | { status: 'authenticated'; user: User };

interface SessionApi {
    state: SessionState;
    login: (email: string, password: string) => Promise<User>;
    loginWithMagicLink: (token: string) => Promise<User>;
    logout: () => Promise<void>;
    /** After the account was deleted: the server session is gone already, forget it here too. */
    forget: () => void;
}

const SessionContext = createContext<SessionApi | undefined>(undefined);

let inflight: Promise<Session | undefined> | undefined;

/**
 * Every refresh rotates the refresh cookie, and presenting a used one revokes the whole session
 * family. So refreshes must never overlap: one at a time per tab (shared promise), and one at a
 * time across tabs (Web Locks), each tab then sending the cookie the previous one received.
 */
function refreshOnce(): Promise<Session | undefined> {
    inflight ??= (async () => {
        const run = () => identity.refresh().catch(() => undefined);
        try {
            return globalThis.navigator?.locks
                ? await navigator.locks.request('nothingeats-session-refresh', run)
                : await run();
        }
        finally {
            inflight = undefined;
        }
    })();
    return inflight;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<SessionState>({ status: 'loading' });
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const apply = useCallback((session: Session | undefined) => {
        clearTimeout(timerRef.current);
        setAccessToken(session?.accessToken);
        if (!session) {
            setState({ status: 'anonymous' });
            return;
        }
        setState({ status: 'authenticated', user: session.user });
        identifyUser(session.user);
        syncConsent(session.user);
        if (!hasRememberedLanguage() && isLanguage(session.user.locale))
            void i18next.changeLanguage(session.user.locale);
        // Renew a minute before the access token expires.
        timerRef.current = setTimeout(async () => apply(await refreshOnce()), Math.max(30, session.expiresIn - 60) * 1000);
    }, []);

    useEffect(() => {
        setUnauthorizedHandler(async () => {
            const session = await refreshOnce();
            apply(session);
            return session?.accessToken;
        });
        void refreshOnce().then(apply);
        return () => clearTimeout(timerRef.current);
    }, [apply]);

    const login = useCallback(async (email: string, password: string) => {
        const session = await identity.login(email, password);
        apply(session);
        return session.user;
    }, [apply]);

    const loginWithMagicLink = useCallback(async (token: string) => {
        const session = await identity.loginWithMagicLink(token);
        apply(session);
        return session.user;
    }, [apply]);

    const forget = useCallback(() => {
        resetAnalytics();
        apply(undefined);
    }, [apply]);

    // Decisions made here while logged in are kept with the account.
    useEffect(() => onConsentDecided((granted) => {
        if (state.status === 'authenticated')
            void identity.setConsent(granted).catch(() => undefined);
    }), [state.status]);

    const logout = useCallback(async () => {
        await identity.logout().catch(() => undefined);
        resetAnalytics();
        apply(undefined);
    }, [apply]);

    const api = useMemo(
        () => ({
            state,
            login,
            loginWithMagicLink,
            logout,
            forget,
        }),
        [
            state,
            login,
            loginWithMagicLink,
            logout,
            forget,
        ],
    );
    return <SessionContext value={api}>{children}</SessionContext>;
}

/**
 * The account's decision wins on a new device; a decision made here before logging in is stored
 * with an account that has none yet.
 */
function syncConsent(user: User) {
    const local = currentConsent();
    if (user.analyticsConsent !== undefined && user.analyticsConsent !== null) {
        if (local !== (user.analyticsConsent ? 'granted' : 'denied'))
            setConsent(user.analyticsConsent, { fromAccount: true });
    }
    else if (local !== 'pending') {
        void identity.setConsent(local === 'granted').catch(() => undefined);
    }
}

export function useSession(): SessionApi {
    const api = use(SessionContext);
    if (!api)
        throw new Error('useSession needs a SessionProvider');
    return api;
}
