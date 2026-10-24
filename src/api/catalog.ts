import type { DishSummary, RestaurantSummary } from '@slashncode/nothingeats-ui';
import type { Language } from '../i18n';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { request } from './http';

// /api/catalog/v1 (nothingeats-catalog-service). Texts come back in the requested language.

export interface RestaurantPage {
    items: RestaurantSummary[];
    nextCursor: string | null;
}

export interface Menu {
    restaurant: RestaurantSummary;
    sections: { name: string; dishes: DishSummary[] }[];
}

const PAGE_SIZE = 12;

export const catalogQueries = {
    restaurants: (language: Language, cuisine?: string) => infiniteQueryOptions({
        queryKey: [
            'catalog',
            'restaurants',
            language,
            cuisine ?? 'all',
        ],
        queryFn: ({ pageParam, signal }) => request<RestaurantPage>('/api/catalog/v1/restaurants', {
            query: {
                lang: language,
                limit: PAGE_SIZE,
                cuisine,
                cursor: pageParam,
            },
            signal,
        }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: page => page.nextCursor ?? undefined,
    }),

    /** All restaurants once, for the count and the cuisine filter (search brings real facets later). */
    overview: (language: Language) => queryOptions({
        queryKey: ['catalog', 'overview', language],
        queryFn: async ({ signal }) => {
            const page = await request<RestaurantPage>('/api/catalog/v1/restaurants', {
                query: { lang: language, limit: 50 },
                signal,
            });
            return {
                count: page.items.length,
                cuisines: [
                    ...new Set(page.items.map(restaurant => restaurant.cuisine)),
                ].sort(),
            };
        },
        staleTime: 5 * 60_000,
    }),

    menu: (language: Language, slug: string) => queryOptions({
        queryKey: ['catalog', 'menu', language, slug],
        queryFn: ({ signal }) => request<Menu>(`/api/catalog/v1/restaurants/${encodeURIComponent(slug)}`, {
            query: { lang: language },
            signal,
        }),
    }),
};
