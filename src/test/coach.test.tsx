import type { CoachDish } from '../api/assistant';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { margherita, session } from './fixtures';
import { renderApp } from './render';
import { server } from './server';

const recommended: CoachDish = {
    id: margherita.id,
    slug: margherita.slug,
    name: margherita.name,
    description: margherita.description,
    cuisine: 'italian',
    restaurant: { id: 'r-phantom-pizza', slug: 'phantom-pizza', name: 'Phantom Pizza' },
    priceCents: margherita.priceCents,
    dietary: margherita.dietary,
    allergens: margherita.allergens,
    spiceLevel: margherita.spiceLevel,
    calories: margherita.calories,
    moods: margherita.moods,
    openNow: true,
    reason: 'Käsig und warm, genau richtig für heute.',
};

/** An AI SDK UI message stream as the assistant sends it: search, recommend, answer. */
function answer(): Response {
    const chunks = [
        { type: 'start', messageId: 'msg-coach-1' },
        { type: 'start-step' },
        {
            type: 'tool-input-available',
            toolCallId: 'call-1',
            toolName: 'searchDishes',
            input: { query: 'warmes Essen' },
        },
        {
            type: 'tool-output-available',
            toolCallId: 'call-1',
            output: {
                dishes: [
                    { id: margherita.id },
                ],
            },
        },
        { type: 'finish-step' },
        { type: 'start-step' },
        {
            type: 'tool-input-available',
            toolCallId: 'call-2',
            toolName: 'recommendDishes',
            input: {
                dishes: [
                    { id: margherita.id, reason: recommended.reason },
                ],
            },
        },
        {
            type: 'tool-output-available',
            toolCallId: 'call-2',
            output: {
                shown: [recommended],
                notShown: [],
            },
        },
        { type: 'finish-step' },
        { type: 'start-step' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hier ist was Warmes. ' },
        { type: 'text-delta', id: 'text-1', delta: 'Satt wirst du trotzdem nicht.' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish-step' },
        { type: 'finish' },
    ];
    const body = `${chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`;
    return new HttpResponse(body, {
        headers: { 'Content-Type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
    });
}

describe('the craving coach', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    it('asks visitors to sign in first', async () => {
        const { user } = renderApp('/');

        await user.click(await screen.findByRole('button', { name: 'Craving Coach' }));

        const dialog = await screen.findByRole('dialog', { name: 'Craving Coach' });
        expect(within(dialog).getByText(/Melde dich an/)).toBeInTheDocument();
        expect(within(dialog).getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', expect.stringContaining('/login?redirect='));
    });

    it('sends only the newest message, shows the search, the recommended dishes and the answer, and adds a dish to the cart', async () => {
        const requests: { id: string; language: string; message: { role: string; parts: { text: string }[] } }[] = [];
        const added: string[] = [];
        let conversation = '';
        server.use(
            http.post('/api/identity/v1/sessions/refresh', () => HttpResponse.json(session)),
            http.get('/api/assistant/v1/conversations/:id', ({ params }) => {
                conversation = String(params.id);
                return HttpResponse.json({ code: 'CONVERSATION_NOT_FOUND', title: 'Not found', status: 404 }, {
                    status: 404,
                    headers: { 'Content-Type': 'application/problem+json' },
                });
            }),
            http.post('/api/assistant/v1/chat', async ({ request }) => {
                expect(request.headers.get('Authorization')).toBe('Bearer access-token');
                requests.push(await request.json() as never);
                return answer();
            }),
            http.put('/api/ordering/v1/cart/items/:dishId', ({ params }) => {
                added.push(String(params.dishId));
                return HttpResponse.json({
                    restaurant: null,
                    lines: [],
                    itemCount: 1,
                    subtotalCents: 0,
                    deliveryFeeCents: 0,
                    discountCents: 0,
                    totalCents: 0,
                    calories: 0,
                    problems: [],
                    orderable: false,
                });
            }),
        );
        const { user } = renderApp('/');

        await user.click(await screen.findByRole('button', { name: 'Craving Coach' }));
        const dialog = await screen.findByRole('dialog', { name: 'Craving Coach' });
        await user.type(await within(dialog).findByRole('textbox', { name: 'Deine Nachricht an den Craving Coach' }), 'Etwas Warmes{Enter}');

        const log = within(dialog).getByRole('log', { name: 'Gespräch mit dem Craving Coach' });
        expect(await within(log).findByText('Hier ist was Warmes. Satt wirst du trotzdem nicht.')).toBeInTheDocument();
        expect(within(log).getByText('Etwas Warmes')).toBeInTheDocument();
        expect(within(log).getByText('Gesucht: „warmes Essen“')).toBeInTheDocument();
        const cards = within(log).getByRole('list', { name: 'Vorschläge des Craving Coach' });
        expect(within(cards).getByText(recommended.reason)).toBeInTheDocument();
        expect(within(cards).getByRole('link', { name: 'Phantom Pizza' })).toHaveAttribute('href', '/restaurants/phantom-pizza');

        expect(requests).toEqual([
            {
                id: conversation,
                language: 'de',
                message: expect.objectContaining({
                    role: 'user',
                    parts: [
                        { type: 'text', text: 'Etwas Warmes' },
                    ],
                }),
            },
        ]);

        await user.click(within(cards).getByRole('button', { name: `${margherita.name} in den Warenkorb` }));
        await waitFor(() => expect(added).toEqual([margherita.id]));
    });

    it('explains a used-up budget instead of showing the server\'s words', async () => {
        server.use(
            http.post('/api/identity/v1/sessions/refresh', () => HttpResponse.json(session)),
            http.get('/api/assistant/v1/conversations/:id', () => HttpResponse.json({ id: 'x', title: '', messages: [] })),
            http.post('/api/assistant/v1/chat', () =>
                HttpResponse.json({ code: 'COACH_TOO_MANY_MESSAGES', title: 'The coach needs a break', status: 429 }, {
                    status: 429,
                    headers: { 'Content-Type': 'application/problem+json', 'Retry-After': '120' },
                })),
        );
        const { user } = renderApp('/');

        await user.click(await screen.findByRole('button', { name: 'Craving Coach' }));
        const dialog = await screen.findByRole('dialog', { name: 'Craving Coach' });
        await user.click(await within(dialog).findByRole('button', { name: 'Vegan und unter 12 €' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Du hast für den Moment genug gefragt.');
    });
});
