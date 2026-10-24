// Runtime configuration from /env.js (written at container start), so one image runs anywhere.

interface RuntimeConfig {
    /** PostHog project API key; empty disables analytics entirely. */
    posthogKey: string;
    posthogHost: string;
}

declare global {
    interface Window {
        __NOTHINGEATS__?: Partial<RuntimeConfig>;
    }
}

export const config: RuntimeConfig = {
    posthogKey: '',
    posthogHost: 'https://eu.i.posthog.com',
    ...globalThis.window?.__NOTHINGEATS__,
};
