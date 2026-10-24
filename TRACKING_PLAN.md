# Tracking plan

Product events of the web app, sent to PostHog (EU) **only after consent**. Names are snake_case `object_verb`; the TypeScript union `ProductEvent` in [`src/analytics/analytics.ts`](src/analytics/analytics.ts) is the source of truth, this file explains it.

## Automatic

| Event | Source |
|---|---|
| `$pageview`, `$pageleave` | posthog-js on every route change (`capture_pageview: 'history_change'`) |
| `$autocapture` | clicks and form submits; cards carry `data-ph-capture-attribute-dish-id` / `-restaurant-slug` (nothingeats-ui) |
| `$identify` | after login or session restore, with the account id as distinct id and `locale` as person property |

## Custom

| Event | When | Properties |
|---|---|---|
| `cuisine_filter_changed` | A cuisine is picked on the restaurant list | `cuisine` (slug or `all`) |
| `dish_add_clicked` | "Add to cart" on a dish (the cart does not exist yet, so this measures demand) | `dish_id`, `restaurant_slug`, `price_cents` |
| `language_changed` | The language switch is used | `from`, `to` (`de`/`en`) |
| `login_failed` | A login attempt fails | `code` (API error code, e.g. `INVALID_CREDENTIALS`) |

## Server side (same distinct id)

Events the services send through `ktor-posthog`, linked to the browser session by the `X-POSTHOG-*` tracing headers posthog-js adds to API requests: `user_signed_up`, `email_verified`, `user_logged_in` (identity), `email_sent` (notification).

## Consent

- Before a decision PostHog runs opted out with in-memory persistence: no events, no cookies, no local storage.
- "Einverstanden" switches to `localStorage+cookie` and opts in; "Lieber nicht" keeps it off. The footer's privacy settings ask again.
- No project key configured (local development): the SDK is never downloaded.
