import type { CouponSummary } from '@slashncode/nothingeats-ui';
import type { Language } from '../i18n';
import { queryOptions } from '@tanstack/react-query';

import { request } from './http';

// /api/loyalty/v1 (nothingeats-loyalty-service). Badge texts come back in the requested language.

export interface Level {
    level: number;
    xp: number;
    levelStartXp: number;
    nextLevelXp: number;
}

export interface Badge {
    key: string;
    tier: 'BRONZE' | 'SILVER' | 'GOLD';
    name: string;
    description: string;
    /** Missing while the badge is still to earn. */
    earnedAt?: string | null;
}

export interface StampCardView {
    restaurantSlug: string;
    restaurantName: string;
    stamps: number;
    perCard: number;
    completed: number;
}

export interface Coupon extends CouponSummary {
    source: 'STAMP_CARD' | 'WHEEL';
    expiresAt: string;
}

export interface Rewards {
    level: Level;
    spinsAvailable: number;
    streak: { days: number; longest: number; orderedToday: boolean };
    stats: { orders: number; moneyNotSpentCents: number; caloriesAvoided: number; restaurants: number };
    badges: Badge[];
    stampCards: StampCardView[];
    coupons: Coupon[];
}

export interface SpinResult {
    prize: string;
    coupon?: Coupon | null;
    xpGained: number;
    level?: Level | null;
    badges: Badge[];
    spinsAvailable: number;
}

/** `reward.earned` on the live stream (loyalty-service docs/events.md), passed through as published. */
export interface RewardEarned {
    cause: 'ORDER_DELIVERED' | 'WHEEL';
    orderId?: string | null;
    xp: { gained: number; total: number; level: number; previousLevel: number };
    spinsGranted: number;
    streakDays: number;
    badges: { key: string; tier: string; name: { de: string; en: string } }[];
    stampCard?: { restaurantSlug: string; restaurantName: string; stamps: number; perCard: number; completed: boolean } | null;
    coupons: { code: string; kind: string; value: number; maxDiscountCents?: number | null; restaurantName?: string | null }[];
}

export const loyaltyKeys = {
    all: ['loyalty'] as const,
};

export const loyaltyQueries = {
    rewards: (language: Language) => queryOptions({
        queryKey: [...loyaltyKeys.all, 'me', language],
        queryFn: ({ signal }) => request<Rewards>('/api/loyalty/v1/me', {
            auth: true,
            query: { lang: language },
            signal,
        }),
    }),

    coupons: () => queryOptions({
        queryKey: [...loyaltyKeys.all, 'coupons'],
        queryFn: ({ signal }) => request<{ items: Coupon[] }>('/api/loyalty/v1/coupons', { auth: true, signal }).then(page => page.items),
    }),
};

export const loyalty = {
    spin: (language: Language) => request<SpinResult>('/api/loyalty/v1/spins', {
        method: 'POST',
        auth: true,
        query: { lang: language },
    }),

    exportRewards: () => request<unknown>('/api/loyalty/v1/me/export', { auth: true }),
};
