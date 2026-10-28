import type { PostHog } from 'posthog-js';
import type { Language } from '../i18n';
import { useSyncExternalStore } from 'react';

import { config } from '../config';

// PostHog, consent first: the SDK is neither downloaded nor initialised before the visitor agrees.
// Even an opted-out PostHog loads its remote config and extension scripts from PostHog's servers,
// so the visitor's IP would reach a third party before deciding (record 028). Without a project
// key it never loads at all.
// Event names follow TRACKING_PLAN.md: snake_case object_verb, typed below.

export type ProductEvent
    = | { event: 'cuisine_filter_changed'; properties: { cuisine: string } }
        | { event: 'dish_add_clicked'; properties: { dish_id: string; restaurant_slug: string; price_cents: number; on_deal: boolean; source: 'menu' | 'search' | 'deals' } }
        | { event: 'language_changed'; properties: { from: Language; to: Language } }
        | { event: 'login_failed'; properties: { code: string } }
        | { event: 'search_filter_changed'; properties: { filter: string; value: string } }
        | { event: 'search_suggestion_selected'; properties: { kind: 'dish' | 'restaurant'; position: number } }
        | { event: 'cart_replaced'; properties: { restaurant_slug: string } }
        | { event: 'checkout_started'; properties: { item_count: number; total_cents: number } }
        | { event: 'drop_off_selected'; properties: { method: 'preset' | 'map' } }
        | { event: 'order_tracking_viewed'; properties: { order_id: string; status: string } }
        | { event: 'order_delivered_seen'; properties: { order_id: string } }
        | { event: 'rewards_viewed'; properties: { level: number; spins_available: number } }
        | { event: 'coupon_apply_clicked'; properties: { kind: string } };

export type Consent = 'granted' | 'denied' | 'pending';

const CONSENT_KEY = 'ne.consent';
const listeners = new Set<() => void>();
/** Told about decisions the visitor makes here, so a logged-in account can keep them. */
const decisionListeners = new Set<(granted: boolean) => void>();

export const analyticsEnabled = config.posthogKey !== '';

let identified: { id: string; locale: string } | undefined;
let posthog: PostHog | undefined;
let loading: Promise<void> | undefined;
/** Events from the moment of consent until the SDK chunk has loaded. */
const pending: [string, Record<string, unknown>][] = [];

function readConsent(): Consent {
    try {
        const value = localStorage.getItem(CONSENT_KEY);
        return value === 'granted' || value === 'denied'
            ? value
            : 'pending';
    }
    catch {
        return 'pending';
    }
}

function load(): Promise<void> {
    if (!analyticsEnabled)
        return Promise.resolve();
    loading ??= import('posthog-js').then(({ default: client }) => {
        client.init(config.posthogKey, {
            api_host: config.posthogHost,
            defaults: '2026-08-30',
            // Also captures the page the visitor consented on.
            capture_pageview: 'history_change',
            person_profiles: 'identified_only',
            persistence: 'localStorage+cookie',
            session_recording: { maskAllInputs: true },
        });
        // A consent withdrawn earlier left PostHog's own opt-out behind.
        if (client.has_opted_out_capturing())
            client.opt_in_capturing();
        if (identified)
            client.identify(identified.id, { locale: identified.locale });
        posthog = client;
        for (const [event, properties] of pending.splice(0))
            client.capture(event, properties);
    });
    return loading;
}

/** On start: PostHog only for visitors who already agreed. */
export function initAnalytics() {
    if (readConsent() === 'granted')
        void load();
}

/**
 * The ids the services link their server-side events with (ktor-posthog reads them), once PostHog
 * is loaded. Set by our own fetch layer rather than posthog-js's tracing extension, which loads
 * from PostHog's servers after init and so missed the first requests of a page.
 */
export function analyticsHeaders(): Record<string, string> {
    if (!posthog)
        return {};
    const headers: Record<string, string> = {
        'X-POSTHOG-DISTINCT-ID': posthog.get_distinct_id(),
    };
    const session = posthog.get_session_id();
    if (session)
        headers['X-POSTHOG-SESSION-ID'] = session;
    return headers;
}

/**
 * Resolves once PostHog is loaded for a visitor who agreed (at most [timeoutMs]), at once otherwise.
 * Loaders whose API calls produce server-side events await it, so the very first request of a
 * deep link already carries the tracing headers that link those events to the visitor.
 */
export function analyticsReady(timeoutMs = 1500): Promise<void> {
    if (readConsent() !== 'granted' || !analyticsEnabled)
        return Promise.resolve();
    return Promise.race([
        load(),
        new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
    ]);
}

export function onConsentDecided(listener: (granted: boolean) => void) {
    decisionListeners.add(listener);
    return () => {
        decisionListeners.delete(listener);
    };
}

export function currentConsent(): Consent {
    return readConsent();
}

/** [fromAccount]: applying the decision stored with the account, so it is not sent back there. */
export function setConsent(granted: boolean, { fromAccount = false } = {}) {
    try {
        localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
    }
    catch {}
    if (granted) {
        if (posthog)
            posthog.opt_in_capturing();
        else
            void load();
    }
    else if (posthog) {
        posthog.opt_out_capturing();
        posthog.reset();
    }
    listeners.forEach(listener => listener());
    if (!fromAccount)
        decisionListeners.forEach(listener => listener(granted));
}

/** Asks again; nothing is captured until the visitor decides. */
export function resetConsent() {
    try {
        localStorage.removeItem(CONSENT_KEY);
    }
    catch {}
    posthog?.opt_out_capturing();
    listeners.forEach(listener => listener());
}

export function useConsent(): Consent {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        readConsent,
    );
}

export function capture<E extends ProductEvent>(event: E['event'], properties: E['properties']) {
    if (posthog)
        posthog.capture(event, properties);
    else if (loading && readConsent() === 'granted')
        pending.push([event, properties]);
}

/** Links events to the account; remembered until PostHog is loaded after consent. */
export function identifyUser(user: { id: string; locale: string }) {
    identified = { id: user.id, locale: user.locale };
    if (readConsent() === 'granted')
        posthog?.identify(user.id, { locale: user.locale });
}

export function resetAnalytics() {
    identified = undefined;
    posthog?.reset();
}
