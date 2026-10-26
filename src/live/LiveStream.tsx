import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { analyticsHeaders } from '../analytics/analytics';
import { deliveryKeys } from '../api/delivery';
import { currentAccessToken, refreshAccessToken } from '../api/http';
import { orderingKeys } from '../api/ordering';
import { useSession } from '../auth/session';

// The signed-in customer's live updates (notification service, server-sent events). Read with
// fetch, not EventSource: EventSource cannot send the Authorization header, and the token must
// not go into a URL or a cookie.

export interface LiveEvent {
    type: string;
    data: Record<string, unknown>;
}

type Listener = (event: LiveEvent) => void;

const listeners = new Set<Listener>();

/** Calls [listener] for every live event; returns the unsubscribe function. */
export function onLiveEvent(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Subscribes [handler] to events of [type] while the component is mounted. */
export function useLiveEvent(type: string, handler: (data: Record<string, unknown>) => void) {
    const latest = useRef(handler);
    latest.current = handler;
    useEffect(() => onLiveEvent((event) => {
        if (event.type === type)
            latest.current(event.data);
    }), [type]);
}

const MAX_BACKOFF_MS = 30_000;

function sleep(ms: number, signal: AbortSignal) {
    return new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        signal.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve();
        }, { once: true });
    });
}

/** Splits the byte stream into SSE events (`event:` and `data:` lines, blank line ends one). */
async function read(body: ReadableStream<Uint8Array>, dispatch: (event: LiveEvent) => void) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
        const { value, done } = await reader.read();
        if (done)
            return;
        buffer += decoder.decode(value, { stream: true });
        let end = buffer.indexOf('\n\n');
        while (end >= 0) {
            const block = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            let type = 'message';
            const data: string[] = [];
            for (const line of block.split('\n')) {
                if (line.startsWith('event:'))
                    type = line.slice(6).trim();
                else if (line.startsWith('data:'))
                    data.push(line.slice(5).trimStart());
            }
            if (data.length > 0) {
                try {
                    dispatch({
                        type,
                        data: JSON.parse(data.join('\n')) as Record<string, unknown>,
                    });
                }
                catch {
                    // Not JSON: not for us.
                }
            }
            end = buffer.indexOf('\n\n');
        }
    }
}

async function connect(signal: AbortSignal, dispatch: (event: LiveEvent) => void) {
    let attempt = 0;
    while (!signal.aborted) {
        try {
            const response = await fetch('/api/notification/v1/stream', {
                headers: {
                    Accept: 'text/event-stream',
                    Authorization: `Bearer ${currentAccessToken() ?? ''}`,
                    ...analyticsHeaders(),
                },
                signal,
            });
            if (response.status === 401) {
                await refreshAccessToken();
            }
            else if (response.ok && response.body) {
                attempt = 0;
                await read(response.body, dispatch);
            }
        }
        catch {
            if (signal.aborted)
                return;
        }
        // The stream ended or failed: back off, then reconnect (missed updates are reloaded by the pages).
        await sleep(Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt++), signal);
    }
}

/**
 * Keeps the stream open while someone is signed in, hands events to the listeners and refreshes
 * the order queries they concern. Renders nothing.
 */
export function LiveStream() {
    const { state } = useSession();
    const queryClient = useQueryClient();
    const signedIn = state.status === 'authenticated'
        ? state.user.id
        : undefined;

    useEffect(() => {
        if (!signedIn)
            return;
        const controller = new AbortController();
        void connect(controller.signal, (event) => {
            listeners.forEach(listener => listener(event));
            if (event.type === 'order.updated' && typeof event.data.orderId === 'string') {
                void queryClient.invalidateQueries({
                    queryKey: orderingKeys.order(event.data.orderId),
                });
                void queryClient.invalidateQueries({
                    queryKey: deliveryKeys.delivery(event.data.orderId),
                });
                void queryClient.invalidateQueries({ queryKey: orderingKeys.orders });
            }
        });
        return () => controller.abort();
    }, [signedIn, queryClient]);

    return null;
}
