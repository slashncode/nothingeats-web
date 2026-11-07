import { http, HttpResponse } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';

import { server } from './server';

const OLD = 'https://updates.push.services.mozilla.com/wpush/v2/old';
const NEW = 'https://updates.push.services.mozilla.com/wpush/v2/new';
const KEY = new Uint8Array([4, 1, 2, 3]).buffer;

function subscription(endpoint: string) {
    return {
        endpoint,
        options: { applicationServerKey: KEY },
        toJSON: () => ({
            endpoint,
            expirationTime: null,
            keys: { p256dh: 'BP256', auth: 'secret' },
        }),
    };
}

const subscribed: unknown[] = [];

/** Fires a `pushsubscriptionchange` at the worker and waits for what it started. */
async function subscriptionChanged(oldSubscription: unknown, newSubscription: unknown) {
    const waits: Promise<unknown>[] = [];
    const event = Object.assign(new Event('pushsubscriptionchange'), {
        oldSubscription,
        newSubscription,
        waitUntil: (promise: Promise<unknown>) => waits.push(promise),
    });
    globalThis.dispatchEvent(event);
    await Promise.all(waits);
}

function rotations() {
    const seen: unknown[] = [];
    server.use(http.post('/api/notification/v1/push/subscriptions/rotation', async ({ request }) => {
        seen.push(await request.json());
        return new HttpResponse(null, { status: 204 });
    }));
    return seen;
}

describe('the service worker', () => {
    beforeAll(async () => {
        // The worker's globals, as far as these tests need them.
        Object.assign(globalThis, {
            registration: {
                pushManager: {
                    subscribe: async (options: unknown) => {
                        subscribed.push(options);
                        return subscription(NEW);
                    },
                },
            },
        });
        // @ts-expect-error -- a plain script for the worker, typed by tsconfig.sw.json
        await import('../../public/sw.js');
    });

    it('moves a rotated subscription to its new endpoint, with the old one as proof', async () => {
        const seen = rotations();

        await subscriptionChanged(subscription(OLD), subscription(NEW));

        expect(seen).toEqual([
            {
                oldEndpoint: OLD,
                endpoint: NEW,
                expirationTime: null,
                keys: { p256dh: 'BP256', auth: 'secret' },
            },
        ]);
    });

    it('subscribes again with the same key when the browser hands over no new subscription', async () => {
        const seen = rotations();
        subscribed.length = 0;

        await subscriptionChanged(subscription(OLD), null);

        expect(subscribed).toEqual([
            { userVisibleOnly: true, applicationServerKey: KEY },
        ]);
        expect(seen).toEqual([
            expect.objectContaining({ oldEndpoint: OLD, endpoint: NEW }),
        ]);
    });

    it('does nothing without an old subscription: there is nothing to prove', async () => {
        const seen = rotations();

        await subscriptionChanged(null, subscription(NEW));

        expect(seen).toEqual([]);
    });
});
