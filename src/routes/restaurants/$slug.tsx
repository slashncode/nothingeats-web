import type { DishSummary } from '@slashncode/nothingeats-ui';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { DishCard, FoodCover, Link, OpenStatus, Rating, toastQueue, useCatalogLabels } from '@slashncode/nothingeats-ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ArrowLeft, Bike, Clock } from 'lucide-react';
import { useNumberFormatter } from 'react-aria';
import { useTranslation } from 'react-i18next';

import { capture } from '../../analytics/analytics';
import { catalogQueries } from '../../api/catalog';
import { ApiError } from '../../api/http';
import { Page } from '../../components/Page';
import { currentLanguage } from '../../i18n';
import { ErrorState } from '../__root';
import styles from './$slug.module.scss';

export const Route = createFileRoute('/restaurants/$slug')({
    loader: ({ context, params }) => context.queryClient.ensureQueryData(catalogQueries.menu(currentLanguage(), params.slug)),
    component: Restaurant,
    errorComponent: RestaurantError,
});

function Restaurant() {
    const { t } = useTranslation();
    const labels = useCatalogLabels();
    const money = useNumberFormatter({ style: 'currency', currency: 'EUR' });
    const { slug } = Route.useParams();
    const menu = useQuery(catalogQueries.menu(currentLanguage(), slug));
    if (!menu.data)
        return null;
    const { restaurant, sections } = menu.data;

    function add(dish: DishSummary) {
        toastQueue.add(
            {
                title: t('restaurant.addedTitle', { dish: dish.name }),
                description: t('restaurant.addedDescription'),
                variant: 'info',
            },
            { timeout: 6000 },
        );
        capture('dish_add_clicked', { dish_id: dish.id, restaurant_slug: restaurant.slug, price_cents: dish.priceCents });
    }

    return (
        <Page>
            <Link href="/" className={styles.back}>
                <ArrowLeft aria-hidden size={16} />
                {t('restaurant.back')}
            </Link>
            <header className={styles.header}>
                <FoodCover cuisine={restaurant.cuisine} size="lg" className={styles.cover} />
                <div className={styles.intro}>
                    <p className={styles.cuisine}>{labels.cuisine(restaurant.cuisine)}</p>
                    <h1 className={styles.name}>{restaurant.name}</h1>
                    <p className={styles.description}>{restaurant.description}</p>
                    <ul className={styles.facts}>
                        <li><Rating value={restaurant.rating} /></li>
                        <li><OpenStatus open={restaurant.openNow} opensAt={restaurant.opensAt} /></li>
                        <li>
                            <Clock aria-hidden size={16} />
                            {t('restaurant.deliveryMinutes', { minutes: restaurant.deliveryMinutes })}
                        </li>
                        <li>
                            <Bike aria-hidden size={16} />
                            {restaurant.deliveryFeeCents === 0
                                ? t('restaurant.freeDelivery')
                                : t('restaurant.deliveryFee', {
                                        fee: money.format(restaurant.deliveryFeeCents / 100),
                                    })}
                        </li>
                        <li>
                            {t('restaurant.minimumOrder', {
                                amount: money.format(restaurant.minimumOrderCents / 100),
                            })}
                        </li>
                    </ul>
                </div>
            </header>

            <h2 className={styles.menuTitle}>{t('restaurant.menu')}</h2>
            {sections.map((section, index) => (
                <section key={section.name} aria-labelledby={`section-${index}`} className={styles.section}>
                    <h3 id={`section-${index}`} className={styles.sectionTitle}>{section.name}</h3>
                    <ul className={styles.dishes}>
                        {section.dishes.map(dish => (
                            <li key={dish.id}>
                                <DishCard dish={dish} onAdd={add} headingLevel={4} />
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </Page>
    );
}

function RestaurantError({ error, reset }: ErrorComponentProps) {
    const { t } = useTranslation();
    if (error instanceof ApiError && error.code === 'RESTAURANT_NOT_FOUND') {
        return (
            <Page narrow>
                <h1>{t('restaurant.notFound')}</h1>
                <Link href="/">{t('restaurant.back')}</Link>
            </Page>
        );
    }
    return <ErrorState onRetry={reset} />;
}
