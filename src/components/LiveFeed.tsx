import type { FeedItem } from '../api/social';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Ghost, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNumberFormatter } from 'react-aria';
import { useTranslation } from 'react-i18next';

import { socialQueries } from '../api/social';
import { currentLanguage } from '../i18n';
import { read } from '../live/LiveStream';
import styles from './LiveFeed.module.scss';

const SHOWN = 6;
const MAX_BACKOFF_MS = 30_000;

/** New lines from the public feed stream, reconnecting with backoff; anonymous, so no token. */
function useFeedStream(onItem: (item: FeedItem) => void) {
    const latest = useRef(onItem);
    latest.current = onItem;
    useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            let attempt = 0;
            while (!controller.signal.aborted) {
                try {
                    const response = await fetch('/api/social/v1/feed/stream', {
                        headers: { Accept: 'text/event-stream' },
                        signal: controller.signal,
                    });
                    if (response.ok && response.body) {
                        attempt = 0;
                        await read(response.body, (event) => {
                            if (event.type === 'feed.item')
                                latest.current(event.data as unknown as FeedItem);
                        });
                    }
                }
                catch {
                    if (controller.signal.aborted)
                        return;
                }
                await new Promise(resolve => setTimeout(resolve, Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt++)));
            }
        })();
        return () => controller.abort();
    }, []);
}

/** "Right now, nobody is eating": the anonymous feed, live. Hidden while it is empty. */
export function LiveFeed() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const feed = useQuery(socialQueries.feed());
    const money = useNumberFormatter({ style: 'currency', currency: 'EUR' });
    const [, tick] = useState(0);
    const language = currentLanguage();
    const relative = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });

    useFeedStream((item) => {
        queryClient.setQueryData(socialQueries.feed().queryKey, (items = []) => [
            item,
            ...items.filter(it => it.id !== item.id),
        ].slice(0, SHOWN * 2));
    });

    // "2 minutes ago" moves on by itself.
    useEffect(() => {
        const timer = setInterval(() => tick(n => n + 1), 30_000);
        return () => clearInterval(timer);
    }, []);

    const items = (feed.data ?? []).slice(0, SHOWN);
    if (items.length === 0)
        return null;

    function text(item: FeedItem) {
        switch (item.kind) {
            case 'ORDER':
                return t('feed.order', {
                    count: item.items ?? 1,
                    restaurant: item.restaurantName,
                    amount: money.format((item.moneyNotSpentCents ?? 0) / 100),
                });
            case 'LEVEL':
                return t('feed.level', { level: item.level });
            default:
                return t('feed.badge', { badge: item.badge?.[language] });
        }
    }

    function ago(at: string) {
        const minutes = Math.round((Date.parse(at) - Date.now()) / 60_000);
        return Math.abs(minutes) < 60
            ? relative.format(minutes, 'minute')
            : relative.format(Math.round(minutes / 60), 'hour');
    }

    const ICONS = { ORDER: Ghost, LEVEL: TrendingUp, BADGE: Award };
    return (
        <section aria-labelledby="live-feed" className={styles.feed}>
            <h2 id="live-feed" className={styles.title}>
                <span aria-hidden className={styles.pulse} />
                {t('feed.title')}
            </h2>
            <ol className={styles.list}>
                {items.map((item) => {
                    const Icon = ICONS[item.kind];
                    return (
                        <li key={item.id} className={styles.item}>
                            <Icon aria-hidden className={styles.icon} />
                            <span>{text(item)}</span>
                            <time dateTime={item.at} className={styles.time}>{ago(item.at)}</time>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
