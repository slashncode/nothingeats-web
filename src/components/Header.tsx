import type { ColorScheme } from './colorScheme';
import { Button, Link, Logo } from '@slashncode/nothingeats-ui';
import { Monitor, Moon, ShoppingBag, Sun, UserRound } from 'lucide-react';
import { Link as AriaLink } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { capture } from '../analytics/analytics';
import { useSession } from '../auth/session';
import { currentLanguage, i18next, rememberLanguage } from '../i18n';
import { useCart } from './cart';
import { setColorScheme, useColorScheme } from './colorScheme';
import styles from './Header.module.scss';

const NEXT_SCHEME: Record<ColorScheme, ColorScheme> = { light: 'dark', dark: 'system', system: 'light' };
const SCHEME_ICON = { light: Sun, dark: Moon, system: Monitor };

export function Header() {
    const { t } = useTranslation();
    const { state } = useSession();
    const scheme = useColorScheme();
    const cart = useCart();
    const items = cart.data?.itemCount ?? 0;
    const SchemeIcon = SCHEME_ICON[scheme];

    function switchLanguage() {
        const from = currentLanguage();
        const to = from === 'de'
            ? 'en'
            : 'de';
        rememberLanguage(to);
        void i18next.changeLanguage(to);
        capture('language_changed', { from, to });
    }

    return (
        <header className={styles.header}>
            <div className={styles.inner}>
                <AriaLink href="/" className={styles.home} aria-label="NothingEats">
                    <Logo />
                </AriaLink>
                <nav aria-label={t('nav.main')} className={styles.nav}>
                    <Link href="/" variant="secondary">{t('nav.restaurants')}</Link>
                    <Link href="/search" variant="secondary">{t('nav.search')}</Link>
                    {state.status === 'authenticated' && <Link href="/orders" variant="secondary">{t('nav.orders')}</Link>}
                </nav>
                <div className={styles.actions}>
                    <Button variant="ghost" size="sm" aria-label={t('language.switch')} onPress={switchLanguage}>
                        {t('language.short')}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('theme.label', { mode: scheme })}
                        onPress={() => setColorScheme(NEXT_SCHEME[scheme])}
                    >
                        <SchemeIcon aria-hidden size={18} />
                    </Button>
                    {state.status === 'authenticated' && (
                        <Link href="/checkout" className={styles.account} aria-label={t('nav.cart', { count: items })}>
                            <ShoppingBag aria-hidden size={18} />
                            {items > 0 && <span className={styles.badge} aria-hidden>{items}</span>}
                        </Link>
                    )}
                    {state.status === 'authenticated'
                        ? (
                                <Link href="/account" className={styles.account}>
                                    <UserRound aria-hidden size={18} />
                                    {t('nav.account')}
                                </Link>
                            )
                        : <Link href="/login" className={styles.account}>{t('nav.login')}</Link>}
                </div>
            </div>
        </header>
    );
}
