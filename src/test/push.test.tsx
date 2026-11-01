import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { session } from './fixtures';
import { renderApp } from './render';
import { server } from './server';

const endpoint = 'https://fcm.googleapis.com/fcm/send/ghost-phone';

/** The Push API jsdom lacks: a service worker registration with a push manager, and Notification. */
function stubPushApi(permission: NotificationPermission = 'default') {
    let current: PushSubscription | null = null;
    const unsubscribe = vi.fn(async () => {
        current = null;
        return true;
    });
    const pushManager = {
        getSubscription: vi.fn(async () => current),
        subscribe: vi.fn(async () => {
            current = {
                endpoint,
                unsubscribe,
                toJSON: () => ({
                    endpoint,
                    keys: { p256dh: 'BPublicKey', auth: 'secret' },
                }),
            } as unknown as PushSubscription;
            return current;
        }),
    };
    const registration = { pushManager };
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', Object.assign(class {}, {
        permission,
        requestPermission: vi.fn(async () => 'granted' as NotificationPermission),
    }));
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            register: vi.fn(async () => registration),
            getRegistration: vi.fn(async () => registration),
            ready: Promise.resolve(registration),
        },
    });
    return { pushManager, unsubscribe };
}

describe('push notifications', () => {
    beforeEach(() => {
        server.use(
            http.post('/api/identity/v1/sessions/refresh', () => HttpResponse.json(session)),
            http.get('/api/notification/v1/push/key', () => HttpResponse.json({ publicKey: 'BGhvc3Q' })),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        Reflect.deleteProperty(navigator, 'serviceWorker');
    });

    it('are switched on in the language on screen, and logging out takes this browser off', async () => {
        const { pushManager, unsubscribe } = stubPushApi();
        const saved: unknown[] = [];
        const removed: string[] = [];
        server.use(
            http.put('/api/notification/v1/push/subscriptions', async ({ request }) => {
                saved.push(await request.json());
                return new HttpResponse(null, { status: 204 });
            }),
            http.delete('/api/notification/v1/push/subscriptions', ({ request }) => {
                removed.push(new URL(request.url).searchParams.get('endpoint')!);
                return new HttpResponse(null, { status: 204 });
            }),
        );
        const { user } = renderApp('/account');

        const toggle = await screen.findByRole('switch', { name: 'Push-Nachrichten auf diesem Gerät' });
        expect(toggle).not.toBeChecked();
        await user.click(toggle);

        await waitFor(() => expect(toggle).toBeChecked());
        expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
        expect(saved).toEqual([
            {
                endpoint,
                keys: { p256dh: 'BPublicKey', auth: 'secret' },
                language: 'de',
            },
        ]);

        await user.click(screen.getByRole('button', { name: 'Abmelden' }));
        await waitFor(() => expect(removed).toEqual([endpoint]));
        expect(unsubscribe).toHaveBeenCalled();
    });

    it('explain why they cannot be switched on', async () => {
        stubPushApi('denied');
        renderApp('/account');

        expect(await screen.findByRole('switch', { name: 'Push-Nachrichten auf diesem Gerät' })).toBeDisabled();
        expect(screen.getByText(/Du hast Benachrichtigungen für NothingEats blockiert/)).toBeInTheDocument();
    });

    it('say so on a browser without the Push API', async () => {
        renderApp('/account');

        expect(await screen.findByRole('switch', { name: 'Push-Nachrichten auf diesem Gerät' })).toBeDisabled();
        expect(screen.getByText(/Dieser Browser kann keine Push-Nachrichten/)).toBeInTheDocument();
    });

    it('are not offered when the cluster has no push keys', async () => {
        stubPushApi();
        let asked = false;
        server.use(http.get('/api/notification/v1/push/key', () => {
            asked = true;
            return HttpResponse.json({ code: 'PUSH_DISABLED', status: 404 }, {
                status: 404,
                headers: { 'Content-Type': 'application/problem+json' },
            });
        }));
        renderApp('/account');

        expect(await screen.findByRole('button', { name: 'Daten herunterladen' })).toBeInTheDocument();
        await waitFor(() => expect(asked).toBe(true));
        expect(screen.queryByRole('heading', { name: 'Benachrichtigungen' })).not.toBeInTheDocument();
    });
});
