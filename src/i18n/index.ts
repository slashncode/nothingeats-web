import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';

export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** React Aria locale for number, money and date formats (EUR, 24-hour clock in both). */
export const RAC_LOCALES: Record<Language, string> = { de: 'de-DE', en: 'en-GB' };

const STORAGE_KEY = 'ne.language';

export function isLanguage(value: unknown): value is Language {
    return LANGUAGES.includes(value as Language);
}

/** A saved choice wins, then the browser's languages, then German. */
function initialLanguage(): Language {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (isLanguage(saved))
            return saved;
    }
    catch {}
    const browser = (globalThis.navigator?.languages ?? []).map(tag => tag.slice(0, 2));
    return browser.find(isLanguage) ?? 'de';
}

export function rememberLanguage(language: Language) {
    try {
        localStorage.setItem(STORAGE_KEY, language);
    }
    catch {}
}

export function hasRememberedLanguage() {
    try {
        return isLanguage(localStorage.getItem(STORAGE_KEY));
    }
    catch {
        return false;
    }
}

export function currentLanguage(): Language {
    return isLanguage(i18next.language)
        ? i18next.language
        : 'de';
}

i18next.on('languageChanged', (language) => {
    document.documentElement.lang = language;
});

// Resources are bundled, so initialisation is synchronous: translations exist before the first render.
void i18next
    .use(ICU)
    .use(initReactI18next)
    .init({
        resources: {
            de: { translation: de },
            en: { translation: en },
        },
        lng: initialLanguage(),
        fallbackLng: 'de',
        supportedLngs: [...LANGUAGES],
        interpolation: { escapeValue: false },
        returnNull: false,
        initAsync: false,
    });

export { i18next };
