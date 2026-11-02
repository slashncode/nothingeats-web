import type { Language } from '../i18n';
import { currentAccessToken } from '../api/http';
import { notification } from '../api/notification';

/** Where this browser stands: no Push API, notifications blocked, or subscribed or not. */
export type PushStatus = 'unsupported' | 'denied' | 'off' | 'on';

function supported(): boolean {
    return typeof navigator !== 'undefined'
        && 'serviceWorker' in navigator
        && typeof window !== 'undefined'
        && 'PushManager' in window
        && 'Notification' in window;
}

/** The service worker in public/sw.js: push and notification clicks only, no caching. */
export function registerServiceWorker(): void {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator)
        void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

async function currentSubscription(): Promise<PushSubscription | null> {
    if (!supported())
        return null;
    const registration = await navigator.serviceWorker.getRegistration();
    return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function pushStatus(): Promise<PushStatus> {
    if (!supported())
        return 'unsupported';
    if (Notification.permission === 'denied')
        return 'denied';
    return (await currentSubscription())
        ? 'on'
        : 'off';
}

function applicationServerKey(base64Url: string): Uint8Array<ArrayBuffer> {
    const base64 = base64Url.replaceAll('-', '+').replaceAll('_', '/');
    return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), char => char.charCodeAt(0));
}

/** Asks the browser, subscribes and tells notification-service, in the language on screen. */
export async function enablePush(publicKey: string, language: Language): Promise<PushStatus> {
    if (await Notification.requestPermission() !== 'granted')
        return pushStatus();
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey(publicKey),
        });
    await notification.saveSubscription(subscription.toJSON(), language);
    return 'on';
}

/**
 * Switches this browser off, at the server first (while the session still works) and then in
 * the browser. With `server: false` after the account is gone (the server forgot it already).
 */
export async function disablePush({ server = true } = {}): Promise<void> {
    const subscription = await currentSubscription().catch(() => null);
    if (!subscription)
        return;
    if (server)
        await notification.deleteSubscription(subscription.endpoint).catch(() => undefined);
    await subscription.unsubscribe().catch(() => false);
}

/**
 * The push service forgot this browser (the test push said so): drop the old subscription and
 * take a new one. The permission stays, so nothing asks again.
 */
export async function renewPush(publicKey: string, language: Language): Promise<PushStatus> {
    await disablePush({ server: false });
    return enablePush(publicKey, language);
}

/** The language on screen changed: this browser's pushes follow it (only for a signed-in user). */
export async function updatePushLanguage(language: Language): Promise<void> {
    if (!currentAccessToken())
        return;
    const subscription = await currentSubscription().catch(() => null);
    if (subscription)
        await notification.saveSubscription(subscription.toJSON(), language).catch(() => undefined);
}
