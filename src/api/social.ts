import type { Language } from '../i18n';
import { queryOptions } from '@tanstack/react-query';

import { request } from './http';

// /api/social/v1 (nothingeats-social-service). The feed is anonymous; pseudonyms come back in the requested language.

export interface FeedItem {
    id: string;
    kind: 'ORDER' | 'LEVEL' | 'BADGE';
    at: string;
    restaurantName?: string;
    items?: number;
    moneyNotSpentCents?: number;
    level?: number;
    badge?: { de: string; en: string };
}

export interface Standing {
    rank: number;
    pseudonym: string;
    xp: number;
}

export interface MyStanding {
    onLeaderboard: boolean;
    /** Null until the customer joined once. */
    pseudonym?: string | null;
    week: string;
    xp: number;
    rank?: number | null;
}

export const socialKeys = {
    all: ['social'] as const,
};

export const socialQueries = {
    feed: () => queryOptions({
        queryKey: [...socialKeys.all, 'feed'],
        queryFn: ({ signal }) => request<{ items: FeedItem[] }>('/api/social/v1/feed', {
            query: { limit: 8 },
            signal,
        }).then(page => page.items),
    }),

    leaderboard: (language: Language) => queryOptions({
        queryKey: [...socialKeys.all, 'leaderboard', language],
        queryFn: ({ signal }) => request<{ week: string; top: Standing[] }>('/api/social/v1/leaderboard', {
            query: { lang: language },
            signal,
        }),
    }),

    me: (language: Language) => queryOptions({
        queryKey: [...socialKeys.all, 'me', language],
        queryFn: ({ signal }) => request<MyStanding>('/api/social/v1/me', {
            auth: true,
            query: { lang: language },
            signal,
        }),
    }),
};

export const social = {
    setLeaderboard: (join: boolean, language: Language) => request<MyStanding>('/api/social/v1/me/leaderboard', {
        method: 'PUT',
        auth: true,
        query: { lang: language },
        body: { join },
    }),
};
