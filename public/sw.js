// @ts-check
/// <reference lib="webworker" />

// The service worker exists for web push only. It has no fetch handler on purpose: it never stands
// between the browser and the network, so it can neither serve a stale shop nor touch the
// backoffice under /admin on the same origin, and a new version can take over at once.

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (globalThis));

sw.addEventListener('install', () => void sw.skipWaiting());
sw.addEventListener('activate', event => event.waitUntil(sw.clients.claim()));

/**
 * What notification-service sends (nothingeats-notification-service, `PushPayload`).
 * @typedef {{ title: string, body: string, url: string, tag: string, always?: boolean }} Push
 */

/** Paths in the shop only: a notification never opens another site. */
function shopUrl(/** @type {unknown} */ path) {
    const url = new URL(typeof path === 'string'
        ? path
        : '/', sw.location.origin);
    return url.origin === sw.location.origin
        ? url.href
        : sw.location.origin;
}

sw.addEventListener('push', (event) => {
    /** @type {Push | undefined} */
    let push;
    try {
        push = event.data?.json();
    }
    catch {
        return;
    }
    if (!push?.title)
        return;
    const { title, body, url, tag, always } = push;
    event.waitUntil((async () => {
        const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
        // A visible tab already shows it live (toast, timeline, confetti); a notification would repeat it.
        // The test push from the account page shows anyway: that is where it is asked for.
        if (!always && windows.some(client => client.visibilityState === 'visible'))
            return;
        await sw.registration.showNotification(title, {
            body,
            tag,
            data: {
                url: shopUrl(url),
            },
            icon: '/icon-192.png',
            badge: '/badge-96.png',
        });
    })());
});

sw.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = shopUrl(event.notification.data?.url);
    event.waitUntil((async () => {
        const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const open = windows.find(client => new URL(client.url).origin === sw.location.origin);
        if (open) {
            await open.focus();
            await open.navigate(url).catch(() => sw.clients.openWindow(url));
            return;
        }
        await sw.clients.openWindow(url);
    })());
});
