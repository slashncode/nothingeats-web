import type { Language } from '../i18n';
import { queryOptions } from '@tanstack/react-query';

import { request } from './http';

// /api/notification/v1/push (nothingeats-notification-service): web push subscriptions.

export interface PushDevice {
    /** The push service's host (Google, Mozilla, Apple, Microsoft), not the endpoint. */
    service: string;
    language: Language;
    createdAt: string;
}

export const notificationQueries = {
    /** The VAPID public key; `PUSH_DISABLED` (404) when the cluster has none. */
    pushKey: () => queryOptions({
        queryKey: ['notification', 'push-key'],
        queryFn: ({ signal }) => request<{ publicKey: string }>('/api/notification/v1/push/key', { signal }).then(response => response.publicKey),
        staleTime: Infinity,
        retry: false,
    }),
};

export const notification = {
    saveSubscription: (subscription: PushSubscriptionJSON, language: Language) => request<void>('/api/notification/v1/push/subscriptions', {
        method: 'PUT',
        auth: true,
        body: {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            language,
        },
    }),
    deleteSubscription: (endpoint: string) => request<void>('/api/notification/v1/push/subscriptions', {
        method: 'DELETE',
        auth: true,
        query: { endpoint },
    }),
    /** A push to every device of the account now; how many the push services took, forgot or refused. */
    sendTestPush: () => request<{ sent: number; gone: number; failed: number }>('/api/notification/v1/push/test', {
        method: 'POST',
        auth: true,
    }),
    /** For the GDPR download: the account's devices by push service. */
    exportSubscriptions: () => request<{ items: PushDevice[] }>('/api/notification/v1/push/subscriptions', { auth: true }),
};
