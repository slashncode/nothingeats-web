import { Button, Form, Link, TextField } from '@slashncode/nothingeats-ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { identity } from '../api/identity';
import { authErrorMessage, validateEmail } from '../components/authErrors';
import styles from '../components/forms.module.scss';
import { Page } from '../components/Page';

export const Route = createFileRoute('/magic-link')({
    component: MagicLink,
});

function MagicLink() {
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
            await identity.requestMagicLink(String(form.get('email')).trim());
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
            <h1>{t('auth.magicTitle')}</h1>
            {done
                ? <p role="status" className={styles.success}>{t('auth.magicDone')}</p>
                : (
                        <>
                            <p className={styles.hint}>{t('auth.magicLead')}</p>
                            <Form onSubmit={submit} className={styles.form}>
                                {error !== undefined && <p role="alert" className={styles.alert}>{authErrorMessage(t, error)}</p>}
                                <TextField name="email" type="email" label={t('auth.email')} autoComplete="email" isRequired validate={validateEmail(t)} />
                                <Button type="submit" isPending={pending}>{t('auth.magicSubmit')}</Button>
                            </Form>
                        </>
                    )}
            <Link href="/login">{t('nav.login')}</Link>
        </Page>
    );
}
