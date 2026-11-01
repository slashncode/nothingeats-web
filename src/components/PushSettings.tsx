import type { PushStatus } from '../push/push';
import { Switch } from '@slashncode/nothingeats-ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { capture } from '../analytics/analytics';
import { notificationQueries } from '../api/notification';
import { currentLanguage } from '../i18n';
import { disablePush, enablePush, pushStatus } from '../push/push';
import forms from './forms.module.scss';

const statusKey = ['push', 'status'] as const;

/**
 * Web push on this device. Hidden when the cluster has no push keys; explains itself when the
 * browser cannot (iPhone: only once added to the home screen) or the visitor blocked it.
 */
export function PushSettings({ className, titleClassName }: { className?: string; titleClassName?: string }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const key = useQuery(notificationQueries.pushKey());
    const status = useQuery({ queryKey: statusKey, queryFn: pushStatus });
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);

    if (!key.data || !status.data)
        return null;

    const publicKey = key.data;
    const hints: Record<PushStatus, string> = {
        unsupported: t('push.unsupported'),
        denied: t('push.denied'),
        off: t('push.hint'),
        on: t('push.hint'),
    };

    async function toggle(on: boolean) {
        setBusy(true);
        setFailed(false);
        try {
            const next = on
                ? await enablePush(publicKey, currentLanguage())
                : await disablePush().then((): PushStatus => 'off');
            queryClient.setQueryData(statusKey, next);
            if (next === 'on' && on)
                capture('push_enabled', {});
            if (!on)
                capture('push_disabled', {});
        }
        catch {
            setFailed(true);
            await queryClient.invalidateQueries({ queryKey: statusKey });
        }
        finally {
            setBusy(false);
        }
    }

    return (
        <section aria-labelledby="push" className={className}>
            <h2 id="push" className={titleClassName}>{t('push.title')}</h2>
            {failed && <p role="alert" className={forms.alert}>{t('push.failed')}</p>}
            <Switch
                isSelected={status.data === 'on'}
                isDisabled={busy || status.data === 'unsupported' || status.data === 'denied'}
                onChange={on => void toggle(on)}
                description={hints[status.data]}
            >
                {t('push.label')}
            </Switch>
        </section>
    );
}
