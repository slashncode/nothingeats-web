import { createFileRoute, Outlet, useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useSession } from '../auth/session';
import { Page } from '../components/Page';

export const Route = createFileRoute('/account')({
    component: AccountLayout,
});

/**
 * Everything under /account needs a session; anonymous visitors log in and come back. Navigates
 * once per session change: `<Navigate>` here would navigate again on every location update.
 */
function AccountLayout() {
    const { t } = useTranslation();
    const { state } = useSession();
    const navigate = useNavigate();
    const router = useRouter();

    useEffect(() => {
        if (state.status === 'anonymous') {
            void navigate({
                to: '/login',
                search: { redirect: router.state.location.pathname },
                replace: true,
            });
        }
    }, [state.status, navigate, router]);

    if (state.status !== 'authenticated')
        return <Page narrow><p role="status">{t('app.loading')}</p></Page>;
    return <Outlet />;
}
