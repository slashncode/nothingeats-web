import type { Key } from 'react-aria-components';
import { Button, DishCard, RestaurantCard, Tag, TagGroup, useCatalogLabels } from '@slashncode/nothingeats-ui';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { capture } from '../analytics/analytics';
import { catalogQueries } from '../api/catalog';
import { useAddToCart } from '../components/cart';
import { Page } from '../components/Page';
import { SiteSearch } from '../components/SiteSearch';
import { currentLanguage } from '../i18n';
import { ErrorState } from './__root';
import styles from './index.module.scss';

interface HomeSearch {
    cuisine?: string;
}

export const Route = createFileRoute('/')({
    validateSearch: (search: Record<string, unknown>): HomeSearch => ({
        cuisine: typeof search.cuisine === 'string' && search.cuisine !== ''
            ? search.cuisine
            : undefined,
    }),
    loaderDeps: ({ search }) => ({ cuisine: search.cuisine }),
    loader: ({ context, deps }) => context.queryClient.ensureInfiniteQueryData(catalogQueries.restaurants(currentLanguage(), deps.cuisine)),
    component: Home,
});

function Home() {
    const { t } = useTranslation();
    const labels = useCatalogLabels();
    const { cuisine } = Route.useSearch();
    const navigate = useNavigate({ from: '/' });
    const language = currentLanguage();
    const overview = useQuery(catalogQueries.overview(language));
    const restaurants = useInfiniteQuery(catalogQueries.restaurants(language, cuisine));
    const deals = useQuery(catalogQueries.deals(language));
    const { add: addDish, dialog: cartDialog } = useAddToCart();

    function selectCuisine(keys: 'all' | Set<Key>) {
        const key = keys === 'all'
            ? 'all'
            : String([...keys][0] ?? 'all');
        const next = key === 'all'
            ? undefined
            : key;
        void navigate({
            search: { cuisine: next },
        });
        capture('cuisine_filter_changed', { cuisine: key });
    }

    const items = restaurants.data?.pages.flatMap(page => page.items) ?? [];
    return (
        <Page>
            <section className={styles.hero}>
                <h1 className={styles.title}>{t('home.title')}</h1>
                {overview.data && <p className={styles.lead}>{t('home.lead', { count: overview.data.count })}</p>}
                <SiteSearch className={styles.search} />
            </section>

            {deals.data && deals.data.length > 0 && (
                <section aria-labelledby="deals" className={styles.deals}>
                    <div>
                        <h2 id="deals" className={styles.dealsTitle}>{t('home.deals')}</h2>
                        <p className={styles.dealsLead}>{t('home.dealsLead')}</p>
                    </div>
                    <ul className={styles.dealGrid}>
                        {deals.data.map(offer => (
                            <li key={offer.dish.id}>
                                <DishCard
                                    dish={offer.dish}
                                    restaurant={{ name: offer.restaurant.name, href: `/restaurants/${offer.restaurant.slug}` }}
                                    onAdd={dish => void addDish(dish, offer.restaurant.slug, 'deals')}
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {overview.data && (
                <TagGroup
                    label={t('home.cuisines')}
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={[cuisine ?? 'all']}
                    onSelectionChange={selectCuisine}
                >
                    <Tag id="all">{t('home.allCuisines')}</Tag>
                    {overview.data.cuisines.map(slug => <Tag key={slug} id={slug}>{labels.cuisine(slug)}</Tag>)}
                </TagGroup>
            )}

            {restaurants.isError && <ErrorState onRetry={() => void restaurants.refetch()} />}
            {restaurants.isSuccess && items.length === 0 && <p>{t('home.empty')}</p>}
            <ul className={styles.grid}>
                {items.map(restaurant => (
                    <li key={restaurant.slug}>
                        <RestaurantCard restaurant={restaurant} href={`/restaurants/${restaurant.slug}`} headingLevel={2} />
                    </li>
                ))}
            </ul>
            {restaurants.hasNextPage && (
                <Button
                    variant="outline"
                    className={styles.more}
                    isPending={restaurants.isFetchingNextPage}
                    onPress={() => void restaurants.fetchNextPage()}
                >
                    {t('home.loadMore')}
                </Button>
            )}
            {cartDialog}
        </Page>
    );
}
