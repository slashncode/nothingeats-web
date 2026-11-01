import type { ArticleSummary } from '@slashncode/nothingeats-ui';
import type { Language } from '../i18n';
import { queryOptions } from '@tanstack/react-query';

import { request } from './http';

// /api/backoffice/v1 (nothingeats-backoffice docs/api.md): the content the backoffice serves itself.

export interface ArticlePage {
    items: ArticleSummary[];
    page: number;
    totalPages: number;
}

export interface Article extends ArticleSummary {
    /** Escaped HTML from the backoffice (its converter checks links); internal links are shop paths. */
    bodyHtml: string;
    readingMinutes: number;
}

export interface Named {
    slug: string;
    name: string;
}

export const backofficeKeys = {
    all: ['backoffice'] as const,
};

export const backofficeQueries = {
    articles: (language: Language, filter: { category?: string; tag?: string }, page = 1) => queryOptions({
        queryKey: [
            ...backofficeKeys.all,
            'articles',
            language,
            filter.category ?? '',
            filter.tag ?? '',
            page,
        ],
        queryFn: ({ signal }) => request<ArticlePage>('/api/backoffice/v1/articles', {
            query: {
                lang: language,
                category: filter.category,
                tag: filter.tag,
                page,
            },
            signal,
        }),
    }),

    article: (language: Language, slug: string) => queryOptions({
        queryKey: [
            ...backofficeKeys.all,
            'article',
            language,
            slug,
        ],
        queryFn: ({ signal }) => request<Article>(`/api/backoffice/v1/articles/${encodeURIComponent(slug)}`, {
            query: { lang: language },
            signal,
        }),
    }),

    categories: (language: Language) => queryOptions({
        queryKey: [...backofficeKeys.all, 'categories', language],
        queryFn: ({ signal }) => request<{ items: Named[] }>('/api/backoffice/v1/article-categories', {
            query: { lang: language },
            signal,
        }).then(page => page.items),
        staleTime: 5 * 60_000,
    }),

    tags: (language: Language) => queryOptions({
        queryKey: [...backofficeKeys.all, 'tags', language],
        queryFn: ({ signal }) => request<{ items: Named[] }>('/api/backoffice/v1/tags', {
            query: { lang: language },
            signal,
        }).then(page => page.items),
        staleTime: 5 * 60_000,
    }),

    coachSuggestions: (language: Language) => queryOptions({
        queryKey: [...backofficeKeys.all, 'coach-suggestions', language],
        queryFn: ({ signal }) => request<{ items: string[] }>('/api/backoffice/v1/coach-suggestions', {
            query: { lang: language },
            signal,
        }).then(page => page.items),
        staleTime: 5 * 60_000,
    }),
};
