import { Button, Logo } from '@slashncode/nothingeats-ui';
import { useTranslation } from 'react-i18next';

import { analyticsEnabled, resetConsent } from '../analytics/analytics';
import styles from './Footer.module.scss';

export function Footer() {
    const { t } = useTranslation();
    return (
        <footer className={styles.footer}>
            <div className={styles.inner}>
                <Logo size="sm" />
                <p className={styles.claim}>{t('app.claim')}</p>
                {analyticsEnabled && (
                    <Button variant="link" size="sm" onPress={resetConsent}>{t('consent.settings')}</Button>
                )}
            </div>
        </footer>
    );
}
