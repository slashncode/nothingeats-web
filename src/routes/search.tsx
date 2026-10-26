import type { Key } from 'react-aria-components';
import type { DishSearch, FacetValue } from '../api/search';
import { ALLERGENS, Button, DishCard, Radio, RadioGroup, Switch, Tag, TagGroup, useCatalogLabels } from '@slashncode/nothingeats-ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useNumberFormatter } from 'react-aria';
import { useTranslation } from 'react-i18next';

import { analyticsReady, capture } from '../analytics/analytics';
import { searchQueries } from '../api/search';
import { useAddToCart } from '../components/cart';
import { Page } from '../components/Page';
import { SiteSearch } from '../components/SiteSearch';
import { currentLanguage } from '../i18n';
import { ErrorState } from './__root';
import styles from './search.module.scss';

type ListFilter = 'cuisine' | 'diet' | 'mood' | 'without';

function text(value: unknown) {
    return typeof value === 'string' && value.trim() !== ''
        ? value.trim()
        : undefined;
}

function count(value: unknown, max: number) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 && number <= max
        ? number
        : undefined;
}

const list = (value: string | undefined) => value?.split(',').filter(Boolean) ?? [];

export const Route = createFileRoute('/search')({
    validateSearch: (search: Record<string, unknown>): DishSearch => ({
        q: text(search.q),
        cuisine: text(search.cuisine),
        diet: text(search.diet),
        mood: text(search.mood),
        without: text(search.without),
        maxSpice: count(search.maxSpice, 3),
        maxPrice: count(search.maxPrice, 100_000),
        openNow: search.openNow === true || search.openNow === 'true'
            ? true
            : undefined,
    }),
    loaderDeps: ({ search }) => search,
    // The search API counts every search for the visitor (search_performed), so wait for the tracing headers.
    loader: async ({ context, deps }) => {
        await analyticsReady();
        return context.queryClient.ensureInfiniteQueryData(searchQueries.dishes(currentLanguage(), deps));
    },
    component: Search,
});

function Search() {
    const { t } = useTranslation();
    const labels = useCatalogLabels();
    const money = useNumberFormatter({ style: 'currency', currency: 'EUR', minimumFractionDigits: 0 });
    const search = Route.useSearch();
    const navigate = useNavigate({ from: '/search' });
    const { add: addDish, dialog: cartDialog } = useAddToCart();
    const results = useInfiniteQuery(searchQueries.dishes(currentLanguage(), search));

    const pages = results.data?.pages ?? [];
    const items = pages.flatMap(page => page.items);
    const facets = pages[0]?.facets;
    const total = pages[0]?.total ?? 0;
    const filtered = Boolean(search.cuisine || search.diet || search.mood || search.without || search.maxSpice !== undefined || search.maxPrice !== undefined || search.openNow);

    function update(filter: string, value: string, next: Partial<DishSearch>) {
        void navigate({
            search: previous => ({
                ...previous,
                ...next,
            }),
        });
        capture('search_filter_changed', { filter, value });
    }

    function selectList(filter: ListFilter, keys: 'all' | Set<Key>) {
        const values = keys === 'all'
            ? []
            : [...keys].map(String).sort();
        update(filter, values.join(',') || 'none', { [filter]: values.join(',') || undefined });
    }

    // Selected values stay visible even when the current results have none of them.
    function withSelected(values: FacetValue[] | undefined, selected: string[]) {
        const shown = values ?? [];
        return [
            ...shown,
            ...selected.filter(value => !shown.some(it => it.value === value)).map(value => ({ value, count: 0 })),
        ];
    }

    const facetTags = (filter: ListFilter, label: string, values: FacetValue[], name: (value: string) => string) => (
        <TagGroup
            label={label}
            selectionMode="multiple"
            selectedKeys={list(search[filter])}
            onSelectionChange={keys => selectList(filter, keys)}
            className={styles.facet}
        >
            {values.map(({ value, count }) => (
                <Tag key={value} id={value} textValue={name(value)}>
                    {name(value)}
                    {filter !== 'without' && (
                        <>
                            {' '}
                            <span className={styles.count}>{count}</span>
                        </>
                    )}
                </Tag>
            ))}
        </TagGroup>
    );

    return (
        <Page>
            <section className={styles.top}>
                <h1 className={styles.title}>
                    {search.q
                        ? t('search.titleFor', { query: search.q })
                        : t('search.title')}
                </h1>
                <SiteSearch key={search.q ?? ''} initial={search.q ?? ''} keepFilters className={styles.box} />
            </section>

            <div className={styles.layout}>
                <aside aria-label={t('search.filters')} className={styles.filters}>
                    <Switch isSelected={search.openNow === true} onChange={open => update('open_now', String(open), { openNow: open || undefined })}>
                        {t('search.openNow')}
                    </Switch>
                    {facets && (
                        <>
                            {facetTags('cuisine', t('search.cuisine'), withSelected(facets.cuisine, list(search.cuisine)), labels.cuisine)}
                            {facetTags('diet', t('search.diet'), withSelected(facets.dietary, list(search.diet)), labels.dietary)}
                            {facetTags('mood', t('search.mood'), withSelected(facets.mood, list(search.mood)), labels.mood)}
                            <RadioGroup
                                label={t('search.spice')}
                                value={search.maxSpice === undefined
                                    ? 'any'
                                    : String(search.maxSpice)}
                                onChange={value => update('max_spice', value, {
                                    maxSpice: value === 'any'
                                        ? undefined
                                        : Number(value),
                                })}
                            >
                                <Radio value="any">{t('search.any')}</Radio>
                                {[0, 1, 2].map(level => (
                                    <Radio key={level} value={String(level)}>
                                        {level === 0
                                            ? labels.spice(0)
                                            : t('search.upTo', {
                                                    value: labels.spice(level),
                                                })}
                                    </Radio>
                                ))}
                            </RadioGroup>
                            <RadioGroup
                                label={t('search.price')}
                                value={search.maxPrice === undefined
                                    ? 'any'
                                    : String(search.maxPrice)}
                                onChange={value => update('max_price', value, {
                                    maxPrice: value === 'any'
                                        ? undefined
                                        : Number(value),
                                })}
                            >
                                <Radio value="any">{t('search.any')}</Radio>
                                {facets.price.map(({ value, count }) => (
                                    <Radio key={value} value={value} isDisabled={count === 0 && String(search.maxPrice) !== value}>
                                        {t('search.priceUpTo', {
                                            amount: money.format(Number(value) / 100),
                                            count,
                                        })}
                                    </Radio>
                                ))}
                            </RadioGroup>
                            {facetTags('without', t('search.without'), ALLERGENS.map(value => ({ value, count: 0 })), labels.allergen)}
                        </>
                    )}
                    {filtered && (
                        <Button
                            variant="outline"
                            size="sm"
                            onPress={() => update('reset', 'all', {
                                cuisine: undefined,
                                diet: undefined,
                                mood: undefined,
                                without: undefined,
                                maxSpice: undefined,
                                maxPrice: undefined,
                                openNow: undefined,
                            })}
                        >
                            {t('search.reset')}
                        </Button>
                    )}
                </aside>

                <section aria-labelledby="results" className={styles.results}>
                    <h2 id="results" className={styles.total} aria-live="polite">
                        {results.isSuccess && t('search.total', { count: total })}
                    </h2>
                    {results.isError && <ErrorState onRetry={() => void results.refetch()} />}
                    {results.isSuccess && total === 0 && <p className={styles.empty}>{t('search.empty')}</p>}
                    <ul className={styles.list}>
                        {items.map(dish => (
                            <li key={dish.id}>
                                <DishCard
                                    dish={dish}
                                    restaurant={{ name: dish.restaurant.name, href: `/restaurants/${dish.restaurant.slug}` }}
                                    onAdd={() => addDish(dish, dish.restaurant.slug, 'search')}
                                    headingLevel={3}
                                />
                            </li>
                        ))}
                    </ul>
                    {results.hasNextPage && (
                        <Button variant="outline" className={styles.more} isPending={results.isFetchingNextPage} onPress={() => void results.fetchNextPage()}>
                            {t('search.more')}
                        </Button>
                    )}
                </section>
            </div>
            {cartDialog}
        </Page>
    );
}
