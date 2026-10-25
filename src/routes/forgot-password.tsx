import { Button, Form, Link, TextField } from '@slashncode/nothingeats-ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { identity } from '../api/identity';
import { authErrorMessage, validateEmail } from '../components/authErrors';
import styles from '../components/forms.module.scss';
import { Page } from '../components/Page';

/** Also the "wasn't me" link in the password-changed mail. */
export const Route = createFileRoute('/forgot-password')({
    component: ForgotPassword,
});

function ForgotPassword() {
    const { t } = useTranslation();
    const [done, setDone] = useState(false);
    const [error, setError] = useState<unknown>();
    const [pending, setPending] = useState(false);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError(undefined);
        try {
            // Same answer for every address: nobody learns which ones have an account.
            await identity.requestPasswordReset(String(form.get('email')).trim());
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
            <h1>{t('auth.forgotTitle')}</h1>
            {done
                ? <p role="status" className={styles.success}>{t('auth.forgotDone')}</p>
                : (
                        <>
                            <p className={styles.hint}>{t('auth.forgotLead')}</p>
                            <Form onSubmit={submit} className={styles.form}>
                                {error !== undefined && <p role="alert" className={styles.alert}>{authErrorMessage(t, error)}</p>}
                                <TextField name="email" type="email" label={t('auth.email')} autoComplete="email" isRequired validate={validateEmail(t)} />
                                <Button type="submit" isPending={pending}>{t('auth.forgotSubmit')}</Button>
                            </Form>
                        </>
                    )}
            <Link href="/login">{t('nav.login')}</Link>
        </Page>
    );
}
