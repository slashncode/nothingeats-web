import { Button, Form, Switch, TextField, toastQueue } from '@slashncode/nothingeats-ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { analyticsEnabled, setConsent, useConsent } from '../analytics/analytics';
import { identity } from '../api/identity';
import { loyalty } from '../api/loyalty';
import { ordering } from '../api/ordering';
import { useSession } from '../auth/session';
import { AccountNav } from '../components/AccountNav';
import { authErrorMessage, validateRequired } from '../components/authErrors';
import forms from '../components/forms.module.scss';
import { Page } from '../components/Page';
import styles from './account.module.scss';

export const Route = createFileRoute('/account/')({
    component: Account,
});

function Account() {
    const { t } = useTranslation();
    const { state, logout, forget } = useSession();
    const navigate = useNavigate();
    const consent = useConsent();
    const [exporting, setExporting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<unknown>();

    // The layout route lets only signed-in customers through.
    if (state.status !== 'authenticated')
        return null;

    const { user } = state;

    async function download() {
        setExporting(true);
        try {
            // GDPR art. 15/20: what every service holds about the customer, in one file.
            const [account, orders, rewards] = await Promise.all([
                identity.exportAccount(),
                ordering.exportOrders(),
                loyalty.exportRewards(),
            ]);
            const data = { account, orders, rewards };
            const url = URL.createObjectURL(new Blob([
                JSON.stringify(data, null, 2),
            ], { type: 'application/json' }));
            const link = Object.assign(document.createElement('a'), { href: url, download: 'nothingeats-account.json' });
            link.click();
            URL.revokeObjectURL(url);
        }
        finally {
            setExporting(false);
        }
    }

    async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const password = String(new FormData(event.currentTarget).get('password'));
        setDeleting(true);
        setDeleteError(undefined);
        try {
            await identity.deleteAccount(password);
            // Leave first: an anonymous visitor on this page is sent to the login.
            await navigate({ to: '/' });
            forget();
            toastQueue.add({
                title: t('auth.deleted'),
                variant: 'success',
            }, { timeout: 8000 });
        }
        catch (failure) {
            setDeleteError(failure);
            setDeleting(false);
        }
    }

    return (
        <Page narrow>
            <AccountNav />
            <h1>{t('auth.accountTitle')}</h1>
            <dl className={styles.details}>
                <dt>{t('auth.email')}</dt>
                <dd>{user.email}</dd>
                <dt>{t('auth.accountLanguage')}</dt>
                <dd>
                    {user.locale === 'en'
                        ? 'English'
                        : 'Deutsch'}
                </dd>
                {user.roles.length > 0 && (
                    <>
                        <dt>{t('auth.accountRoles')}</dt>
                        <dd>{user.roles.join(', ')}</dd>
                    </>
                )}
            </dl>
            <Button
                variant="outline"
                onPress={async () => {
                    // Leave first: an anonymous visitor on this page is sent to the login.
                    await navigate({ to: '/' });
                    await logout();
                }}
            >
                {t('auth.logout')}
            </Button>

            {analyticsEnabled && (
                <section aria-labelledby="privacy" className={styles.section}>
                    <h2 id="privacy" className={styles.sectionTitle}>{t('auth.privacyTitle')}</h2>
                    <Switch isSelected={consent === 'granted'} onChange={granted => setConsent(granted)} description={t('auth.analyticsConsentHint')}>
                        {t('auth.analyticsConsent')}
                    </Switch>
                </section>
            )}

            <section aria-labelledby="export" className={styles.section}>
                <h2 id="export" className={styles.sectionTitle}>{t('auth.exportTitle')}</h2>
                <p className={forms.hint}>{t('auth.exportHint')}</p>
                <Button variant="secondary" isPending={exporting} onPress={download}>{t('auth.exportButton')}</Button>
            </section>

            <section aria-labelledby="delete" className={styles.section}>
                <h2 id="delete" className={styles.sectionTitle}>{t('auth.deleteTitle')}</h2>
                <p className={forms.hint}>{t('auth.deleteHint')}</p>
                <Form onSubmit={deleteAccount} className={forms.form}>
                    {deleteError !== undefined && <p role="alert" className={forms.alert}>{authErrorMessage(t, deleteError)}</p>}
                    <TextField
                        name="password"
                        type="password"
                        label={t('auth.deleteConfirm')}
                        autoComplete="current-password"
                        isRequired
                        validate={validateRequired(t)}
                    />
                    <Button type="submit" variant="destructive" isPending={deleting}>{t('auth.deleteButton')}</Button>
                </Form>
            </section>
        </Page>
    );
}
