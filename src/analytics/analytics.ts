import type { PostHog } from 'posthog-js';
import type { Language } from '../i18n';
import { useSyncExternalStore } from 'react';

import { config } from '../config';

// PostHog, consent first: until the visitor agrees, PostHog runs opted out with in-memory
// persistence, so nothing is sent and nothing is stored. Without a project key the SDK is never
// downloaded; with one, it loads as its own chunk after the app started.
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

export async function initAnalytics() {
    if (!analyticsEnabled)
        return;
    const { default: client } = await import('posthog-js');
    const granted = readConsent() === 'granted';
    client.init(config.posthogKey, {
        api_host: config.posthogHost,
        defaults: '2026-08-30',
        capture_pageview: 'history_change',
        person_profiles: 'identified_only',
        opt_out_capturing_by_default: !granted,
        persistence: granted ? 'localStorage+cookie' : 'memory',
        // The backend links its events to this session through these headers (ktor-posthog).
        tracing_headers: [globalThis.location.hostname],
        session_recording: { maskAllInputs: true },
    });
    posthog = client;
    if (granted && identified)
        client.identify(identified.id, { locale: identified.locale });
}

export function setConsent(granted: boolean) {
    try {
        localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
    }
    catch {}
    if (posthog) {
        if (granted) {
            posthog.set_config({ persistence: 'localStorage+cookie' });
            posthog.opt_in_capturing();
            if (identified)
                posthog.identify(identified.id, { locale: identified.locale });
        }
        else {
            posthog.opt_out_capturing();
            posthog.set_config({ persistence: 'memory' });
        }
    }
    listeners.forEach(listener => listener());
}

/** Asks again: back to opted out until the visitor decides. */
export function resetConsent() {
    try {
        localStorage.removeItem(CONSENT_KEY);
    }
    catch {}
    if (posthog) {
        posthog.opt_out_capturing();
        posthog.set_config({ persistence: 'memory' });
    }
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

/** Links events to the account; held back until consent, then sent. */
export function identifyUser(user: { id: string; locale: string }) {
    identified = { id: user.id, locale: user.locale };
    if (readConsent() === 'granted')
        posthog?.identify(user.id, { locale: user.locale });
}

export function resetAnalytics() {
    identified = undefined;
    posthog?.reset();
}
