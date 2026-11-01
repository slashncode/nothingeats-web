import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';
import { initAnalytics } from './analytics/analytics';
import { SessionProvider } from './auth/session';
import { currentLanguage, i18next } from './i18n';
import { loadOverrides } from './i18n/overrides';
import { createAppRouter, createQueryClient } from './router';

import '@slashncode/nothingeats-ui/style.css';
import './app.scss';

initAnalytics();

const queryClient = createQueryClient();
const router = createAppRouter(queryClient);

// The editors' wording first (briefly), then the page; a language switch loads its own.
i18next.on('languageChanged', language => void loadOverrides(language as 'de' | 'en'));
void loadOverrides(currentLanguage()).finally(() => {
    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <QueryClientProvider client={queryClient}>
                <SessionProvider>
                    <RouterProvider router={router} />
                </SessionProvider>
            </QueryClientProvider>
        </StrictMode>,
    );
});
