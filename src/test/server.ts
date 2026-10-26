import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { gyrosPlate, margherita, restaurants, searchPage, session, truffleFries } from './fixtures';

function problem(status: number, code: string) {
    return HttpResponse.json({
        type: 'about:blank',
        title: code,
        status,
        code,
    }, {
        status,
        headers: { 'Content-Type': 'application/problem+json' },
    });
}

/** Default answers of the NothingEats APIs; tests override single handlers with server.use(). */
export const handlers = [
    http.get('/api/catalog/v1/restaurants', ({ request }) => {
        const url = new URL(request.url);
        const language = url.searchParams.get('lang') === 'en'
            ? 'en'
            : 'de';
        const cuisine = url.searchParams.get('cuisine');
        const items = restaurants[language].filter(restaurant => !cuisine || restaurant.cuisine === cuisine);
        return HttpResponse.json({ items, nextCursor: null });
    }),
    http.get('/api/catalog/v1/restaurants/:slug', ({ params }) => {
        const restaurant = restaurants.de.find(candidate => candidate.slug === params.slug);
        if (!restaurant)
            return problem(404, 'RESTAURANT_NOT_FOUND');
        return HttpResponse.json({
            restaurant,
            sections: [
                {
                    name: 'Pizza',
                    dishes: [margherita],
                },
            ],
        });
    }),
    // A tiny search: "pommes" finds both dishes; filters narrow by cuisine and diet.
    http.get('/api/search/v1/dishes', ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get('q')?.toLowerCase() ?? '';
        const cuisines = url.searchParams.get('cuisine')?.split(',') ?? [];
        const diets = url.searchParams.get('diet')?.split(',') ?? [];
        const items = [truffleFries, gyrosPlate]
            .filter(dish => q === '' || `${dish.name} ${dish.description}`.toLowerCase().includes(q))
            .filter(dish => cuisines.length === 0 || cuisines.includes(dish.restaurant.cuisine))
            .filter(dish => diets.every(diet => dish.dietary.includes(diet)));
        return HttpResponse.json(searchPage(items));
    }),
    http.get('/api/search/v1/suggestions', ({ request }) => {
        const q = new URL(request.url).searchParams.get('q')?.toLowerCase() ?? '';
        const items = [
            {
                text: 'Air Burger',
                kind: 'restaurant',
                target: 'air-burger',
                restaurantSlug: 'air-burger',
            },
            {
                text: 'Trüffelpommes von morgen',
                kind: 'dish',
                target: truffleFries.id,
                restaurantSlug: 'air-burger',
            },
        ].filter(suggestion => suggestion.text.toLowerCase().split(/\s/).some(word => word.startsWith(q)) || suggestion.text.toLowerCase().startsWith(q));
        return HttpResponse.json({ items });
    }),
    // The live stream: says it is ready, then ends (the app reconnects; tests that need events replace it).
    http.get('/api/notification/v1/stream', () =>
        new HttpResponse('event: ready\ndata: {}\n\n', {
            headers: { 'Content-Type': 'text/event-stream' },
        })),
    // No session cookie by default.
    http.post('/api/identity/v1/sessions/refresh', () => problem(401, 'REFRESH_TOKEN_INVALID')),
    http.post('/api/identity/v1/sessions', async ({ request }) => {
        const body = await request.json() as { password: string };
        return body.password === 'correct horse battery'
            ? HttpResponse.json(session)
            : problem(401, 'INVALID_CREDENTIALS');
    }),
    http.delete('/api/identity/v1/sessions/current', () => new HttpResponse(null, { status: 204 })),
    http.post('/api/identity/v1/registrations', () => HttpResponse.json({ message: 'Check your inbox' }, { status: 202 })),
    http.post('/api/identity/v1/magic-links', () => HttpResponse.json({ message: 'If the address has an account…' }, { status: 202 })),
    http.post('/api/identity/v1/magic-links/sessions', async ({ request }) => {
        const body = await request.json() as { token: string };
        return body.token === 'magic-token'
            ? HttpResponse.json(session)
            : problem(401, 'MAGIC_LINK_INVALID');
    }),
    http.put('/api/identity/v1/me/consent', async ({ request }) => {
        const body = await request.json() as { analytics: boolean };
        return HttpResponse.json({ ...session.user, analyticsConsent: body.analytics });
    }),
    http.post('/api/identity/v1/me/deletion', async ({ request }) => {
        const body = await request.json() as { password: string };
        return body.password === 'correct horse battery'
            ? new HttpResponse(null, { status: 204 })
            : problem(403, 'PASSWORD_CONFIRMATION_FAILED');
    }),
    http.post('/api/identity/v1/password-resets', () => HttpResponse.json({ message: 'If the address has an account…' }, { status: 202 })),
    http.post('/api/identity/v1/password-resets/confirmations', async ({ request }) => {
        const body = await request.json() as { token: string };
        return body.token === 'reset-token'
            ? new HttpResponse(null, { status: 204 })
            : problem(422, 'PASSWORD_RESET_TOKEN_INVALID');
    }),
    http.post('/api/identity/v1/password-resets', () => HttpResponse.json({ message: 'If the address has an account…' }, { status: 202 })),
    http.post('/api/identity/v1/password-resets/confirmations', async ({ request }) => {
        const body = await request.json() as { token: string };
        return body.token === 'reset-token'
            ? new HttpResponse(null, { status: 204 })
            : problem(422, 'PASSWORD_RESET_TOKEN_INVALID');
    }),
    http.post('/api/identity/v1/verifications', async ({ request }) => {
        const body = await request.json() as { token: string };
        return body.token === 'valid-token'
            ? new HttpResponse(null, { status: 204 })
            : problem(400, 'VERIFICATION_TOKEN_INVALID');
    }),
];

export const server = setupServer(...handlers);
