import { Button, Form, Link, TextField } from '@slashncode/nothingeats-ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../api/http';
import { identity } from '../api/identity';
import { authErrorMessage, validateEmail } from '../components/authErrors';
import styles from '../components/forms.module.scss';
import { Page } from '../components/Page';
import { currentLanguage } from '../i18n';

export const Route = createFileRoute('/register')({
    component: Register,
});

const MIN_PASSWORD = 10;
const MAX_PASSWORD = 128;

function Register() {
    const { t } = useTranslation();
    const [done, setDone] = useState(false);
    const [error, setError] = useState<unknown>();
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError(undefined);
        setFieldErrors({});
        try {
            // Same answer whether the address is new or not (no account enumeration).
            await identity.register(String(form.get('email')).trim(), String(form.get('password')), currentLanguage());
            setDone(true);
        }
        catch (failure) {
            if (failure instanceof ApiError && failure.violations.length > 0) {
                setFieldErrors(Object.fromEntries(failure.violations.map(violation => [
                    violation.field,
                    violation.field === 'password'
                        ? t('auth.passwordHint')
                        : t('auth.errors.emailInvalid'),
                ])));
            }
            else {
                setError(failure);
            }
        }
        finally {
            setPending(false);
        }
    }

    return (
        <Page narrow>
            <h1>{t('auth.registerTitle')}</h1>
            {done
                ? <p role="status" className={styles.success}>{t('auth.registerDone')}</p>
                : (
                        <>
                            <p className={styles.hint}>{t('auth.registerLead')}</p>
                            <Form onSubmit={submit} validationErrors={fieldErrors} className={styles.form}>
                                {error !== undefined && <p role="alert" className={styles.alert}>{authErrorMessage(t, error)}</p>}
                                <TextField name="email" type="email" label={t('auth.email')} autoComplete="email" isRequired validate={validateEmail(t)} />
                                <TextField
                                    name="password"
                                    type="password"
                                    label={t('auth.password')}
                                    description={t('auth.passwordHint')}
                                    autoComplete="new-password"
                                    isRequired
                                    validate={value => value.length >= MIN_PASSWORD && value.length <= MAX_PASSWORD
                                        ? null
                                        : t('auth.passwordHint')}
                                />
                                <Button type="submit" isPending={pending}>{t('auth.registerSubmit')}</Button>
                            </Form>
                        </>
                    )}
            <p className={styles.hint}>
                {`${t('auth.registerHasAccount')} `}
                <Link href="/login">{t('nav.login')}</Link>
            </p>
        </Page>
    );
}
