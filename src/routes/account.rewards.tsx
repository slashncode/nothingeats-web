import type { SpinResult } from '../api/loyalty';
import {
    BadgeMedal,
    Button,
    CouponCard,
    Link,
    SpinWheel,
    StampCard,
    StreakFlame,
    toastQueue,
    useCouponText,
    XpBar,
} from '@slashncode/nothingeats-ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useNumberFormatter } from 'react-aria';
import { useTranslation } from 'react-i18next';

import { capture } from '../analytics/analytics';
import { loyalty, loyaltyKeys, loyaltyQueries } from '../api/loyalty';
import { AccountNav } from '../components/AccountNav';
import { celebrate } from '../components/celebrate';
import { Leaderboard } from '../components/Leaderboard';
import { Page } from '../components/Page';
import { currentLanguage } from '../i18n';
import { ErrorState } from './__root';
import styles from './account.rewards.module.scss';

export const Route = createFileRoute('/account/rewards')({
    component: Rewards,
});

function Rewards() {
    const { t } = useTranslation();
    const language = currentLanguage();
    const rewards = useQuery(loyaltyQueries.rewards(language));
    const money = useNumberFormatter({ style: 'currency', currency: 'EUR' });
    const number = useNumberFormatter();
    const viewed = useRef(false);

    useEffect(() => {
        if (!rewards.data || viewed.current)
            return;
        viewed.current = true;
        capture('rewards_viewed', { level: rewards.data.level.level, spins_available: rewards.data.spinsAvailable });
    }, [rewards.data]);

    if (rewards.isError) {
        return (
            <Page>
                <AccountNav />
                <ErrorState onRetry={() => void rewards.refetch()} />
            </Page>
        );
    }
    if (!rewards.data) {
        return (
            <Page>
                <AccountNav />
                <p role="status">{t('app.loading')}</p>
            </Page>
        );
    }

    const { level, streak, stats, badges, stampCards, coupons } = rewards.data;
    const earned = badges.filter(badge => badge.earnedAt).length;
    return (
        <Page>
            <AccountNav />
            <h1 className={styles.title}>{t('rewards.title')}</h1>

            <section aria-label={t('rewards.progress')} className={styles.summary}>
                <XpBar {...level} className={styles.xp} />
                <StreakFlame days={streak.days} orderedToday={streak.orderedToday} />
                <dl className={styles.stats}>
                    <div>
                        <dt>{t('rewards.stats.notSpent')}</dt>
                        <dd>{money.format(stats.moneyNotSpentCents / 100)}</dd>
                    </div>
                    <div>
                        <dt>{t('rewards.stats.notEaten')}</dt>
                        <dd>
                            {t('rewards.stats.kcal', {
                                calories: number.format(stats.caloriesAvoided),
                            })}
                        </dd>
                    </div>
                    <div>
                        <dt>{t('rewards.stats.orders')}</dt>
                        <dd>{number.format(stats.orders)}</dd>
                    </div>
                    <div>
                        <dt>{t('rewards.stats.restaurants')}</dt>
                        <dd>{number.format(stats.restaurants)}</dd>
                    </div>
                </dl>
            </section>

            <Wheel spins={rewards.data.spinsAvailable} nextLevel={level.level + 1} />

            <Leaderboard />

            <section aria-labelledby="coupons" className={styles.section}>
                <h2 id="coupons">{t('rewards.coupons')}</h2>
                {coupons.length === 0
                    ? <p className={styles.empty}>{t('rewards.noCoupons')}</p>
                    : (
                            <ul className={styles.list}>
                                {coupons.map(coupon => <li key={coupon.code}><CouponCard coupon={coupon} /></li>)}
                            </ul>
                        )}
            </section>

            <section aria-labelledby="stamps" className={styles.section}>
                <h2 id="stamps">{t('rewards.stampCards')}</h2>
                {stampCards.length === 0
                    ? <p className={styles.empty}>{t('rewards.noStamps')}</p>
                    : (
                            <ul className={styles.grid}>
                                {stampCards.map(card => (
                                    <li key={card.restaurantSlug}>
                                        <StampCard
                                            restaurantName={card.restaurantName}
                                            stamps={card.stamps}
                                            perCard={card.perCard}
                                            completed={card.completed}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
            </section>

            <section aria-labelledby="badges" className={styles.section}>
                <h2 id="badges">{t('rewards.badges', { earned, total: badges.length })}</h2>
                <ul className={styles.grid}>
                    {badges.map(badge => (
                        <li key={badge.key}>
                            <BadgeMedal
                                badgeKey={badge.key}
                                name={badge.name}
                                description={badge.description}
                                tier={badge.tier}
                                earnedAt={badge.earnedAt}
                            />
                        </li>
                    ))}
                </ul>
            </section>
        </Page>
    );
}

/** The wheel: the server decides, the wheel shows it, then the prize is announced in words. */
function Wheel({ spins, nextLevel }: { spins: number; nextLevel: number }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const couponText = useCouponText();
    const language = currentLanguage();
    const [spinning, setSpinning] = useState(false);
    const [result, setResult] = useState<SpinResult>();
    const [spinId, setSpinId] = useState(0);
    const [announcement, setAnnouncement] = useState('');
    const [failed, setFailed] = useState(false);

    async function spin() {
        setSpinning(true);
        setFailed(false);
        setAnnouncement('');
        try {
            const next = await loyalty.spin(language);
            setResult(next);
            setSpinId(id => id + 1);
        }
        catch {
            setSpinning(false);
            setFailed(true);
        }
    }

    function landed() {
        if (!result)
            return;
        setSpinning(false);
        const prize = result.coupon
            ? couponText.title(result.coupon)
            : result.badges.length > 0
                ? result.badges.map(badge => badge.name).join(', ')
                : t('rewards.bonusXp', { xp: result.xpGained });
        setAnnouncement(t('rewards.won', { prize }));
        toastQueue.add({
            title: t('rewards.won', { prize }),
            variant: 'success',
        }, { timeout: 6000 });
        void celebrate();
        void queryClient.invalidateQueries({ queryKey: loyaltyKeys.all });
    }

    return (
        <section aria-labelledby="wheel" className={styles.wheel}>
            <div className={styles.wheelText}>
                <h2 id="wheel">{t('rewards.wheel')}</h2>
                <p>
                    {spins > 0
                        ? t('rewards.spins', { count: spins })
                        : t('rewards.noSpins', { level: nextLevel })}
                </p>
                <Button isDisabled={spins === 0 || spinning} isPending={spinning} onPress={() => void spin()}>
                    {t('rewards.spin')}
                </Button>
                <p role="status" className={styles.announcement}>{announcement}</p>
                {failed && <p role="alert">{t('rewards.spinFailed')}</p>}
                {result?.coupon && !spinning && (
                    <p>
                        <Link href="/checkout">{t('rewards.useCoupon')}</Link>
                    </p>
                )}
            </div>
            <SpinWheel result={result?.prize ?? null} spinId={spinId} onSpinEnd={landed} className={styles.wheelGraphic} />
        </section>
    );
}
