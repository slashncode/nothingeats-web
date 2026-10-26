import type { DishSummary, SearchSuggestion } from '@slashncode/nothingeats-ui';
import type { Language } from '../i18n';
import { infiniteQueryOptions, keepPreviousData, queryOptions } from '@tanstack/react-query';

import { request } from './http';

// /api/search/v1 (nothingeats-search-service). Texts come back in the requested language.

export interface DishHit extends DishSummary {
    section: string;
    restaurant: { slug: string; name: string; cuisine: string };
}

export interface FacetValue {
    value: string;
    count: number;
}

export interface Facets {
    cuisine: FacetValue[];
    dietary: FacetValue[];
    mood: FacetValue[];
    spiceLevel: FacetValue[];
    /** Cumulative: `value` is the upper bound in cents. */
    price: FacetValue[];
}

export interface DishSearchPage {
    items: DishHit[];
    total: number;
    page: number;
    size: number;
    facets: Facets;
}

/** The search as it sits in the URL; multi-value filters are comma-separated. */
export interface DishSearch {
    q?: string;
    cuisine?: string;
    diet?: string;
    mood?: string;
    /** Allergens to leave out. */
    without?: string;
    maxSpice?: number;
    maxPrice?: number;
    openNow?: boolean;
}

const PAGE_SIZE = 20;

export const searchQueries = {
    dishes: (language: Language, search: DishSearch) => infiniteQueryOptions({
        queryKey: ['search', 'dishes', language, search],
        queryFn: ({ pageParam, signal }) => request<DishSearchPage>('/api/search/v1/dishes', {
            query: {
                q: search.q,
                lang: language,
                cuisine: search.cuisine,
                diet: search.diet,
                mood: search.mood,
                excludeAllergen: search.without,
                maxSpice: search.maxSpice,
                maxPrice: search.maxPrice,
                openNow: search.openNow ? 'true' : undefined,
                page: pageParam,
                size: PAGE_SIZE,
            },
            signal,
        }),
        initialPageParam: 0,
        getNextPageParam: last => (last.page + 1) * last.size < last.total
            ? last.page + 1
            : undefined,
        // Facets and results stay on screen while the next filter combination loads.
        placeholderData: keepPreviousData,
    }),

    suggestions: (language: Language, prefix: string) => queryOptions({
        queryKey: [
            'search',
            'suggestions',
            language,
            prefix,
        ],
        queryFn: ({ signal }) => request<{ items: SearchSuggestion[] }>('/api/search/v1/suggestions', {
            query: { q: prefix, lang: language },
            signal,
        }),
        enabled: prefix.length >= 2,
        staleTime: 60_000,
        placeholderData: keepPreviousData,
    }),
};
