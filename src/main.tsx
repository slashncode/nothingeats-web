import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';
import { initAnalytics } from './analytics/analytics';
import { SessionProvider } from './auth/session';
import { createAppRouter, createQueryClient } from './router';

import '@slashncode/nothingeats-ui/style.css';
import './app.scss';
import './i18n';

initAnalytics();

const queryClient = createQueryClient();
const router = createAppRouter(queryClient);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <SessionProvider>
                <RouterProvider router={router} />
            </SessionProvider>
        </QueryClientProvider>
    </StrictMode>,
);
