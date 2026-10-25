import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { session } from './fixtures';
import { renderApp } from './render';
import { server } from './server';

function loggedIn(analyticsConsent: boolean | null = null) {
    server.use(http.post('/api/identity/v1/sessions/refresh', () =>
        HttpResponse.json({
            ...session,
            user: { ...session.user, analyticsConsent },
        })));
}

describe('passwordless login', () => {
    it('sends a link from the login page', async () => {
        const { user } = renderApp('/login');

        await user.click(await screen.findByRole('link', { name: 'Mit E-Mail-Link anmelden' }));
        await screen.findByRole('heading', { name: 'Anmelden ohne Passwort' });
        await user.type(screen.getByRole('textbox', { name: 'E-Mail' }), 'ghost@nothingeats.dev');
        await user.click(screen.getByRole('button', { name: 'Link schicken' }));

        expect(await screen.findByRole('status')).toHaveTextContent('der Anmeldelink unterwegs');
    });

    it('logs in with the link from the mail and lands on the start page', async () => {
        const { router } = renderApp('/magic-login?token=magic-token');

        expect(await screen.findByRole('link', { name: 'Konto' })).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
    });

    it('explains a used link and offers a new one', async () => {
        renderApp('/magic-login?token=used');

        expect(await screen.findByRole('alert')).toHaveTextContent('Dieser Anmeldelink ist ungültig');
        expect(screen.getByRole('link', { name: 'Mit E-Mail-Link anmelden' })).toHaveAttribute('href', '/magic-link');
    });
});

describe('privacy', () => {
    it('applies the consent kept with the account on a new device', async () => {
        loggedIn(true);
        renderApp('/');

        await screen.findByRole('link', { name: 'Konto' });

        expect(localStorage.getItem('ne.consent')).toBe('granted');
    });

    it('keeps a decision made before login with an account that has none', async () => {
        localStorage.setItem('ne.consent', 'denied');
        let stored: unknown;
        server.use(http.put('/api/identity/v1/me/consent', async ({ request }) => {
            stored = await request.json();
            return HttpResponse.json({ ...session.user, analyticsConsent: false });
        }));
        loggedIn(null);
        renderApp('/');

        await screen.findByRole('link', { name: 'Konto' });

        await expect.poll(() => stored).toEqual({ analytics: false });
    });

    it('deletes the account only with the right password, then is logged out', async () => {
        loggedIn();
        const { user, router } = renderApp('/account');

        await user.type(await screen.findByLabelText('Zur Bestätigung dein Passwort'), 'wrong password!!');
        await user.click(screen.getByRole('button', { name: 'Konto endgültig löschen' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Das Passwort stimmt nicht.');

        await user.clear(screen.getByLabelText('Zur Bestätigung dein Passwort'));
        await user.type(screen.getByLabelText('Zur Bestätigung dein Passwort'), 'correct horse battery');
        await user.click(screen.getByRole('button', { name: 'Konto endgültig löschen' }));

        expect(await screen.findByText('Dein Konto ist gelöscht. Danke fürs Nichtessen.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Anmelden' })).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
    });
});
