import type { Rewards } from '../api/loyalty';
import type { Cart } from '../api/ordering';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { margherita, session } from './fixtures';
import { renderApp } from './render';
import { server } from './server';

const rewards: Rewards = {
    level: {
        level: 2,
        xp: 165,
        levelStartXp: 100,
        nextLevelXp: 250,
    },
    spinsAvailable: 1,
    streak: { days: 2, longest: 2, orderedToday: true },
    stats: {
        orders: 2,
        moneyNotSpentCents: 19_800,
        caloriesAvoided: 3_280,
        restaurants: 1,
    },
    badges: [
        {
            key: 'first-nothing',
            tier: 'BRONZE',
            name: 'Erstes Nichts',
            description: 'Deine erste Bestellung ist (nicht) angekommen.',
            earnedAt: '2026-11-02T11:03:00Z',
        },
        {
            key: 'golden-fork',
            tier: 'GOLD',
            name: 'Goldene Gabel',
            description: 'Der seltenste Gewinn am Glücksrad.',
        },
    ],
    stampCards: [
        {
            restaurantSlug: 'phantom-pizza',
            restaurantName: 'Phantom Pizza',
            stamps: 2,
            perCard: 5,
            completed: 0,
        },
    ],
    coupons: [],
};

const tenPercent = {
    code: 'NE-7KQ3-M9XD',
    kind: 'PERCENT',
    value: 10,
    maxDiscountCents: null,
    minimumOrderCents: 1500,
    restaurant: null,
    source: 'WHEEL' as const,
    expiresAt: '2026-12-02T11:00:00Z',
};

function signedIn() {
    server.use(http.post('/api/identity/v1/sessions/refresh', () => HttpResponse.json(session)));
}

/** A live stream the test writes to; CRLF like the real server. */
function liveStream() {
    let push: (event: string, data: object) => void = () => {};
    server.use(http.get('/api/notification/v1/stream', () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                push = (event, data) => controller.enqueue(encoder.encode(`event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`));
                push('ready', {});
            },
        });
        return new HttpResponse(stream, {
            headers: { 'Content-Type': 'text/event-stream' },
        });
    }));
    return {
        push: (event: string, data: object) => push(event, data),
    };
}

beforeEach(() => {
    // Reduced motion: the wheel stops at once and there is no confetti (jsdom has no transitions or canvas).
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    }));
});

describe('rewards', () => {
    it('shows level, streak, savings, stamp cards and badges on the account subpage', async () => {
        signedIn();
        server.use(http.get('/api/loyalty/v1/me', () => HttpResponse.json(rewards)));
        renderApp('/account/rewards');

        expect(await screen.findByRole('heading', { level: 1, name: 'Deine Belohnungen' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Belohnungen' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('progressbar', { name: 'Level 2' })).toHaveAttribute('aria-valuetext', '65 von 150 XP bis Level 3');
        expect(screen.getByText('2 Tage in Folge')).toBeInTheDocument();
        expect(screen.getByText(/198,00/)).toBeInTheDocument();
        expect(screen.getByRole('list', { name: 'Stempelkarte Phantom Pizza: 2 von 5 Stempeln' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Abzeichen (1 von 2)' })).toBeInTheDocument();
        expect(screen.getByText(/Gold · Noch nicht verdient/)).toBeInTheDocument();
    });

    it('spins the wheel on the server and says what came out', async () => {
        signedIn();
        let spun = false;
        server.use(
            http.get('/api/loyalty/v1/me', () => HttpResponse.json(spun
                ? {
                        ...rewards,
                        spinsAvailable: 0,
                        coupons: [tenPercent],
                    }
                : rewards)),
            http.post('/api/loyalty/v1/spins', () => {
                spun = true;
                return HttpResponse.json({
                    prize: 'PERCENT_10',
                    coupon: tenPercent,
                    xpGained: 0,
                    badges: [],
                    spinsAvailable: 0,
                });
            }),
        );
        const { user } = renderApp('/account/rewards');

        await user.click(await screen.findByRole('button', { name: 'Drehen' }));

        await waitFor(() => expect(screen.getAllByText('Gewonnen: 10 % Rabatt').length).toBeGreaterThan(0));
        expect(await screen.findByRole('heading', { name: '10 % Rabatt' })).toBeInTheDocument();
        expect(await screen.findByText('Der nächste Dreh kommt mit Level 3.')).toBeInTheDocument();
    });

    it('sends anonymous visitors to the login and back to their rewards', async () => {
        const { router } = renderApp('/account/rewards');

        expect(await screen.findByRole('heading', { name: 'Anmelden' })).toBeInTheDocument();
        expect(router.state.location.search).toEqual({ redirect: '/account/rewards' });
    });

    it('announces what an arrived order earned as soon as loyalty publishes it', async () => {
        signedIn();
        const live = liveStream();
        renderApp('/');
        expect(await screen.findByRole('link', { name: 'Konto' })).toBeInTheDocument();

        await waitFor(() => live.push('reward.earned', {
            cause: 'ORDER_DELIVERED',
            orderId: 'o-1',
            xp: {
                gained: 55,
                total: 55,
                level: 1,
                previousLevel: 1,
            },
            spinsGranted: 0,
            streakDays: 1,
            badges: [
                {
                    key: 'first-nothing',
                    tier: 'BRONZE',
                    name: { de: 'Erstes Nichts', en: 'First nothing' },
                },
            ],
            stampCard: {
                restaurantSlug: 'phantom-pizza',
                restaurantName: 'Phantom Pizza',
                stamps: 1,
                perCard: 5,
                completed: false,
            },
            coupons: [],
        }));

        expect(await screen.findByText('+55 XP für dein Nichts')).toBeInTheDocument();
        expect(screen.getByText('Neues Abzeichen: Erstes Nichts · Stempel bei Phantom Pizza (1/5)')).toBeInTheDocument();
    });

    it('lists running flash deals on the home page', async () => {
        server.use(http.get('/api/catalog/v1/deals', () => HttpResponse.json({
            items: [
                {
                    dish: {
                        ...margherita,
                        deal: {
                            priceCents: 760,
                            percentOff: 30,
                            endsAt: new Date(Date.now() + 20 * 60_000).toISOString(),
                        },
                    },
                    restaurant: { slug: 'phantom-pizza', name: 'Phantom Pizza', cuisine: 'italian' },
                    startsAt: new Date().toISOString(),
                },
            ],
        })));
        renderApp('/');

        const deals = await screen.findByRole('region', { name: 'Blitzdeals' });
        expect(within(deals).getByText('−30 %')).toBeInTheDocument();
        expect(within(deals).getByRole('link', { name: 'Phantom Pizza' })).toHaveAttribute('href', '/restaurants/phantom-pizza');
    });
});

describe('coupons at checkout', () => {
    function cart(coupon?: Cart['coupon']): Cart {
        const discount = coupon && !coupon.problem
            ? coupon.discountCents
            : 0;
        return {
            restaurant: {
                slug: 'phantom-pizza',
                name: 'Phantom Pizza',
                latitude: 53.5503,
                longitude: 9.9667,
                deliveryMinutes: 30,
                deliveryFeeCents: 199,
                minimumOrderCents: 1200,
            },
            lines: [
                {
                    dishId: margherita.id,
                    name: margherita.name,
                    unitPriceCents: 760,
                    quantity: 2,
                    totalCents: 1520,
                    available: true,
                    regularUnitPriceCents: 1090,
                    deal: { percentOff: 30, endsAt: '2026-11-02T11:45:00Z' },
                },
            ],
            itemCount: 2,
            subtotalCents: 1520,
            deliveryFeeCents: 199,
            discountCents: discount,
            totalCents: 1520 + 199 - discount,
            calories: 1640,
            coupon: coupon ?? null,
            problems: coupon?.problem
                ? ['COUPON_NOT_APPLICABLE']
                : [],
            orderable: !coupon?.problem,
        };
    }

    it('applies one of the customer\'s coupons and shows the discount; a refused one says why', async () => {
        signedIn();
        const small = {
            ...tenPercent,
            code: 'NE-2345-6789',
            kind: 'AMOUNT',
            value: 500,
            minimumOrderCents: 2000,
        };
        let current = cart();
        server.use(
            http.get('/api/ordering/v1/cart', () => HttpResponse.json(current)),
            http.post('/api/ordering/v1/quotes', () => HttpResponse.json({
                etaSeconds: 174,
                simulatedMinutes: 29,
                distanceMeters: 2759,
                courierShortage: false,
                source: 'delivery',
            })),
            http.get('/api/loyalty/v1/coupons', () => HttpResponse.json({
                items: [tenPercent, small],
            })),
            http.put('/api/ordering/v1/cart/coupon', async ({ request }) => {
                const { code } = await request.json() as { code: string };
                if (code === small.code) {
                    return HttpResponse.json(
                        { code: 'COUPON_MINIMUM_NOT_REACHED', title: 'Conflict', status: 409 },
                        {
                            status: 409,
                            headers: { 'Content-Type': 'application/problem+json' },
                        },
                    );
                }
                current = cart({
                    code,
                    kind: 'PERCENT',
                    value: 10,
                    maxDiscountCents: null,
                    discountCents: 152,
                    problem: null,
                });
                return HttpResponse.json(current);
            }),
            http.delete('/api/ordering/v1/cart/coupon', () => {
                current = cart();
                return HttpResponse.json(current);
            }),
        );
        const { user } = renderApp('/checkout');

        await user.click(await screen.findByRole('button', { name: 'Gutschein NE-2345-6789 einlösen' }));
        expect(await screen.findByText('Der Warenkorb ist für diesen Gutschein zu klein.')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Gutschein NE-7KQ3-M9XD einlösen' }));
        expect(await screen.findByText('Gutschein NE-7KQ3-M9XD')).toBeInTheDocument();
        expect(screen.getAllByText(/-1,52/).length).toBeGreaterThan(0);
        expect(screen.getByText(/15,67/)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Gutschein entfernen' }));
        expect(await screen.findByRole('button', { name: 'Gutschein NE-7KQ3-M9XD einlösen' })).toBeInTheDocument();
    });
});

describe('social', () => {
    it('shows what nobody is eating right now, and new lines as they happen', async () => {
        let push: (event: string, data: object) => void = () => {};
        server.use(
            http.get('/api/social/v1/feed', () => HttpResponse.json({
                items: [
                    {
                        id: 'f-1',
                        kind: 'ORDER',
                        at: new Date(Date.now() - 120_000).toISOString(),
                        restaurantName: 'Phantom Pizza',
                        items: 2,
                        moneyNotSpentCents: 2379,
                    },
                ],
            })),
            http.get('/api/social/v1/feed/stream', () => {
                const encoder = new TextEncoder();
                return new HttpResponse(new ReadableStream<Uint8Array>({
                    start(controller) {
                        push = (event, data) => controller.enqueue(encoder.encode(`event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`));
                        push('ready', {});
                    },
                }), {
                    headers: { 'Content-Type': 'text/event-stream' },
                });
            }),
        );
        renderApp('/');

        const feed = await screen.findByRole('region', { name: 'Gerade nicht gegessen' });
        expect(within(feed).getByText(/Jemand hat 2 Gerichte von Phantom Pizza nicht gegessen und 23,79\s€ gespart\./)).toBeInTheDocument();
        expect(within(feed).getByText('vor 2 Minuten')).toBeInTheDocument();

        await waitFor(() => push('feed.item', {
            id: 'f-2',
            kind: 'LEVEL',
            at: new Date().toISOString(),
            level: 4,
        }));
        expect(await within(feed).findByText('Jemand hat Level 4 erreicht.')).toBeInTheDocument();
    });

    it('joins the leaderboard only when asked, under a pseudonym', async () => {
        signedIn();
        let joined = false;
        server.use(
            http.get('/api/loyalty/v1/me', () => HttpResponse.json(rewards)),
            http.get('/api/social/v1/me', () => HttpResponse.json(joined
                ? {
                        onLeaderboard: true,
                        pseudonym: 'Satter Seehund 42',
                        week: '2026-W45',
                        xp: 55,
                        rank: 2,
                    }
                : {
                        onLeaderboard: false,
                        pseudonym: null,
                        week: '2026-W45',
                        xp: 0,
                        rank: null,
                    })),
            http.put('/api/social/v1/me/leaderboard', async ({ request }) => {
                joined = (await request.json() as { join: boolean }).join;
                return HttpResponse.json({
                    onLeaderboard: true,
                    pseudonym: 'Satter Seehund 42',
                    week: '2026-W45',
                    xp: 55,
                    rank: 2,
                });
            }),
            http.get('/api/social/v1/leaderboard', () => HttpResponse.json({
                week: '2026-W45',
                top: joined
                    ? [
                            { rank: 1, pseudonym: 'Kluger Kranich 7', xp: 180 },
                            { rank: 2, pseudonym: 'Satter Seehund 42', xp: 55 },
                        ]
                    : [
                            { rank: 1, pseudonym: 'Kluger Kranich 7', xp: 180 },
                        ],
            })),
        );
        const { user } = renderApp('/account/rewards');

        const optIn = await screen.findByRole('switch', { name: 'Mit Pseudonym mitmachen' });
        expect(optIn).not.toBeChecked();
        await user.click(optIn);

        expect(await screen.findByText('Du bist Satter Seehund 42: Platz 2 mit 55 XP.')).toBeInTheDocument();
        const list = await screen.findByRole('list', { name: 'Die Besten dieser Woche' });
        await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2));
    });
});
