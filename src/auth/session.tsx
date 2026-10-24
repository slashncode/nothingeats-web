import type { Session, User } from '../api/identity';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { identifyUser, resetAnalytics } from '../analytics/analytics';
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
    logout: () => Promise<void>;
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

    const logout = useCallback(async () => {
        await identity.logout().catch(() => undefined);
        resetAnalytics();
        apply(undefined);
    }, [apply]);

    const api = useMemo(() => ({ state, login, logout }), [state, login, logout]);
    return <SessionContext value={api}>{children}</SessionContext>;
}

export function useSession(): SessionApi {
    const api = use(SessionContext);
    if (!api)
        throw new Error('useSession needs a SessionProvider');
    return api;
}
