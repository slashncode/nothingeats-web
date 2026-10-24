import { useEffect, useSyncExternalStore } from 'react';

// Light, dark or whatever the system prefers; nothingeats-ui themes through the `dark` class on <html>.

export type ColorScheme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'ne.colorScheme';
const listeners = new Set<() => void>();
const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');

function read(): ColorScheme {
    try {
        const value = localStorage.getItem(STORAGE_KEY);
        return value === 'light' || value === 'dark'
            ? value
            : 'system';
    }
    catch {
        return 'system';
    }
}

function apply(scheme: ColorScheme) {
    const dark = scheme === 'dark' || (scheme === 'system' && (media?.matches ?? false));
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function setColorScheme(scheme: ColorScheme) {
    try {
        localStorage.setItem(STORAGE_KEY, scheme);
    }
    catch {}
    apply(scheme);
    listeners.forEach(listener => listener());
}

export function useColorScheme(): ColorScheme {
    const scheme = useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        read,
    );
    useEffect(() => {
        apply(scheme);
        if (scheme !== 'system' || !media)
            return;
        const follow = () => apply('system');
        media.addEventListener('change', follow);
        return () => media.removeEventListener('change', follow);
    }, [scheme]);
    return scheme;
}
