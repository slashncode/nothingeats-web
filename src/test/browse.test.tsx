import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderApp } from './render';

describe('browsing', () => {
    it('lists the restaurants in German and filters by cuisine', async () => {
        const { user, router } = renderApp('/');

        expect(await screen.findByRole('heading', { level: 1, name: 'Hunger auf nichts?' })).toBeInTheDocument();
        expect(await screen.findByText('3 Restaurants liefern gerade nichts nach Hamburg. Mit echter Bestellung, echter Lieferzeit und null Kalorien.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Phantom Pizza' })).toHaveAttribute('href', '/restaurants/phantom-pizza');

        await user.click(screen.getByRole('row', { name: 'Griechisch' }));

        expect(await screen.findByRole('link', { name: 'Ghost Gyros' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Phantom Pizza' })).not.toBeInTheDocument();
        expect(router.state.location.search).toEqual({ cuisine: 'greek' });
    });

    it('switches the whole app to English, data included', async () => {
        const { user } = renderApp('/');
        await screen.findByRole('link', { name: 'Air Burger' });

        await user.click(screen.getByRole('button', { name: 'Sprache: Deutsch. Auf Englisch wechseln' }));

        expect(await screen.findByRole('heading', { level: 1, name: 'Craving nothing?' })).toBeInTheDocument();
        expect(await screen.findByText('Smash burgers that only sizzle in your head.')).toBeInTheDocument();
        expect(screen.getAllByText('Free delivery').length).toBeGreaterThan(0);
        expect(document.documentElement.lang).toBe('en');
        expect(localStorage.getItem('ne.language')).toBe('en');
    });

    it('shows a menu, and "adding" a dish explains that nothing comes', async () => {
        const { user } = renderApp('/restaurants/phantom-pizza');

        expect(await screen.findByRole('heading', { level: 1, name: 'Phantom Pizza' })).toBeInTheDocument();
        const pizza = screen.getByRole('region', { name: 'Pizza' });
        expect(within(pizza).getByRole('heading', { name: 'Margherita des Nichts' })).toBeInTheDocument();

        await user.click(within(pizza).getByRole('button', { name: 'Margherita des Nichts in den Warenkorb' }));

        expect(await screen.findByText('Margherita des Nichts kommt (nicht).')).toBeInTheDocument();
    });

    it('says so when a restaurant does not exist', async () => {
        renderApp('/restaurants/ghost-kitchen');

        expect(await screen.findByRole('heading', { name: 'Dieses Restaurant gibt es nicht. Noch weniger als die anderen.' })).toBeInTheDocument();
    });

    it('has a not-found page', async () => {
        renderApp('/nowhere');

        expect(await screen.findByRole('heading', { name: 'Diese Seite gibt es nicht. Wie das Essen.' })).toBeInTheDocument();
    });
});
