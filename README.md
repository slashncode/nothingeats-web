# nothingeats-web

The customer web app of [NothingEats](https://github.com/slashncode/nothingeats): browse restaurants and menus, sign up, confirm the email, log in — in German and English. Ordering follows in phase 3.

Vite + React 19 + TypeScript, TanStack Router (file routes) and Query, react-i18next (ICU), [nothingeats-ui](https://github.com/slashncode/nothingeats-ui) for every component, PostHog with consent first.

## Develop

nothingeats-ui is consumed from the sibling checkout (`file:../nothingeats-ui`), like the Kotlin platform: build it first.

```bash
pnpm --dir ../nothingeats-ui install && pnpm --dir ../nothingeats-ui build
pnpm install
pnpm dev          # http://localhost:5173, /api is proxied to http://nothingeats.localhost (the k3d cluster)
pnpm test         # Vitest + Testing Library + MSW against the real router, session and i18n
pnpm lint && pnpm typecheck && pnpm build
```

After changing nothingeats-ui: rebuild it, then `pnpm install --force` here to refresh the copy.

## How it works

- **Routes** (`src/routes/`): `/` restaurants with cuisine filter and cursor paging, `/restaurants/$slug` menu, `/login`, `/register`, `/verify?token=` (link from the mail), `/account`. Loaders prefetch through TanStack Query; links preload on intent.
- **Sessions**: the access token lives in memory only; the refresh token is an httpOnly cookie the app never sees. On start and before expiry the app refreshes, never two refreshes at once (shared promise per tab, Web Locks across tabs), because a reused refresh token revokes the whole session family.
- **Language**: a saved choice, else the browser's, else German; after login the account's locale if nothing was chosen. Texts from the catalog come in the same language (`?lang=`), formats through React Aria's `I18nProvider` (`de-DE`, `en-GB`).
- **Analytics**: see [TRACKING_PLAN.md](TRACKING_PLAN.md).
- **Runtime config**: `/env.js`, written at container start from `POSTHOG_KEY` and `POSTHOG_HOST`, so one image serves every environment.

## Container

`Dockerfile`: nginx-unprivileged serving `dist/` with SPA fallback, immutable caching for hashed assets, security headers, `/healthz`. Runs with a read-only root filesystem (writes only `/tmp`). Deployed with the `static-web` chart from [nothingeats-charts](https://github.com/slashncode/nothingeats-charts).

## License

MIT
