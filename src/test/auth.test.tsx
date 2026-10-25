import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { session } from './fixtures';
import { renderApp } from './render';
import { server } from './server';

describe('accounts', () => {
    it('rejects a wrong password with a German message', async () => {
        const { user } = renderApp('/login');

        await user.type(await screen.findByRole('textbox', { name: 'E-Mail' }), 'ghost@nothingeats.dev');
        await user.type(screen.getByLabelText('Passwort'), 'not my password');
        await user.click(screen.getByRole('button', { name: 'Anmelden' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('E-Mail oder Passwort stimmen nicht.');
    });

    it('logs in, goes back where it came from, and logs out', async () => {
        const { user, router } = renderApp('/login?redirect=%2Faccount');

        await user.type(await screen.findByRole('textbox', { name: 'E-Mail' }), 'ghost@nothingeats.dev');
        await user.type(screen.getByLabelText('Passwort'), 'correct horse battery');
        await user.click(screen.getByRole('button', { name: 'Anmelden' }));

        expect(await screen.findByRole('heading', { name: 'Dein Konto' })).toBeInTheDocument();
        expect(screen.getByText('ghost@nothingeats.dev')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/account');

        await user.click(screen.getByRole('button', { name: 'Abmelden' }));

        expect(await screen.findByRole('link', { name: 'Anmelden' })).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
    });

    it('restores a session from the refresh cookie, refreshing exactly once', async () => {
        let refreshes = 0;
        server.use(http.post('/api/identity/v1/sessions/refresh', () => {
            refreshes += 1;
            return HttpResponse.json(session);
        }));

        renderApp('/');

        expect(await screen.findByRole('link', { name: 'Konto' })).toBeInTheDocument();
        expect(refreshes).toBe(1);
    });

    it('sends the account page to login when there is no session', async () => {
        const { router } = renderApp('/account');

        expect(await screen.findByRole('heading', { name: 'Anmelden' })).toBeInTheDocument();
        expect(router.state.location.search).toEqual({ redirect: '/account' });
    });

    it('registers, but checks the password length first', async () => {
        let registrations = 0;
        server.use(http.post('/api/identity/v1/registrations', () => {
            registrations += 1;
            return HttpResponse.json({ message: 'Check your inbox' }, { status: 202 });
        }));
        const { user } = renderApp('/register');

        await user.type(await screen.findByRole('textbox', { name: 'E-Mail' }), 'new@nothingeats.dev');
        await user.type(screen.getByLabelText('Passwort'), 'short');
        await user.click(screen.getByRole('button', { name: 'Registrieren' }));
        expect(registrations).toBe(0);

        await user.clear(screen.getByLabelText('Passwort'));
        await user.type(screen.getByLabelText('Passwort'), 'correct horse battery');
        await user.click(screen.getByRole('button', { name: 'Registrieren' }));

        expect(await screen.findByRole('status')).toHaveTextContent('Wir haben dir eine E-Mail geschickt');
        expect(registrations).toBe(1);
    });

    it('verifies the address from the mail link once', async () => {
        let verifications = 0;
        server.use(http.post('/api/identity/v1/verifications', () => {
            verifications += 1;
            return new HttpResponse(null, { status: 204 });
        }));

        renderApp('/verify?token=valid-token');

        expect(await screen.findByText('Deine E-Mail-Adresse ist bestätigt. Willkommen bei NothingEats!')).toBeInTheDocument();
        expect(verifications).toBe(1);
    });

    it('explains an invalid verification link', async () => {
        renderApp('/verify?token=stale');

        expect(await screen.findByRole('alert')).toHaveTextContent('Dieser Link ist ungültig oder abgelaufen.');
    });
});

describe('forgotten passwords', () => {
    it('asks for a link from the login page', async () => {
        const { user } = renderApp('/login');

        await user.click(await screen.findByRole('link', { name: 'Passwort vergessen?' }));
        await user.type(await screen.findByRole('textbox', { name: 'E-Mail' }), 'ghost@nothingeats.dev');
        await user.click(screen.getByRole('button', { name: 'Link schicken' }));

        expect(await screen.findByRole('status')).toHaveTextContent('Wenn es zu dieser Adresse ein Konto gibt, ist ein Link unterwegs.');
    });

    it('sets a new password with the link from the mail', async () => {
        const { user } = renderApp('/reset-password?token=reset-token');

        await user.type(await screen.findByLabelText('Neues Passwort'), 'a brand new passphrase');
        await user.click(screen.getByRole('button', { name: 'Passwort speichern' }));

        expect(await screen.findByRole('status')).toHaveTextContent('Dein Passwort ist geändert.');
    });

    it('offers a new link when the old one is used up', async () => {
        const { user } = renderApp('/reset-password?token=used-token');

        await user.type(await screen.findByLabelText('Neues Passwort'), 'a brand new passphrase');
        await user.click(screen.getByRole('button', { name: 'Passwort speichern' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Dieser Link ist ungültig, abgelaufen oder schon benutzt worden.');
        expect(screen.getByRole('link', { name: 'Neuen Link anfordern' })).toHaveAttribute('href', '/forgot-password');
    });

    it('says how long to wait after too many attempts', async () => {
        server.use(http.post('/api/identity/v1/sessions', () => HttpResponse.json(
            {
                type: 'about:blank',
                title: 'Too many attempts',
                status: 429,
                code: 'TOO_MANY_ATTEMPTS',
            },
            {
                status: 429,
                headers: { 'Retry-After': '540' },
            },
        )));
        const { user } = renderApp('/login');

        await user.type(await screen.findByRole('textbox', { name: 'E-Mail' }), 'ghost@nothingeats.dev');
        await user.type(screen.getByLabelText('Passwort'), 'any password at all');
        await user.click(screen.getByRole('button', { name: 'Anmelden' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Zu viele Versuche. Bitte warte 9 Minuten und versuch es dann noch einmal.');
    });
});
