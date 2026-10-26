import type { DishSummary } from '@slashncode/nothingeats-ui';
import { Button, Dialog, Modal, toastQueue } from '@slashncode/nothingeats-ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Heading } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { capture } from '../analytics/analytics';
import { ApiError } from '../api/http';
import { ordering, orderingQueries } from '../api/ordering';
import { useSession } from '../auth/session';
import { currentLanguage } from '../i18n';
import styles from './cart.module.scss';

/** The signed-in customer's cart; nothing for visitors. */
export function useCart() {
    const { state } = useSession();
    return useQuery({
        ...orderingQueries.cart(currentLanguage()),
        enabled: state.status === 'authenticated',
    });
}

interface PendingDish {
    dish: DishSummary;
    restaurantSlug: string;
}

/**
 * "Add to cart" everywhere: visitors are sent to the login first, a dish from another restaurant
 * asks before starting a new cart. Returns the dialog to render next to the dishes.
 */
export function useAddToCart() {
    const { t } = useTranslation();
    const { state } = useSession();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const [pending, setPending] = useState<PendingDish>();
    const [busy, setBusy] = useState(false);
    const language = currentLanguage();

    async function put(dish: DishSummary, quantity: number, replaceCart: boolean) {
        const cart = await ordering.setQuantity(dish.id, quantity, replaceCart, language);
        queryClient.setQueryData(orderingQueries.cart(language).queryKey, cart);
        toastQueue.add(
            {
                title: t('cart.added', { dish: dish.name }),
                description: t('cart.addedDescription'),
                variant: 'info',
            },
            { timeout: 5000 },
        );
    }

    async function add(dish: DishSummary, restaurantSlug: string, source: 'menu' | 'search') {
        capture('dish_add_clicked', {
            dish_id: dish.id,
            restaurant_slug: restaurantSlug,
            price_cents: dish.priceCents,
            source,
        });
        if (state.status !== 'authenticated') {
            toastQueue.add({
                title: t('cart.loginFirst'),
                variant: 'info',
            }, { timeout: 5000 });
            await navigate({
                to: '/login',
                search: { redirect: location.href },
            });
            return;
        }
        const cached = queryClient.getQueryData(orderingQueries.cart(language).queryKey);
        const current = cached?.lines.find(line => line.dishId === dish.id)?.quantity ?? 0;
        try {
            await put(dish, current + 1, false);
        }
        catch (error) {
            if (error instanceof ApiError && error.code === 'CART_OTHER_RESTAURANT') {
                setPending({ dish, restaurantSlug });
            }
            else {
                toastQueue.add({
                    title: t('cart.failed'),
                    variant: 'error',
                }, { timeout: 5000 });
            }
        }
    }

    async function startOver() {
        if (!pending)
            return;
        setBusy(true);
        try {
            await put(pending.dish, 1, true);
            capture('cart_replaced', { restaurant_slug: pending.restaurantSlug });
        }
        finally {
            setBusy(false);
            setPending(undefined);
        }
    }

    const current = queryClient.getQueryData(orderingQueries.cart(language).queryKey)?.restaurant?.name;
    const dialog = (
        <Modal isOpen={pending !== undefined} onOpenChange={open => !open && setPending(undefined)} isDismissable>
            <Dialog className={styles.dialog}>
                <Heading slot="title" className={styles.title}>{t('cart.otherRestaurantTitle')}</Heading>
                <p>{t('cart.otherRestaurantBody', { restaurant: current ?? '' })}</p>
                <div className={styles.actions}>
                    <Button variant="outline" onPress={() => setPending(undefined)}>{t('cart.keep')}</Button>
                    <Button isPending={busy} onPress={() => void startOver()}>{t('cart.startOver')}</Button>
                </div>
            </Dialog>
        </Modal>
    );
    return { add, dialog };
}
