import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderApp } from './render';

// A shop with a PostHog key: the analytics banner asks every new visitor.
vi.mock('../analytics/analytics', async original => ({
    ...await original<typeof import('../analytics/analytics')>(),
    analyticsEnabled: true,
}));

describe('the analytics banner', () => {
    it('has the corner to itself until the visitor has answered', async () => {
        const { user } = renderApp('/');
        expect(await screen.findByRole('heading', { name: 'Darf NothingEats mitzählen?' })).toBeInTheDocument();
        // The coach's launcher sits in the same corner and covered "Einverstanden".
        expect(screen.queryByRole('button', { name: 'Craving Coach' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Lieber nicht' }));

        expect(await screen.findByRole('button', { name: 'Craving Coach' })).toBeInTheDocument();
    });
});
