import { Button } from '@slashncode/nothingeats-ui';
import { useTranslation } from 'react-i18next';

import { analyticsEnabled, setConsent, useConsent } from '../analytics/analytics';
import styles from './ConsentBanner.module.scss';

/** Opt-in for product analytics. Not a modal: the shop works the same either way. */
export function ConsentBanner() {
    const { t } = useTranslation();
    const consent = useConsent();
    if (!analyticsEnabled || consent !== 'pending')
        return null;
    return (
        <section aria-labelledby="consent-title" className={styles.banner}>
            <h2 id="consent-title" className={styles.title}>{t('consent.title')}</h2>
            <p className={styles.text}>{t('consent.text')}</p>
            <div className={styles.actions}>
                <Button variant="outline" onPress={() => setConsent(false)}>{t('consent.decline')}</Button>
                <Button onPress={() => setConsent(true)}>{t('consent.accept')}</Button>
            </div>
        </section>
    );
}
