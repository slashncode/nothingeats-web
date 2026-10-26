import type { DishSummary, RestaurantSummary } from '@slashncode/nothingeats-ui';
import type { Session } from '../api/identity';
import type { DishHit, DishSearchPage } from '../api/search';

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

export const truffleFries: DishHit = {
    id: '0198f4a2-0000-7000-8000-000000000002',
    slug: 'truffle-fries-of-tomorrow',
    name: 'Trüffelpommes von morgen',
    description: 'Knusprige Pommes mit Trüffelöl und Parmesan.',
    section: 'Beilagen',
    priceCents: 590,
    dietary: ['gluten_free', 'vegetarian'],
    allergens: ['milk'],
    spiceLevel: 0,
    calories: 480,
    moods: ['crispy', 'salty'],
    available: true,
    restaurant: { slug: 'air-burger', name: 'Air Burger', cuisine: 'american' },
};

export const gyrosPlate: DishHit = {
    id: '0198f4a2-0000-7000-8000-000000000003',
    slug: 'gyros-plate-of-air',
    name: 'Gyros-Teller aus Luft',
    description: 'Mariniertes Schweinefleisch vom Spieß mit Tzatziki und Pommes.',
    section: 'Hauptgerichte',
    priceCents: 1450,
    dietary: [],
    allergens: ['milk'],
    spiceLevel: 0,
    calories: 1100,
    moods: ['hearty'],
    available: true,
    restaurant: { slug: 'ghost-gyros', name: 'Ghost Gyros', cuisine: 'greek' },
};

/** What the search API answers for [items], with facets counted over them. */
export function searchPage(items: DishHit[]): DishSearchPage {
    const counts = (values: string[]) => Object.entries(
        values.reduce<Record<string, number>>((all, value) => ({ ...all, [value]: (all[value] ?? 0) + 1 }), {}),
    ).map(([value, count]) => ({ value, count }));
    return {
        items,
        total: items.length,
        page: 0,
        size: 20,
        facets: {
            cuisine: counts(items.map(dish => dish.restaurant.cuisine)),
            dietary: counts(items.flatMap(dish => dish.dietary)),
            mood: counts(items.flatMap(dish => dish.moods)),
            spiceLevel: counts(items.map(dish => String(dish.spiceLevel))),
            price: [800, 1200, 1500, 2000].map(step => ({
                value: String(step),
                count: items.filter(dish => dish.priceCents <= step).length,
            })),
        },
    };
}
