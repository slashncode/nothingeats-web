import type { UIMessage } from 'ai';
import { analyticsHeaders } from '../analytics/analytics';
import { ApiError, currentAccessToken, refreshAccessToken, request } from './http';

// The Craving Coach (`/api/assistant/v1`): a chat whose answers stream as AI SDK UI messages.

/** A dish the coach recommended: catalog data checked by the assistant, plus the coach's reason. */
export interface CoachDish {
    id: string;
    slug: string;
    name: string;
    description: string;
    cuisine: string;
    restaurant: { id: string; slug: string; name: string };
    priceCents: number;
    dietary: string[];
    allergens: string[];
    spiceLevel: number;
    calories: number;
    moods: string[];
    openNow: boolean;
    reason: string;
}

// A type, not an interface: UIMessage wants a record of tools.
// eslint-disable-next-line ts/consistent-type-definitions
export type CoachTools = {
    searchDishes: { input: { query: string }; output: { dishes: { id: string }[] } };
    getDish: { input: { id: string }; output: unknown };
    recommendDishes: { input: { dishes: { id: string; reason: string }[] }; output: { shown: CoachDish[]; notShown: string[] } };
};

export type CoachMessage = UIMessage<never, never, CoachTools>;

export interface Conversation {
    id: string;
    title: string;
    messages: CoachMessage[];
}

export const CHAT_ENDPOINT = '/api/assistant/v1/chat';

/**
 * The chat transport's fetch: the access token (refreshed once on 401, like every API call) and,
 * after consent, the PostHog ids that link the coach's LLM traces to the session. A refusal
 * (problem+json) becomes an `ApiError` with its code, for the chat to explain.
 */
export async function coachFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const send = (token: string | undefined) => {
        const headers = new Headers(init.headers);
        Object.entries(analyticsHeaders()).forEach(([name, value]) => headers.set(name, value));
        if (token)
            headers.set('Authorization', `Bearer ${token}`);
        return fetch(input, { ...init, headers, credentials: 'same-origin' });
    };
    let response = await send(currentAccessToken());
    if (response.status === 401) {
        const fresh = await refreshAccessToken();
        if (fresh)
            response = await send(fresh);
    }
    if (!response.ok) {
        const problem = await response.json().catch(() => undefined) as { code?: string; title?: string } | undefined;
        throw new ApiError(
            response.status,
            problem?.code ?? `HTTP_${response.status}`,
            problem?.title ?? response.statusText,
            [],
            Number(response.headers.get('Retry-After')) || undefined,
        );
    }
    return response;
}

export const assistant = {
    conversation: (id: string) => request<Conversation>(`/api/assistant/v1/conversations/${encodeURIComponent(id)}`, { auth: true }),
    exportConversations: () => request<unknown>('/api/assistant/v1/me/export', { auth: true }),
};
