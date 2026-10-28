import type { Cart, Order } from '../api/ordering';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { margherita, session } from './fixtures';
import { renderApp } from './render';
import { server } from './server';

const restaurant = {
    slug: 'phantom-pizza',
    name: 'Phantom Pizza',
    latitude: 53.5503,
    longitude: 9.9667,
    deliveryMinutes: 30,
    deliveryFeeCents: 199,
    minimumOrderCents: 1200,
};

function cartWith(quantity: number): Cart {
    const subtotal = quantity * margherita.priceCents;
    return {
        restaurant: quantity > 0
            ? restaurant
            : null,
        lines: quantity > 0
            ? [
                    {
                        dishId: margherita.id,
                        name: margherita.name,
                        unitPriceCents: margherita.priceCents,
                        quantity,
                        totalCents: subtotal,
                        available: true,
                    },
                ]
            : [],
        itemCount: quantity,
        subtotalCents: subtotal,
        deliveryFeeCents: quantity > 0
            ? 199
            : 0,
        discountCents: 0,
        totalCents: quantity > 0
            ? subtotal + 199
            : 0,
        calories: quantity * margherita.calories,
        problems: quantity > 0 && subtotal < 1200
            ? ['MINIMUM_NOT_REACHED']
            : [],
        orderable: subtotal >= 1200,
    };
}

/**
 * A signed-in customer and the ordering, delivery and notification APIs with state: a cart,
 * placed orders and a live stream the test can write to.
 */
function orderingWorld() {
    let quantity = 0;
    const orders: Order[] = [];
    const keys: string[] = [];
    const replaced: boolean[] = [];
    let push: (event: string, data: object) => void = () => {};

    server.use(
        http.post('/api/identity/v1/sessions/refresh', () => HttpResponse.json(session)),
        http.get('/api/ordering/v1/cart', () => HttpResponse.json(cartWith(quantity))),
        http.put('/api/ordering/v1/cart/items/:dishId', async ({ request, params }) => {
            const body = await request.json() as { quantity: number; replaceCart: boolean };
            replaced.push(body.replaceCart);
            if (params.dishId === 'gyros' && !body.replaceCart && quantity > 0) {
                return HttpResponse.json(
                    { code: 'CART_OTHER_RESTAURANT', title: 'Conflict', status: 409 },
                    {
                        status: 409,
                        headers: { 'Content-Type': 'application/problem+json' },
                    },
                );
            }
            quantity = body.quantity;
            return HttpResponse.json(cartWith(quantity));
        }),
        http.post('/api/ordering/v1/quotes', () =>
            HttpResponse.json({
                etaSeconds: 174,
                simulatedMinutes: 29,
                distanceMeters: 2759,
                courierShortage: false,
                source: 'delivery',
            })),
        http.post('/api/ordering/v1/orders', ({ request }) => {
            keys.push(request.headers.get('Idempotency-Key') ?? '');
            const cart = cartWith(quantity);
            const order: Order = {
                id: `order-${orders.length + 1}`,
                status: 'PLACED',
                placedAt: new Date().toISOString(),
                statusChangedAt: new Date().toISOString(),
                estimatedArrivalAt: new Date(Date.now() + 174_000).toISOString(),
                restaurant: {
                    slug: restaurant.slug,
                    name: restaurant.name,
                    latitude: restaurant.latitude,
                    longitude: restaurant.longitude,
                },
                lines: cart.lines.map(line => ({
                    dishId: line.dishId,
                    name: line.name,
                    quantity: line.quantity,
                    unitPriceCents: line.unitPriceCents,
                    totalCents: line.totalCents,
                })),
                subtotalCents: cart.subtotalCents,
                deliveryFeeCents: cart.deliveryFeeCents,
                discountCents: 0,
                totalCents: cart.totalCents,
                calories: cart.calories,
                dropOff: { latitude: 53.5636, longitude: 9.9654, label: 'Sternschanze' },
                quoteSource: 'delivery',
            };
            orders.unshift(order);
            quantity = 0;
            return HttpResponse.json(order, { status: 201 });
        }),
        http.get('/api/ordering/v1/orders/:id', ({ params }) => {
            const order = orders.find(it => it.id === params.id);
            return order
                ? HttpResponse.json(order)
                : HttpResponse.json({ code: 'ORDER_NOT_FOUND', status: 404 }, {
                        status: 404,
                        headers: { 'Content-Type': 'application/problem+json' },
                    });
        }),
        http.get('/api/ordering/v1/orders', () => HttpResponse.json({ items: orders, nextCursor: null })),
        http.get('/api/delivery/v1/deliveries/:id', ({ params }) => HttpResponse.json({
            orderId: params.id,
            status: 'ACCEPTED',
            restaurantName: restaurant.name,
            pickup: { latitude: restaurant.latitude, longitude: restaurant.longitude },
            dropOff: { latitude: 53.5636, longitude: 9.9654 },
            dropOffLabel: 'Sternschanze',
            courier: {
                name: 'Nora Nebel',
                vehicle: 'BIKE',
                position: { latitude: 53.55, longitude: 9.97 },
            },
            approachRoute: [],
            deliveryRoute: [],
            steps: [
                {
                    status: 'ACCEPTED',
                    at: new Date().toISOString(),
                    done: true,
                },
            ],
            estimatedArrivalAt: new Date(Date.now() + 174_000).toISOString(),
            serverTime: new Date().toISOString(),
        })),
        http.get('/api/notification/v1/stream', () => {
            // CRLF line endings, like the real server (Ktor).
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
        }),
    );

    return {
        orders,
        keys,
        replaced,
        push: (event: string, data: object) => push(event, data),
    };
}

describe('ordering nothing', () => {
    it('goes from the menu through checkout to live tracking until nothing arrives', async () => {
        const world = orderingWorld();
        const { user, router } = renderApp('/restaurants/phantom-pizza');
        const pizza = await screen.findByRole('region', { name: 'Pizza' });

        await user.click(within(pizza).getByRole('button', { name: 'Margherita des Nichts in den Warenkorb' }));
        expect(await screen.findByText('Margherita des Nichts liegt im Warenkorb.')).toBeInTheDocument();
        await user.click(within(pizza).getByRole('button', { name: 'Margherita des Nichts in den Warenkorb' }));

        await user.click(await screen.findByRole('link', { name: 'Warenkorb, 2 Gerichte' }));
        expect(await screen.findByRole('heading', { level: 2, name: 'Von Phantom Pizza' })).toBeInTheDocument();
        expect(await screen.findByText(/Ankunft in etwa 3 Minuten\./)).toBeInTheDocument();
        expect(screen.getByText(/Ein echter Kurier bräuchte 29 Minuten\./)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Mit Willenskraft bezahlen' }));

        expect(await screen.findByRole('heading', { level: 1, name: 'Deine Bestellung bei Phantom Pizza' })).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/orders/order-1');
        expect(world.keys).toHaveLength(1);
        expect(world.keys[0]).toMatch(/^[\w-]{36}$/);
        expect(screen.getByRole('list', { name: 'Bestellstatus' })).toBeInTheDocument();
        expect(await screen.findByText('Nora Nebel kommt mit dem Fahrrad.')).toBeInTheDocument();

        // The delivery service says it's done; the stream tells the page, the page reloads the order.
        world.orders[0]!.status = 'DELIVERED';
        await waitFor(() => world.push('order.updated', { orderId: 'order-1', status: 'DELIVERED' }), { timeout: 5000 });
        expect(await screen.findByText('Nichts ist angekommen. Guten Appetit!', {}, { timeout: 5000 })).toBeInTheDocument();
    });

    it('asks before a dish from another restaurant starts a new cart', async () => {
        const world = orderingWorld();
        server.use(http.get('/api/catalog/v1/restaurants/:slug', () => HttpResponse.json({
            restaurant: {
                slug: 'ghost-gyros',
                name: 'Ghost Gyros',
                description: '',
                cuisine: 'greek',
                rating: 4.5,
                deliveryMinutes: 25,
                deliveryFeeCents: 149,
                minimumOrderCents: 1000,
                openNow: true,
                opensAt: '11:00',
                closesAt: '23:00',
            },
            sections: [
                {
                    name: 'Teller',
                    dishes: [
                        { ...margherita, id: 'gyros', name: 'Gyros-Teller aus Luft' },
                    ],
                },
            ],
        })));
        const { user } = renderApp('/restaurants/ghost-gyros');
        const plates = await screen.findByRole('region', { name: 'Teller' });
        await user.click(within(plates).getByRole('button', { name: 'Gyros-Teller aus Luft in den Warenkorb' }));
        await screen.findByText('Gyros-Teller aus Luft liegt im Warenkorb.');

        // The cart now holds something (quantity 1 of "gyros" as far as this fake knows); the next add conflicts.
        await user.click(within(plates).getByRole('button', { name: 'Gyros-Teller aus Luft in den Warenkorb' }));

        const dialog = await screen.findByRole('dialog', { name: 'Neuen Warenkorb anfangen?' });
        await user.click(within(dialog).getByRole('button', { name: 'Neu anfangen' }));

        await waitFor(() => expect(world.replaced.at(-1)).toBe(true));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('lists past orders with what was not spent', async () => {
        const world = orderingWorld();
        world.orders.push({
            id: 'order-9',
            status: 'DELIVERED',
            placedAt: '2026-10-26T12:00:00Z',
            statusChangedAt: '2026-10-26T12:03:00Z',
            estimatedArrivalAt: '2026-10-26T12:03:00Z',
            restaurant: {
                slug: 'phantom-pizza',
                name: 'Phantom Pizza',
                latitude: 53.55,
                longitude: 9.96,
            },
            lines: [],
            subtotalCents: 2180,
            deliveryFeeCents: 199,
            discountCents: 0,
            totalCents: 2379,
            calories: 1640,
            dropOff: { latitude: 53.56, longitude: 9.96, label: null },
            quoteSource: 'delivery',
        });
        renderApp('/orders');

        expect(await screen.findByRole('heading', { level: 1, name: 'Deine Bestellungen' })).toBeInTheDocument();
        expect(await screen.findByText(/Bisher nicht ausgegeben: 23,79/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Phantom Pizza/ })).toHaveAttribute('href', '/orders/order-9');
    });
});
