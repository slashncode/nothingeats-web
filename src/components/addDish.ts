import type { DishSummary } from '@slashncode/nothingeats-ui';
import { toastQueue } from '@slashncode/nothingeats-ui';
import { useTranslation } from 'react-i18next';

import { capture } from '../analytics/analytics';

/** "Add to cart" before the cart exists: a toast that nothing comes, and the demand counted. */
export function useAddDish() {
    const { t } = useTranslation();
    return (dish: DishSummary, restaurantSlug: string, source: 'menu' | 'search') => {
        toastQueue.add(
            {
                title: t('restaurant.addedTitle', { dish: dish.name }),
                description: t('restaurant.addedDescription'),
                variant: 'info',
            },
            { timeout: 6000 },
        );
        capture('dish_add_clicked', {
            dish_id: dish.id,
            restaurant_slug: restaurantSlug,
            price_cents: dish.priceCents,
            source,
        });
    };
}
