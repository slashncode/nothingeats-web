import { Button, Link } from '@slashncode/nothingeats-ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useDateFormatter, useNumberFormatter } from 'react-aria';
import { useTranslation } from 'react-i18next';

import { orderingQueries } from '../../api/ordering';
import { useSession } from '../../auth/session';
import { Page } from '../../components/Page';
import { currentLanguage } from '../../i18n';
import { ErrorState } from '../__root';
import styles from './index.module.scss';

export const Route = createFileRoute('/orders/')({
    component: Orders,
});

function Orders() {
    const { t } = useTranslation();
    const { state } = useSession();
    if (state.status === 'loading')
        return <Page narrow><p role="status">{t('app.loading')}</p></Page>;
    if (state.status === 'anonymous')
        return <Navigate to="/login" search={{ redirect: '/orders' }} />;
    return <OrderHistory />;
}

function OrderHistory() {
    const { t } = useTranslation();
    const money = useNumberFormatter({ style: 'currency', currency: 'EUR' });
    const date = useDateFormatter({ dateStyle: 'medium', timeStyle: 'short' });
    const orders = useInfiniteQuery(orderingQueries.orders(currentLanguage()));
    const items = orders.data?.pages.flatMap(page => page.items) ?? [];
    const saved = items.reduce((sum, order) => sum + order.totalCents, 0);

    if (orders.isError)
        return <ErrorState onRetry={() => void orders.refetch()} />;
    return (
        <Page narrow>
            <h1>{t('orders.title')}</h1>
            {orders.isSuccess && items.length === 0 && (
                <p>
                    {t('orders.empty')}
                    {' '}
                    <Link href="/">{t('checkout.browse')}</Link>
                </p>
            )}
            {items.length > 0 && (
                <p className={styles.saved}>
                    {t('orders.saved', {
                        amount: money.format(saved / 100),
                    })}
                </p>
            )}
            <ul className={styles.list}>
                {items.map(order => (
                    <li key={order.id}>
                        <Link href={`/orders/${order.id}`} className={styles.order}>
                            <span className={styles.restaurant}>{order.restaurant.name}</span>
                            <span>{date.format(new Date(order.placedAt))}</span>
                            <span>{t(`orders.status.${order.status}`)}</span>
                            <span className={styles.amount}>{money.format(order.totalCents / 100)}</span>
                        </Link>
                    </li>
                ))}
            </ul>
            {orders.hasNextPage && (
                <Button variant="outline" isPending={orders.isFetchingNextPage} onPress={() => void orders.fetchNextPage()}>
                    {t('orders.more')}
                </Button>
            )}
        </Page>
    );
}
