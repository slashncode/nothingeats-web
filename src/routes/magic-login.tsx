import { Link } from '@slashncode/nothingeats-ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSession } from '../auth/session';
import { authErrorMessage } from '../components/authErrors';
import styles from '../components/forms.module.scss';
import { Page } from '../components/Page';

/** The link in the login mail: /magic-login?token=… */
export const Route = createFileRoute('/magic-login')({
    validateSearch: (search: Record<string, unknown>): { token?: string } => ({
        token: typeof search.token === 'string' && search.token !== ''
            ? search.token
            : undefined,
    }),
    component: MagicLogin,
});

function MagicLogin() {
    const { t } = useTranslation();
    const { token } = Route.useSearch();
    const { loginWithMagicLink } = useSession();
    const navigate = useNavigate();
    const [error, setError] = useState<unknown>(token
        ? undefined
        : new Error('missing token'));
    const sentRef = useRef(false);

    useEffect(() => {
        // Exactly once, also under StrictMode's double effects: the link is single-use.
        if (!token || sentRef.current)
            return;
        sentRef.current = true;
        loginWithMagicLink(token)
            .then(() => navigate({ to: '/' }))
            .catch(setError);
    }, [token, loginWithMagicLink, navigate]);

    return (
        <Page narrow>
            <h1>{t('auth.magicTitle')}</h1>
            {error === undefined
                ? <p role="status">{t('auth.magicLoggingIn')}</p>
                : (
                        <>
                            <p role="alert" className={styles.alert}>
                                {token
                                    ? authErrorMessage(t, error)
                                    : t('auth.errors.MAGIC_LINK_INVALID')}
                            </p>
                            <Link href="/magic-link">{t('auth.magicLink')}</Link>
                        </>
                    )}
        </Page>
    );
}
