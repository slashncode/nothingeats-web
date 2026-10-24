import { Button } from '@slashncode/nothingeats-ui';
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { useSession } from '../auth/session';
import { Page } from '../components/Page';
import styles from './account.module.scss';

export const Route = createFileRoute('/account')({
    component: Account,
});

function Account() {
    const { t } = useTranslation();
    const { state, logout } = useSession();
    const navigate = useNavigate();

    if (state.status === 'loading')
        return <Page narrow><p role="status">{t('app.loading')}</p></Page>;
    if (state.status === 'anonymous')
        return <Navigate to="/login" search={{ redirect: '/account' }} />;

    const { user } = state;
    return (
        <Page narrow>
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
        </Page>
    );
}
