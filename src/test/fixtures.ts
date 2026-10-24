import type { DishSummary, RestaurantSummary } from '@slashncode/nothingeats-ui';
import type { Session } from '../api/identity';

type Localized<T> = Record<'de' | 'en', T>;

export const restaurants: Localized<RestaurantSummary[]> = {
    de: [
        restaurant('air-burger', 'Air Burger', 'american', 'Smash-Burger, die nur in deinem Kopf brutzeln.', 0),
        restaurant('ghost-gyros', 'Ghost Gyros', 'greek', 'Griechische Klassiker vom Spieß.', 149),
        restaurant('phantom-pizza', 'Phantom Pizza', 'italian', 'Pizza aus einem Ofen, der nie angeheizt wird.', 199),
    ],
    en: [
        restaurant('air-burger', 'Air Burger', 'american', 'Smash burgers that only sizzle in your head.', 0),
        restaurant('ghost-gyros', 'Ghost Gyros', 'greek', 'Greek classics from the spit.', 149),
        restaurant('phantom-pizza', 'Phantom Pizza', 'italian', 'Pizza from an oven that is never lit.', 199),
    ],
};

function restaurant(slug: string, name: string, cuisine: string, description: string, deliveryFeeCents: number): RestaurantSummary {
    return {
        slug,
        name,
        description,
        cuisine,
        rating: 4.5,
        deliveryMinutes: 30,
        deliveryFeeCents,
        minimumOrderCents: 1200,
        openNow: true,
        opensAt: '11:00',
        closesAt: '23:00',
    };
}

export const margherita: DishSummary = {
    id: '0198f4a2-0000-7000-8000-000000000001',
    slug: 'margherita-of-nothing',
    name: 'Margherita des Nichts',
    description: 'Tomaten, Fior di Latte und Basilikum, die du dir selbst vorstellst.',
    priceCents: 1090,
    dietary: ['vegetarian'],
    allergens: ['gluten', 'milk'],
    spiceLevel: 0,
    calories: 820,
    moods: ['cheesy'],
    available: true,
};

export const session: Session = {
    accessToken: 'access-token',
    tokenType: 'Bearer',
    expiresIn: 900,
    user: {
        id: '0198f4a2-0000-7000-8000-0000000000aa',
        email: 'ghost@nothingeats.dev',
        locale: 'de',
        roles: [],
        verified: true,
    },
};
