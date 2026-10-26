import type { MapPoint, OrderStep } from '@slashncode/nothingeats-ui';
import { DeliveryMap, Link, OrderTimeline } from '@slashncode/nothingeats-ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNumberFormatter } from 'react-aria';
import { useTranslation } from 'react-i18next';

import { capture } from '../../analytics/analytics';
import { deliveryQueries } from '../../api/delivery';
import { ApiError } from '../../api/http';
import { orderingQueries } from '../../api/ordering';
import { useSession } from '../../auth/session';
import { Page } from '../../components/Page';
import { currentLanguage } from '../../i18n';
import { useLiveEvent } from '../../live/LiveStream';
import { ErrorState } from '../__root';
import styles from './$orderId.module.scss';

export const Route = createFileRoute('/orders/$orderId')({
    component: Tracking,
});

/** Seconds until [target], ticking every second. */
function useCountdown(target: string | undefined) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    return target
        ? Math.max(0, Math.round((new Date(target).getTime() - now) / 1000))
        : undefined;
}

function Tracking() {
    const { t } = useTranslation();
    const { state } = useSession();
    if (state.status === 'loading')
        return <Page narrow><p role="status">{t('app.loading')}</p></Page>;
    if (state.status === 'anonymous')
        return <Navigate to="/login" search={{ redirect: globalThis.location?.pathname ?? '/orders' }} />;
    return <OrderTracking />;
}

function OrderTracking() {
    const { t } = useTranslation();
    const { orderId } = Route.useParams();
    const money = useNumberFormatter({ style: 'currency', currency: 'EUR' });
    const order = useQuery(orderingQueries.order(currentLanguage(), orderId));
    const delivery = useQuery({
        ...deliveryQueries.delivery(orderId),
        enabled: order.isSuccess,
    });
    const [courier, setCourier] = useState<MapPoint>();
    const viewed = useRef(false);

    useLiveEvent('courier.moved', (data) => {
        if (data.orderId === orderId && typeof data.latitude === 'number' && typeof data.longitude === 'number')
            setCourier({ latitude: data.latitude, longitude: data.longitude });
    });

    useEffect(() => {
        if (order.data && !viewed.current) {
            viewed.current = true;
            capture('order_tracking_viewed', { order_id: order.data.id, status: order.data.status });
        }
    }, [order.data]);

    const status = order.data?.status;
    const seconds = useCountdown(status === 'DELIVERED'
        ? undefined
        : order.data?.estimatedArrivalAt);

    if (order.error instanceof ApiError && order.error.code === 'ORDER_NOT_FOUND') {
        return (
            <Page narrow>
                <h1>{t('tracking.notFound')}</h1>
                <Link href="/orders">{t('tracking.allOrders')}</Link>
            </Page>
        );
    }
    if (order.isError)
        return <ErrorState onRetry={() => void order.refetch()} />;
    if (!order.data)
        return <Page narrow><p role="status">{t('app.loading')}</p></Page>;

    const data = order.data;
    const times: Partial<Record<OrderStep, string>> = { PLACED: data.placedAt };
    delivery.data?.steps.forEach((step) => {
        times[step.status] = step.at;
    });
    const position = courier ?? delivery.data?.courier.position;

    return (
        <Page>
            <Link href="/orders" className={styles.back}>
                <ArrowLeft aria-hidden size={16} />
                {t('tracking.allOrders')}
            </Link>
            <header className={styles.header}>
                <h1 className={styles.title}>{t('tracking.title', { restaurant: data.restaurant.name })}</h1>
                <p className={styles.eta} aria-live="polite">
                    {data.status === 'DELIVERED'
                        ? t('tracking.arrived')
                        : seconds !== undefined && seconds > 0
                            ? t('tracking.eta', {
                                    minutes: Math.floor(seconds / 60),
                                    seconds: String(seconds % 60).padStart(2, '0'),
                                })
                            : t('tracking.anyMoment')}
                </p>
                {delivery.data && data.status !== 'DELIVERED' && (
                    <p className={styles.courier}>{t(`tracking.vehicle.${delivery.data.courier.vehicle}`, { name: delivery.data.courier.name })}</p>
                )}
            </header>
            <div className={styles.layout}>
                <OrderTimeline status={data.status} times={times} />
                <DeliveryMap
                    label={t('tracking.map')}
                    pickup={{ latitude: data.restaurant.latitude, longitude: data.restaurant.longitude }}
                    dropOff={{ latitude: data.dropOff.latitude, longitude: data.dropOff.longitude }}
                    courier={data.status === 'DELIVERED'
                        ? null
                        : position}
                    approachRoute={delivery.data?.approachRoute}
                    deliveryRoute={delivery.data?.deliveryRoute}
                    className={styles.map}
                />
            </div>
            <section aria-labelledby="order-summary" className={styles.summary}>
                <h2 id="order-summary">{t('tracking.summary')}</h2>
                <ul>
                    {data.lines.map(line => (
                        <li key={line.dishId}>
                            <span>{`${line.quantity} × ${line.name}`}</span>
                            <span>{money.format(line.totalCents / 100)}</span>
                        </li>
                    ))}
                </ul>
                <p>
                    {t('tracking.saved', {
                        amount: money.format(data.totalCents / 100),
                        calories: data.calories,
                    })}
                </p>
            </section>
        </Page>
    );
}
