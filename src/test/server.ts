import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { margherita, restaurants, session } from './fixtures';

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
    http.post('/api/identity/v1/verifications', async ({ request }) => {
        const body = await request.json() as { token: string };
        return body.token === 'valid-token'
            ? new HttpResponse(null, { status: 204 })
            : problem(400, 'VERIFICATION_TOKEN_INVALID');
    }),
];

export const server = setupServer(...handlers);
