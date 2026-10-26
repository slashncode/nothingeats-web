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
| `dish_add_clicked` | "Add to cart" on a dish (the cart does not exist yet, so this measures demand) | `dish_id`, `restaurant_slug`, `price_cents`, `source` (`menu` or `search`) |
| `language_changed` | The language switch is used | `from`, `to` (`de`/`en`) |
| `login_failed` | A login attempt fails | `code` (API error code, e.g. `INVALID_CREDENTIALS`) |
| `search_filter_changed` | A filter on the search page changes | `filter` (`cuisine`, `diet`, `mood`, `without`, `max_spice`, `max_price`, `open_now`, `reset`), `value` (comma-separated, `none` when cleared) |
| `search_suggestion_selected` | A completion in the search box is picked | `kind` (`dish` or `restaurant`), `position` (1-based) |

## Server side (same distinct id)

Events the services send through `ktor-posthog`, linked to the browser session by the `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` headers that the web app's fetch layer adds to API requests once PostHog is loaded (the search page waits for that on a deep link): `user_signed_up`, `email_verified`, `user_logged_in` (identity), `email_sent` (notification), `search_performed` (search: normalised query, language, result count, filters used, page; zero-result searches included, so they show what the catalog is missing).

## Consent

- Before a decision PostHog is **not loaded**: no SDK download, no remote config, no PostHog headers on API requests, no cookies. (An opted-out PostHog would still fetch its config and extension scripts from PostHog's servers.)
- "Einverstanden" loads and initialises it (the current page counts as the first `$pageview`) and identifies a user who logged in before. "Lieber nicht" keeps it unloaded; withdrawing later opts out and resets PostHog's stored ids. The footer's privacy settings ask again.
- No project key configured (local development): never loaded.
- posthog-js drops events from automated browsers as bots: a headless user agent, `navigator.webdriver`, or "HeadlessChrome" in `navigator.userAgentData.brands`. Browser checks against the real project have to override all three.
