import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { searchPage } from './fixtures';
import { renderApp } from './render';
import { server } from './server';

describe('search', () => {
    it('searches from the home page and shows dishes with their restaurant', async () => {
        const { user, router } = renderApp('/');
        const box = await screen.findByRole('combobox', { name: 'Gerichte und Restaurants suchen' });

        await user.type(box, 'pommes{Enter}');

        expect(await screen.findByRole('heading', { level: 1, name: 'Suche nach „pommes“' })).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/search');
        expect(await screen.findByRole('heading', { level: 2, name: '2 Gerichte' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 3, name: 'Trüffelpommes von morgen' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Air Burger' })).toHaveAttribute('href', '/restaurants/air-burger');
    });

    it('narrows by facets, keeps the counts of the alternatives, and resets', async () => {
        const { user, router } = renderApp('/search?q=pommes');
        const cuisines = await screen.findByRole('grid', { name: 'Küche' });

        await user.click(within(cuisines).getByRole('row', { name: 'Griechisch 1' }));

        expect(await screen.findByRole('heading', { level: 2, name: '1 Gericht' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 3, name: 'Gyros-Teller aus Luft' })).toBeInTheDocument();
        expect(router.state.location.search).toEqual({ q: 'pommes', cuisine: 'greek' });

        await user.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));

        expect(await screen.findByRole('heading', { level: 2, name: '2 Gerichte' })).toBeInTheDocument();
        expect(router.state.location.search).toEqual({ q: 'pommes' });
    });

    it('opens a restaurant straight from a suggestion', async () => {
        const { user, router } = renderApp('/search');
        const box = await screen.findByRole('combobox', { name: 'Gerichte und Restaurants suchen' });

        await user.type(box, 'air');
        await user.click(await screen.findByRole('option', { name: 'Air Burger' }));

        await waitFor(() => expect(router.state.location.pathname).toBe('/restaurants/air-burger'));
    });

    it('says so when nothing matches', async () => {
        server.use(http.get('/api/search/v1/dishes', () => HttpResponse.json(searchPage([]))));
        renderApp('/search?q=sushi');

        expect(await screen.findByRole('heading', { level: 2, name: 'Keine Gerichte' })).toBeInTheDocument();
        expect(screen.getByText(/Nichts gefunden/)).toBeInTheDocument();
    });
});
