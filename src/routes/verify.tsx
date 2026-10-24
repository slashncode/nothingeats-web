import { Link } from '@slashncode/nothingeats-ui';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { identity } from '../api/identity';
import { authErrorMessage } from '../components/authErrors';
import styles from '../components/forms.module.scss';
import { Page } from '../components/Page';

/** The link in the verification mail: /verify?token=… */
export const Route = createFileRoute('/verify')({
    validateSearch: (search: Record<string, unknown>): { token?: string } => ({
        token: typeof search.token === 'string' && search.token !== ''
            ? search.token
            : undefined,
    }),
    component: Verify,
});

function Verify() {
    const { t } = useTranslation();
    const { token } = Route.useSearch();
    const verification = useMutation({ mutationFn: identity.verify });
    const sentRef = useRef(false);

    useEffect(() => {
        // Exactly once, also under StrictMode's double effects: a token is single-use.
        if (token && !sentRef.current) {
            sentRef.current = true;
            verification.mutate(token);
        }
    }, [token, verification]);

    return (
        <Page narrow>
            <h1>{t('auth.verifyTitle')}</h1>
            {!token && <p role="alert" className={styles.alert}>{t('auth.verifyMissingToken')}</p>}
            {token && verification.isPending && <p role="status">{t('auth.verifying')}</p>}
            {verification.isSuccess && (
                <>
                    <p role="status" className={styles.success}>{t('auth.verified')}</p>
                    <Link href="/login">{t('nav.login')}</Link>
                </>
            )}
            {verification.isError && <p role="alert" className={styles.alert}>{authErrorMessage(t, verification.error)}</p>}
        </Page>
    );
}
