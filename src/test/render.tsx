import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';

import { SessionProvider } from '../auth/session';
import { createAppRouter, createQueryClient } from '../router';

/** The whole app (router, session, queries) at one URL, against the MSW handlers. */
export function renderApp(path = '/') {
    const queryClient = createQueryClient();
    const router = createAppRouter(queryClient, createMemoryHistory({
        initialEntries: [path],
    }));
    // StrictMode like main.tsx: effects run twice, which the session refresh must survive.
    render(
        <StrictMode>
            <QueryClientProvider client={queryClient}>
                <SessionProvider>
                    <RouterProvider router={router} />
                </SessionProvider>
            </QueryClientProvider>
        </StrictMode>,
    );
    return {
        router,
        user: userEvent.setup(),
    };
}
