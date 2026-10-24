import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { setAccessToken } from '../api/http';
import { i18next } from '../i18n';
import { server } from './server';
import '@testing-library/jest-dom/vitest';

beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' });
    // jsdom has no layout; the router restores scroll positions.
    window.scrollTo = () => {};
});

beforeEach(async () => {
    localStorage.clear();
    await i18next.changeLanguage('de');
});

afterEach(() => {
    cleanup();
    server.resetHandlers();
    setAccessToken(undefined);
});

afterAll(() => server.close());
