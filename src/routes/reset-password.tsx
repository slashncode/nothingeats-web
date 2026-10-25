import { Button, Form, Link, TextField } from '@slashncode/nothingeats-ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../api/http';
import { identity } from '../api/identity';
import { authErrorMessage } from '../components/authErrors';
import styles from '../components/forms.module.scss';
import { Page } from '../components/Page';

const MIN_PASSWORD = 10;
const MAX_PASSWORD = 128;

/** The link in the reset mail: /reset-password?token=… */
export const Route = createFileRoute('/reset-password')({
    validateSearch: (search: Record<string, unknown>): { token?: string } => ({
        token: typeof search.token === 'string' && search.token !== ''
            ? search.token
            : undefined,
    }),
    component: ResetPassword,
});

function ResetPassword() {
    const { t } = useTranslation();
    const { token } = Route.useSearch();
    const [done, setDone] = useState(false);
    const [error, setError] = useState<unknown>();
    const [pending, setPending] = useState(false);
    const linkUnusable = !token || (error instanceof ApiError && error.code === 'PASSWORD_RESET_TOKEN_INVALID');

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError(undefined);
        try {
            await identity.resetPassword(token!, String(form.get('password')));
            setDone(true);
        }
        catch (failure) {
            setError(failure);
        }
        finally {
            setPending(false);
        }
    }

    return (
        <Page narrow>
            <h1>{t('auth.resetTitle')}</h1>
            {done && (
                <>
                    <p role="status" className={styles.success}>{t('auth.resetDone')}</p>
                    <Link href="/login">{t('nav.login')}</Link>
                </>
            )}
            {!done && linkUnusable && (
                <>
                    <p role="alert" className={styles.alert}>
                        {token
                            ? authErrorMessage(t, error)
                            : t('auth.errors.PASSWORD_RESET_TOKEN_INVALID')}
                    </p>
                    <Link href="/forgot-password">{t('auth.resetNewLink')}</Link>
                </>
            )}
            {!done && !linkUnusable && (
                <Form onSubmit={submit} className={styles.form}>
                    {error !== undefined && <p role="alert" className={styles.alert}>{authErrorMessage(t, error)}</p>}
                    <TextField
                        name="password"
                        type="password"
                        label={t('auth.newPassword')}
                        description={t('auth.passwordHint')}
                        autoComplete="new-password"
                        isRequired
                        validate={value => value.length >= MIN_PASSWORD && value.length <= MAX_PASSWORD
                            ? null
                            : t('auth.passwordHint')}
                    />
                    <Button type="submit" isPending={pending}>{t('auth.resetSubmit')}</Button>
                </Form>
            )}
        </Page>
    );
}
