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
        | { event: 'dish_add_clicked'; properties: { dish_id: string; restaurant_slug: string; price_cents: number } }
        | { event: 'language_changed'; properties: { from: Language; to: Language } }
        | { event: 'login_failed'; properties: { code: string } };

export type Consent = 'granted' | 'denied' | 'pending';

const CONSENT_KEY = 'ne.consent';
const listeners = new Set<() => void>();

export const analyticsEnabled = config.posthogKey !== '';

let identified: { id: string; locale: string } | undefined;
let posthog: PostHog | undefined;
let loading: Promise<void> | undefined;

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
            // The backend links its events to this session through these headers (ktor-posthog).
            tracing_headers: [globalThis.location.hostname],
            session_recording: { maskAllInputs: true },
        });
        // A consent withdrawn earlier left PostHog's own opt-out behind.
        if (client.has_opted_out_capturing())
            client.opt_in_capturing();
        if (identified)
            client.identify(identified.id, { locale: identified.locale });
        posthog = client;
    });
    return loading;
}

/** On start: PostHog only for visitors who already agreed. */
export function initAnalytics() {
    if (readConsent() === 'granted')
        void load();
}

export function setConsent(granted: boolean) {
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
    posthog?.capture(event, properties);
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
