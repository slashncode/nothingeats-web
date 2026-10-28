import { Switch } from '@slashncode/nothingeats-ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { useNumberFormatter } from 'react-aria';
import { useTranslation } from 'react-i18next';

import { social, socialKeys, socialQueries } from '../api/social';
import { currentLanguage } from '../i18n';
import styles from './Leaderboard.module.scss';

/** This week's board, and the customer's own choice to appear on it (opt-in, under a pseudonym). */
export function Leaderboard() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const language = currentLanguage();
    const number = useNumberFormatter();
    const board = useQuery(socialQueries.leaderboard(language));
    const me = useQuery(socialQueries.me(language));
    const [saving, setSaving] = useState(false);

    async function setJoined(join: boolean) {
        setSaving(true);
        try {
            queryClient.setQueryData(socialQueries.me(language).queryKey, await social.setLeaderboard(join, language));
            await queryClient.invalidateQueries({ queryKey: socialKeys.all });
        }
        finally {
            setSaving(false);
        }
    }

    const mine = me.data;
    return (
        <section aria-labelledby="leaderboard" className={styles.board}>
            <h2 id="leaderboard">{t('leaderboard.title')}</h2>
            {mine && (
                <Switch
                    isSelected={mine.onLeaderboard}
                    isDisabled={saving}
                    onChange={join => void setJoined(join)}
                    description={t('leaderboard.optInHint')}
                >
                    {t('leaderboard.optIn')}
                </Switch>
            )}
            {mine?.onLeaderboard && (
                <p className={styles.me}>
                    {mine.rank
                        ? t('leaderboard.you', {
                                pseudonym: mine.pseudonym,
                                rank: mine.rank,
                                xp: number.format(mine.xp),
                            })
                        : t('leaderboard.youNoXp', { pseudonym: mine.pseudonym })}
                </p>
            )}
            {board.data && board.data.top.length > 0
                ? (
                        <ol className={styles.list} aria-label={t('leaderboard.listLabel')}>
                            {board.data.top.map(entry => (
                                <li key={entry.rank} className={clsx(styles.row, mine?.onLeaderboard && entry.pseudonym === mine.pseudonym && styles.self)}>
                                    <span className={styles.rank}>{entry.rank}</span>
                                    <span className={styles.name}>{entry.pseudonym}</span>
                                    <span className={styles.xp}>
                                        {t('leaderboard.xp', {
                                            xp: number.format(entry.xp),
                                        })}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )
                : board.isSuccess && <p className={styles.empty}>{t('leaderboard.empty')}</p>}
        </section>
    );
}
