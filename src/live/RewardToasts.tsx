import type { RewardEarned } from '../api/loyalty';
import { toastQueue, useCouponText } from '@slashncode/nothingeats-ui';
import { useTranslation } from 'react-i18next';

import { celebrate } from '../components/celebrate';
import { currentLanguage } from '../i18n';
import { useLiveEvent } from './LiveStream';

/**
 * What an arrived order earned, the moment loyalty has it (`reward.earned` on the live stream):
 * a toast with XP, level, badges and the stamp card, and confetti for the big moments.
 */
export function RewardToasts() {
    const { t } = useTranslation();
    const couponText = useCouponText();

    useLiveEvent('reward.earned', (data) => {
        const reward = data as unknown as RewardEarned;
        // Wheel prizes are shown by the wheel itself.
        if (reward.cause !== 'ORDER_DELIVERED')
            return;
        const language = currentLanguage();
        const levelUp = reward.xp.level > reward.xp.previousLevel;
        const card = reward.stampCard;
        const lines = [
            levelUp && t('rewards.toast.level', { level: reward.xp.level }),
            ...reward.badges.map(badge => t('rewards.toast.badge', { badge: badge.name[language] })),
            card && (card.completed
                ? t('rewards.toast.cardFull', { restaurant: card.restaurantName })
                : t('rewards.toast.stamp', { restaurant: card.restaurantName, stamps: card.stamps, perCard: card.perCard })),
            ...reward.coupons.map(coupon => t('rewards.toast.coupon', {
                coupon: couponText.title(coupon),
            })),
        ].filter(Boolean);
        toastQueue.add({
            title: t('rewards.toast.xp', { xp: reward.xp.gained }),
            description: lines.join(' · '),
            variant: 'success',
        }, { timeout: 8000 });
        if (levelUp || reward.badges.length > 0 || card?.completed)
            void celebrate();
    });

    return null;
}
