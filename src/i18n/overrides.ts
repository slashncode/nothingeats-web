import type { Language } from './index';
import { useSyncExternalStore } from 'react';

import { i18next } from './index';

// Texts editors changed in the backoffice (journal record 042): the bundle keeps keys and default
// wording, these overrides win. The shop never waits long for them: after a short time it goes on
// with the defaults, and overrides that arrive later re-render the page.

interface Overrides {
    web: Record<string, string>;
    ui: Record<string, string>;
}

const TIMEOUT_MS = 800;
const loaded = new Map<Language, Promise<void>>();
let ui: Partial<Record<Language, Record<string, string>>> = {};
const listeners = new Set<() => void>();

function apply(language: Language, overrides: Overrides) {
    for (const [key, message] of Object.entries(overrides.web ?? {}))
        i18next.addResource(language, 'translation', key, message);
    ui = { ...ui, [language]: overrides.ui ?? {} };
    listeners.forEach(listener => listener());
}

/** Loads the overrides of [language] once; resolves after them or after a short wait, whichever comes first. */
export function loadOverrides(language: Language): Promise<void> {
    let load = loaded.get(language);
    if (!load) {
        load = fetch(`/api/backoffice/v1/texts?lang=${language}`)
            .then(response => (response.ok
                ? response.json() as Promise<Overrides>
                : undefined))
            .then(overrides => overrides && apply(language, overrides))
            .catch(() => {
                // The backoffice is down: the shop speaks with its default words.
                loaded.delete(language);
            });
        loaded.set(language, load);
    }
    return Promise.race([
        load,
        new Promise<void>(resolve => setTimeout(resolve, TIMEOUT_MS)),
    ]);
}

/** The overrides of nothingeats-ui's strings, for UiStringsProvider. */
export function useUiOverrides() {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        () => ui,
    );
}

/** For tests: forget what was loaded. */
export function resetOverrides() {
    loaded.clear();
    ui = {};
}
