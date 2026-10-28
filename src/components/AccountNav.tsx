import { useLocation } from '@tanstack/react-router';
import clsx from 'clsx';
import { Link as AriaLink } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import styles from './AccountNav.module.scss';

const PAGES = [
    { href: '/account', key: 'account.nav.settings' },
    { href: '/account/rewards', key: 'account.nav.rewards' },
] as const;

/** The account's subpages; the current one is marked for screen readers too. */
export function AccountNav() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    return (
        <nav aria-label={t('account.nav.label')} className={styles.nav}>
            {PAGES.map(page => (
                <AriaLink
                    key={page.href}
                    href={page.href}
                    aria-current={pathname === page.href
                        ? 'page'
                        : undefined}
                    className={clsx(styles.link, pathname === page.href && styles.current)}
                >
                    {t(page.key)}
                </AriaLink>
            ))}
        </nav>
    );
}
