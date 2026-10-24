import clsx from 'clsx';

import styles from './Page.module.scss';

/** Content width and spacing of a page; `narrow` for forms. */
export function Page({ narrow = false, children }: { narrow?: boolean; children: React.ReactNode }) {
    return <div className={clsx(styles.page, narrow && styles.narrow)}>{children}</div>;
}
