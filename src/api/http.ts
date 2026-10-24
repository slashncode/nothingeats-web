// Thin fetch wrapper for the NothingEats APIs on the same origin. Errors are RFC 9457 problems
// with a stable `code`; the access token lives only in memory (never in storage).

export interface Violation {
    field: string;
    message: string;
}

export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly violations: Violation[] = [],
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

let accessToken: string | undefined;
let onUnauthorized: (() => Promise<string | undefined>) | undefined;

export function setAccessToken(token: string | undefined) {
    accessToken = token;
}

/** Called once on a 401 of an authenticated request; returns a fresh token or nothing. */
export function setUnauthorizedHandler(handler: typeof onUnauthorized) {
    onUnauthorized = handler;
}

interface RequestOptions {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    /** Send the access token (and retry once with a refreshed one on 401). */
    auth?: boolean;
    signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await send(path, options, accessToken);
    if (response.status === 401 && options.auth && onUnauthorized) {
        const fresh = await onUnauthorized();
        if (fresh)
            return parse<T>(await send(path, options, fresh));
    }
    return parse<T>(response);
}

function send(path: string, options: RequestOptions, token: string | undefined) {
    const url = new URL(path, globalThis.location.origin);
    for (const [key, value] of Object.entries(options.query ?? {})) {
        if (value !== undefined && value !== '')
            url.searchParams.set(key, String(value));
    }
    const headers = new Headers({ Accept: 'application/json' });
    if (options.body !== undefined)
        headers.set('Content-Type', 'application/json');
    if (options.auth && token)
        headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
        credentials: 'same-origin',
        signal: options.signal,
    });
}

async function parse<T>(response: Response): Promise<T> {
    if (response.ok) {
        if (response.status === 204)
            return undefined as T;
        return response.json() as Promise<T>;
    }
    const problem = await response.json().catch(() => undefined) as
        | { code?: string; detail?: string; title?: string; violations?: Violation[] }
        | undefined;
    throw new ApiError(
        response.status,
        problem?.code ?? `HTTP_${response.status}`,
        problem?.detail ?? problem?.title ?? response.statusText,
        problem?.violations ?? [],
    );
}
