import { Button, Form, Link, TextField } from '@slashncode/nothingeats-ui';
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { capture } from '../analytics/analytics';
import { ApiError } from '../api/http';
import { useSession } from '../auth/session';
import { authErrorMessage, validateEmail, validateRequired } from '../components/authErrors';
import styles from '../components/forms.module.scss';
import { Page } from '../components/Page';

interface LoginSearch {
    /** Where to go after login; only same-site paths. */
    redirect?: string;
}

export const Route = createFileRoute('/login')({
    validateSearch: (search: Record<string, unknown>): LoginSearch => ({
        redirect: typeof search.redirect === 'string' && search.redirect.startsWith('/') && !search.redirect.startsWith('//')
            ? search.redirect
            : undefined,
    }),
    component: Login,
});

function Login() {
    const { t } = useTranslation();
    const { state, login } = useSession();
    const { redirect } = Route.useSearch();
    const navigate = useNavigate();
    const [error, setError] = useState<unknown>();
    const [pending, setPending] = useState(false);

    if (state.status === 'authenticated' && !pending)
        return <Navigate to={(redirect ?? '/') as never} />;

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError(undefined);
        try {
            await login(String(form.get('email')).trim(), String(form.get('password')));
            await navigate({ to: (redirect ?? '/') as never });
        }
        catch (failure) {
            setError(failure);
            capture('login_failed', {
                code: failure instanceof ApiError
                    ? failure.code
                    : 'NETWORK',
            });
        }
        finally {
            setPending(false);
        }
    }

    return (
        <Page narrow>
            <h1>{t('auth.loginTitle')}</h1>
            <Form onSubmit={submit} className={styles.form}>
                {error !== undefined && <p role="alert" className={styles.alert}>{authErrorMessage(t, error)}</p>}
                <TextField name="email" type="email" label={t('auth.email')} autoComplete="email" isRequired validate={validateEmail(t)} />
                <TextField name="password" type="password" label={t('auth.password')} autoComplete="current-password" isRequired validate={validateRequired(t)} />
                <Button type="submit" isPending={pending}>{t('auth.loginSubmit')}</Button>
            </Form>
            <p className={styles.hint}>
                {`${t('auth.loginNoAccount')} `}
                <Link href="/register">{t('nav.register')}</Link>
            </p>
        </Page>
    );
}
