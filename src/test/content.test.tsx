import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { i18next } from '../i18n';
import { loadOverrides, resetOverrides } from '../i18n/overrides';
import { margherita, session } from './fixtures';
import { renderApp } from './render';
import { server } from './server';

describe('the magazine', () => {
    it('lists articles, filters by category and by tag', async () => {
        const { user } = renderApp('/articles');

        expect(await screen.findByRole('heading', { level: 1, name: 'Magazin' })).toBeInTheDocument();
        expect(await screen.findByRole('link', { name: 'Die Pizza, die nie kam' })).toHaveAttribute('href', '/articles/die-pizza-die-nie-kam');
        expect(screen.getByRole('link', { name: 'Luftbrot backen' })).toBeInTheDocument();

        await user.click(within(screen.getByRole('navigation', { name: 'Rubriken' })).getByRole('link', { name: 'Rezepte' }));
        await waitFor(() => expect(screen.queryByRole('link', { name: 'Die Pizza, die nie kam' })).not.toBeInTheDocument());
        expect(screen.getByRole('link', { name: 'Luftbrot backen' })).toBeInTheDocument();
    });

    it('shows an article with its body and tags; an unknown one says so', async () => {
        const { user } = renderApp('/articles/die-pizza-die-nie-kam');

        expect(await screen.findByRole('heading', { level: 1, name: 'Die Pizza, die nie kam' })).toBeInTheDocument();
        expect(screen.getByText('Gut so.')).toBeInTheDocument();
        expect(screen.getByText('2 Minuten Lesezeit', { exact: false })).toBeInTheDocument();
        await user.click(screen.getByRole('link', { name: '#Pizza' }));
        expect(await screen.findByText('Schlagwort: Pizza')).toBeInTheDocument();

        renderApp('/articles/gibt-es-nicht');
        expect(await screen.findByRole('heading', { name: /Diesen Artikel gibt es nicht/ })).toBeInTheDocument();
    });
});

describe('texts from the backoffice', () => {
    afterEach(() => {
        resetOverrides();
        i18next.addResource('de', 'translation', 'nav.articles', 'Magazin');
    });

    it('override the bundled wording of the app and of the components', async () => {
        server.use(http.get('/api/backoffice/v1/texts', () => HttpResponse.json({
            web: { 'nav.articles': 'Lesestoff' },
            ui: { 'dish.calories': '{calories} kcal gespart' },
        })));
        await loadOverrides('de');
        renderApp('/restaurants/phantom-pizza');

        expect(await screen.findByRole('link', { name: 'Lesestoff' })).toBeInTheDocument();
        expect(await screen.findByText(`${new Intl.NumberFormat('de-DE').format(margherita.calories)} kcal gespart`)).toBeInTheDocument();
    });
});

describe('the backoffice in the shop', () => {
    it('gives the wheel its labels and the coach its suggestions', async () => {
        server.use(
            http.post('/api/identity/v1/sessions/refresh', () => HttpResponse.json(session)),
            http.get('/api/loyalty/v1/me', () => HttpResponse.json({
                level: {
                    level: 2,
                    xp: 165,
                    levelStartXp: 100,
                    nextLevelXp: 250,
                },
                spinsAvailable: 1,
                streak: { days: 0, longest: 0, orderedToday: false },
                stats: {
                    orders: 2,
                    moneyNotSpentCents: 0,
                    caloriesAvoided: 0,
                    restaurants: 1,
                },
                badges: [],
                stampCards: [],
                coupons: [],
            })),
            http.get('/api/loyalty/v1/wheel', () => HttpResponse.json({
                prizes: [
                    { key: 'AMOUNT_5', label: 'Fünf Euro weg' },
                    { key: 'BONUS_XP', label: '+50 XP' },
                ],
            })),
            http.get('/api/backoffice/v1/coach-suggestions', () => HttpResponse.json({
                items: ['Etwas Knuspriges um Mitternacht'],
            })),
            http.get('/api/assistant/v1/conversations/:id', () => HttpResponse.json({ code: 'CONVERSATION_NOT_FOUND', status: 404 }, {
                status: 404,
                headers: { 'Content-Type': 'application/problem+json' },
            })),
            http.get('/api/ordering/v1/cart', () => HttpResponse.json({
                restaurant: null,
                lines: [],
                itemCount: 0,
                subtotalCents: 0,
                deliveryFeeCents: 0,
                discountCents: 0,
                totalCents: 0,
                calories: 0,
                problems: [],
                orderable: false,
            })),
        );
        const { user } = renderApp('/account/rewards');

        expect(await screen.findByText('Fünf Euro weg')).toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: 'Craving Coach' }));
        const dialog = await screen.findByRole('dialog', { name: 'Craving Coach' });
        expect(await within(dialog).findByRole('button', { name: 'Etwas Knuspriges um Mitternacht' })).toBeInTheDocument();
    });

    it('links admins to the backoffice', async () => {
        server.use(http.post('/api/identity/v1/sessions/refresh', () => HttpResponse.json({
            ...session,
            user: {
                ...session.user,
                roles: ['admin', 'customer'],
            },
        })));
        renderApp('/account');

        expect(await screen.findByRole('link', { name: 'Backoffice' })).toHaveAttribute('href', '/admin');
    });
});
