import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { setAccessToken } from '../api/http';
import { i18next } from '../i18n';
import { server } from './server';
import '@testing-library/jest-dom/vitest';

// Routes are code-split; the first visit to one transforms its chunk, which can take over a second.
configure({ asyncUtilTimeout: 3000 });

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
