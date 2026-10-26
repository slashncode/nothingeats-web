import type { MapPoint } from '@slashncode/nothingeats-ui';
import type { Cart, DropOff } from '../api/ordering';
import { Button, DeliveryMap, Link, Radio, RadioGroup, TextField } from '@slashncode/nothingeats-ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router';
import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNumberFormatter } from 'react-aria';
import { useTranslation } from 'react-i18next';

import { capture } from '../analytics/analytics';
import { ApiError } from '../api/http';
import { ordering, orderingKeys, orderingQueries } from '../api/ordering';
import { useSession } from '../auth/session';
import { useCart } from '../components/cart';
import { Page } from '../components/Page';
import { currentLanguage } from '../i18n';
import styles from './checkout.module.scss';

export const Route = createFileRoute('/checkout')({
    component: Checkout,
});

/** Drop-offs to pick without a map (and for keyboard and screen reader users). */
export const PLACES = [
    {
        id: 'rathaus',
        name: 'Rathausmarkt',
        latitude: 53.5503,
        longitude: 9.9922,
    },
    {
        id: 'schanze',
        name: 'Sternschanze',
        latitude: 53.5636,
        longitude: 9.9654,
    },
    {
        id: 'ottensen',
        name: 'Ottensen',
        latitude: 53.5520,
        longitude: 9.9270,
    },
    {
        id: 'hafencity',
        name: 'HafenCity',
        latitude: 53.5413,
        longitude: 9.9938,
    },
    {
        id: 'eppendorf',
        name: 'Eppendorf',
        latitude: 53.5880,
        longitude: 9.9810,
    },
] as const;

const ORDER_ERRORS: Record<string, string> = {
    CART_EMPTY: 'checkout.errors.empty',
    CART_MINIMUM_NOT_REACHED: 'checkout.errors.minimum',
    CART_RESTAURANT_CLOSED: 'checkout.errors.closed',
    CART_DISH_UNAVAILABLE: 'checkout.errors.unavailable',
    DELIVERY_OUT_OF_RANGE: 'checkout.errors.outOfRange',
};

function Checkout() {
    const { t } = useTranslation();
    const { state } = useSession();
    const cart = useCart();

    if (state.status === 'loading' || (state.status === 'authenticated' && cart.isPending))
        return <Page narrow><p role="status">{t('app.loading')}</p></Page>;
    if (state.status === 'anonymous')
        return <Navigate to="/login" search={{ redirect: '/checkout' }} />;
    if (!cart.data || cart.data.lines.length === 0) {
        return (
            <Page narrow>
                <h1>{t('checkout.title')}</h1>
                <p>{t('checkout.empty')}</p>
                <Link href="/">{t('checkout.browse')}</Link>
            </Page>
        );
    }
    return <CheckoutForm cart={cart.data} />;
}

function CheckoutForm({ cart }: { cart: Cart }) {
    const { t } = useTranslation();
    const money = useNumberFormatter({ style: 'currency', currency: 'EUR' });
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const language = currentLanguage();
    const [place, setPlace] = useState<string>(PLACES[1].id);
    const [picked, setPicked] = useState<MapPoint>();
    const [label, setLabel] = useState('');
    const [placing, setPlacing] = useState(false);
    const [error, setError] = useState<string>();
    // One key per checkout: a retried or double-clicked order is placed once.
    const [idempotencyKey] = useState(() => crypto.randomUUID());
    const started = useRef(false);

    useEffect(() => {
        if (started.current)
            return;
        started.current = true;
        capture('checkout_started', { item_count: cart.itemCount, total_cents: cart.totalCents });
    }, [cart.itemCount, cart.totalCents]);

    const preset = PLACES.find(it => it.id === place);
    const point: MapPoint | undefined = place === 'map'
        ? picked
        : preset;
    const dropOff: DropOff | undefined = point && { latitude: point.latitude, longitude: point.longitude, label: label.trim() || preset?.name };

    const quote = useQuery({
        queryKey: [
            'ordering',
            'quote',
            cart.restaurant?.slug,
            point?.latitude,
            point?.longitude,
        ],
        queryFn: ({ signal }) => ordering.quote(dropOff!, signal),
        enabled: cart.orderable && dropOff !== undefined,
        retry: false,
    });

    async function setQuantity(dishId: string, quantity: number) {
        const next = await ordering.setQuantity(dishId, quantity, false, language);
        queryClient.setQueryData(orderingQueries.cart(language).queryKey, next);
    }

    async function placeOrder() {
        if (!dropOff)
            return;
        setPlacing(true);
        setError(undefined);
        try {
            const order = await ordering.place(dropOff, idempotencyKey, language);
            await queryClient.invalidateQueries({ queryKey: orderingKeys.cart });
            await navigate({
                to: '/orders/$orderId',
                params: { orderId: order.id },
            });
        }
        catch (failure) {
            setError(failure instanceof ApiError && ORDER_ERRORS[failure.code]
                ? ORDER_ERRORS[failure.code]
                : 'checkout.errors.generic');
        }
        finally {
            setPlacing(false);
        }
    }

    const quoteError = quote.error instanceof ApiError && quote.error.code === 'DELIVERY_OUT_OF_RANGE';
    const minutes = quote.data && Math.max(1, Math.round(quote.data.etaSeconds / 60));

    return (
        <Page>
            <h1 className={styles.title}>{t('checkout.title')}</h1>
            <div className={styles.layout}>
                <section aria-labelledby="cart-heading" className={styles.panel}>
                    <h2 id="cart-heading">
                        {cart.restaurant
                            ? t('checkout.from', { restaurant: cart.restaurant.name })
                            : t('checkout.title')}
                    </h2>
                    <ul className={styles.lines}>
                        {cart.lines.map(line => (
                            <li key={line.dishId} className={styles.line}>
                                <span className={styles.name}>
                                    {line.name}
                                    {!line.available && <span className={styles.problem}>{t('checkout.soldOut')}</span>}
                                </span>
                                <span className={styles.quantity}>
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        aria-label={t('checkout.less', { dish: line.name })}
                                        onPress={() => void setQuantity(line.dishId, line.quantity - 1)}
                                    >
                                        <Minus aria-hidden size={16} />
                                    </Button>
                                    <span aria-label={t('checkout.quantity', { count: line.quantity })}>{line.quantity}</span>
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        aria-label={t('checkout.more', { dish: line.name })}
                                        onPress={() => void setQuantity(line.dishId, line.quantity + 1)}
                                    >
                                        <Plus aria-hidden size={16} />
                                    </Button>
                                </span>
                                <span className={styles.price}>{money.format(line.totalCents / 100)}</span>
                            </li>
                        ))}
                    </ul>
                    <dl className={styles.totals}>
                        <dt>{t('checkout.subtotal')}</dt>
                        <dd>{money.format(cart.subtotalCents / 100)}</dd>
                        <dt>{t('checkout.deliveryFee')}</dt>
                        <dd>{money.format(cart.deliveryFeeCents / 100)}</dd>
                        <dt className={styles.total}>{t('checkout.notSpent')}</dt>
                        <dd className={styles.total}>{money.format(cart.totalCents / 100)}</dd>
                        <dt>{t('checkout.calories')}</dt>
                        <dd>{t('checkout.kcal', { calories: cart.calories })}</dd>
                    </dl>
                    {cart.problems.map(problem => <p key={problem} role="alert" className={styles.problem}>{t(`checkout.problems.${problem}`)}</p>)}
                </section>

                <section aria-labelledby="drop-off-heading" className={styles.panel}>
                    <h2 id="drop-off-heading">{t('checkout.dropOff')}</h2>
                    <RadioGroup
                        label={t('checkout.where')}
                        value={place}
                        onChange={(value) => {
                            setPlace(value);
                            capture('drop_off_selected', { method: 'preset' });
                        }}
                    >
                        {PLACES.map(it => <Radio key={it.id} value={it.id}>{it.name}</Radio>)}
                        <Radio value="map" isDisabled={!picked}>{t('checkout.onMap')}</Radio>
                    </RadioGroup>
                    <DeliveryMap
                        label={t('checkout.map')}
                        pickup={cart.restaurant
                            ? { latitude: cart.restaurant.latitude, longitude: cart.restaurant.longitude }
                            : undefined}
                        dropOff={point}
                        onPick={(next) => {
                            setPicked(next);
                            setPlace('map');
                            capture('drop_off_selected', { method: 'map' });
                        }}
                        className={styles.map}
                    />
                    <p className={styles.hint}>{t('checkout.mapHint')}</p>
                    <TextField label={t('checkout.label')} value={label} onChange={setLabel} maxLength={80} />
                    <div aria-live="polite" className={styles.quote}>
                        {quote.isFetching && <p>{t('checkout.quoting')}</p>}
                        {quoteError && <p role="alert">{t('checkout.errors.outOfRange')}</p>}
                        {quote.data && !quote.isFetching && (
                            <p>
                                {t('checkout.eta', { minutes })}
                                {' '}
                                {quote.data.source === 'estimate'
                                    ? t('checkout.estimate')
                                    : t('checkout.realCourier', { minutes: quote.data.simulatedMinutes })}
                                {quote.data.courierShortage && ` ${t('checkout.shortage')}`}
                            </p>
                        )}
                    </div>
                    {error && <p role="alert" className={styles.problem}>{t(error)}</p>}
                    <Button
                        className={styles.pay}
                        isPending={placing}
                        isDisabled={!cart.orderable || !dropOff || quoteError}
                        onPress={() => void placeOrder()}
                    >
                        {t('checkout.pay')}
                    </Button>
                    <p className={styles.hint}>{t('checkout.payHint')}</p>
                </section>
            </div>
        </Page>
    );
}
