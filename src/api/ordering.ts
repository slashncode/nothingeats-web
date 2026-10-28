import type { Language } from '../i18n';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { request } from './http';

// /api/ordering/v1 (nothingeats-ordering-service). Names come back in the requested language.

export interface CartLine {
    dishId: string;
    name: string;
    unitPriceCents: number;
    quantity: number;
    totalCents: number;
    available: boolean;
    /** The menu price while a flash deal makes the dish cheaper. */
    regularUnitPriceCents?: number | null;
    deal?: { percentOff: number; endsAt: string } | null;
}

export type CartProblem = 'DISH_UNAVAILABLE' | 'MINIMUM_NOT_REACHED' | 'RESTAURANT_CLOSED' | 'COUPON_NOT_APPLICABLE';

export interface CartCoupon {
    code: string;
    /** Null when the coupon could not be priced. */
    kind?: string | null;
    value: number;
    maxDiscountCents?: number | null;
    discountCents: number;
    /** Why it does not apply (`COUPON_MINIMUM_NOT_REACHED`, `COUPON_UNAVAILABLE`, …). */
    problem?: string | null;
}

export interface Cart {
    restaurant: {
        slug: string;
        name: string;
        latitude: number;
        longitude: number;
        deliveryMinutes: number;
        deliveryFeeCents: number;
        minimumOrderCents: number;
    } | null;
    lines: CartLine[];
    itemCount: number;
    subtotalCents: number;
    deliveryFeeCents: number;
    discountCents: number;
    totalCents: number;
    calories: number;
    coupon?: CartCoupon | null;
    problems: CartProblem[];
    orderable: boolean;
}

export interface DropOff {
    latitude: number;
    longitude: number;
    label?: string;
}

export interface Quote {
    etaSeconds: number;
    simulatedMinutes: number;
    distanceMeters: number | null;
    courierShortage: boolean;
    /** `delivery` (live) or `estimate` (the delivery service did not answer) */
    source: 'delivery' | 'estimate';
}

export type OrderStatus = 'PLACED' | 'ACCEPTED' | 'COOKING' | 'PICKED_UP' | 'EN_ROUTE' | 'DELIVERED';

export interface Order {
    id: string;
    status: OrderStatus;
    placedAt: string;
    statusChangedAt: string;
    estimatedArrivalAt: string;
    restaurant: { slug: string; name: string; latitude: number; longitude: number };
    lines: {
        dishId: string;
        name: string;
        quantity: number;
        unitPriceCents: number;
        totalCents: number;
        regularUnitPriceCents?: number | null;
    }[];
    subtotalCents: number;
    deliveryFeeCents: number;
    discountCents: number;
    couponCode?: string | null;
    totalCents: number;
    calories: number;
    dropOff: { latitude: number; longitude: number; label: string | null };
    quoteSource: 'delivery' | 'estimate';
}

export const orderingKeys = {
    cart: ['ordering', 'cart'] as const,
    order: (id: string) => ['ordering', 'order', id] as const,
    orders: ['ordering', 'orders'] as const,
};

export const orderingQueries = {
    cart: (language: Language) => queryOptions({
        queryKey: [...orderingKeys.cart, language],
        queryFn: ({ signal }) => request<Cart>('/api/ordering/v1/cart', {
            auth: true,
            query: { lang: language },
            signal,
        }),
    }),

    order: (language: Language, id: string) => queryOptions({
        queryKey: [
            ...orderingKeys.order(id),
            language,
        ],
        queryFn: ({ signal }) => request<Order>(`/api/ordering/v1/orders/${encodeURIComponent(id)}`, {
            auth: true,
            query: { lang: language },
            signal,
        }),
    }),

    orders: (language: Language) => infiniteQueryOptions({
        queryKey: [...orderingKeys.orders, language],
        queryFn: ({ pageParam, signal }) => request<{ items: Order[]; nextCursor: string | null }>('/api/ordering/v1/orders', {
            auth: true,
            query: { lang: language, cursor: pageParam, limit: 10 },
            signal,
        }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: page => page.nextCursor ?? undefined,
    }),
};

export const ordering = {
    setQuantity: (dishId: string, quantity: number, replaceCart: boolean, language: Language) =>
        request<Cart>(`/api/ordering/v1/cart/items/${encodeURIComponent(dishId)}`, {
            method: 'PUT',
            auth: true,
            query: { lang: language },
            body: { quantity, replaceCart },
        }),

    /** Loyalty prices the coupon; refused ones come back as an ApiError with loyalty's code. */
    applyCoupon: (code: string, language: Language) =>
        request<Cart>('/api/ordering/v1/cart/coupon', {
            method: 'PUT',
            auth: true,
            query: { lang: language },
            body: { code },
        }),

    removeCoupon: (language: Language) =>
        request<Cart>('/api/ordering/v1/cart/coupon', {
            method: 'DELETE',
            auth: true,
            query: { lang: language },
        }),

    quote: (dropOff: DropOff, signal?: AbortSignal) =>
        request<Quote>('/api/ordering/v1/quotes', {
            method: 'POST',
            auth: true,
            body: { dropOff },
            signal,
        }),

    /** The same key for every retry of one checkout: the order is placed once. */
    place: (dropOff: DropOff, idempotencyKey: string, language: Language) =>
        request<Order>('/api/ordering/v1/orders', {
            method: 'POST',
            auth: true,
            query: { lang: language },
            headers: { 'Idempotency-Key': idempotencyKey },
            body: { dropOff },
        }),

    exportOrders: () => request<Order[]>('/api/ordering/v1/me/export', { auth: true }),
};
