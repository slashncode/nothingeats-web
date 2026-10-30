import type { RouterContext } from '../router';
import { Button, Link, ToastRegion } from '@slashncode/nothingeats-ui';
import { createRootRouteWithContext, Outlet, useRouter } from '@tanstack/react-router';
import { RouterProvider as AriaRouterProvider, I18nProvider } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { useColorScheme } from '../components/colorScheme';
import { ConsentBanner } from '../components/ConsentBanner';
import { CravingCoach } from '../components/CravingCoach';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { Page } from '../components/Page';
import { currentLanguage, RAC_LOCALES } from '../i18n';
import { LiveStream } from '../live/LiveStream';
import { RewardToasts } from '../live/RewardToasts';

export const Route = createRootRouteWithContext<RouterContext>()({
    component: RootLayout,
    notFoundComponent: NotFound,
    errorComponent: ({ reset }) => <ErrorState onRetry={reset} />,
});

function RootLayout() {
    const router = useRouter();
    const { t } = useTranslation();
    useColorScheme();
    return (
        <AriaRouterProvider
            navigate={(to, options) => router.navigate({ ...options, to: to as never })}
            useHref={to => router.buildLocation({ to: to as never }).href}
        >
            <I18nProvider locale={RAC_LOCALES[currentLanguage()]}>
                <a href="#main" className="skip-link">{t('app.skipToContent')}</a>
                <Header />
                <main id="main" tabIndex={-1}>
                    <Outlet />
                </main>
                <Footer />
                <ConsentBanner />
                <LiveStream />
                <RewardToasts />
                <CravingCoach />
                <ToastRegion position="bottom-left" />
            </I18nProvider>
        </AriaRouterProvider>
    );
}

function NotFound() {
    const { t } = useTranslation();
    return (
        <Page narrow>
            <h1>{t('app.notFound')}</h1>
            <Link href="/">{t('app.backHome')}</Link>
        </Page>
    );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
    const { t } = useTranslation();
    return (
        <Page narrow>
            <p role="alert">{t('app.error')}</p>
            {onRetry && <Button variant="outline" onPress={onRetry}>{t('app.retry')}</Button>}
        </Page>
    );
}
