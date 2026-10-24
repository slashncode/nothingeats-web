import type { NavigateOptions, RouterHistory, ToOptions } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';

import { ApiError } from './api/http';
import { routeTree } from './routeTree.gen';

export interface RouterContext {
    queryClient: QueryClient;
}

export function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30_000,
                // Client errors (404, 401, …) are answers, not hiccups: no retries.
                retry: (failures, error) => !(error instanceof ApiError && error.status < 500) && failures < 2,
            },
        },
    });
}

/** `history` only for tests (memory history); the app uses the browser's. */
export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
    return createRouter({
        routeTree,
        history,
        context: { queryClient },
        defaultPreload: 'intent',
        // TanStack Query caches; the router should always ask it.
        defaultPreloadStaleTime: 0,
        scrollRestoration: true,
    });
}

declare module '@tanstack/react-router' {
    interface Register {
        router: ReturnType<typeof createAppRouter>;
    }
}

// React Aria links (also those inside nothingeats-ui) navigate through TanStack Router.
declare module 'react-aria-components' {
    interface RouterConfig {
        routerOptions: Omit<NavigateOptions, keyof ToOptions>;
    }
}
