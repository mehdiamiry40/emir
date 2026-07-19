# EMIR

One page. One eagle. One date. Live at [www.emir.com.au](https://www.emir.com.au).

A single-screen Next.js site with a centered eagle signal, precise white type,
a deliberately fixed date, no scrolling, and a password-protected private page.

## Commands

```bash
npm run dev     # dev server
npm run build   # production build
npm start       # serve the production build
npm test        # build + smoke/visual/a11y tests (Playwright + axe)
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | yes | Password for `/signin` → `/admin`. |
| `SESSION_SECRET` | yes | Independent HMAC key for session cookies; use at least 32 random bytes. |
| `UPSTASH_REDIS_REST_URL` | production | Durable Redis endpoint used for sign-in rate limiting. |
| `UPSTASH_REDIS_REST_TOKEN` | production | Token for the rate-limit Redis database. |

Production sign-in fails closed when session or rate-limit configuration is
missing. Copy `.env.example` to `.env.local` for local setup. Development uses
an in-memory limiter when Upstash is not configured; production never does.

The date comes from `app/site.js` (`DATE_LABEL` / `DATE_ISO`) and only changes
via a commit. Runtime storage and environment variables must not override it.

**The date is intentionally fixed. It must never advance on its own —
do not add clocks, midnight timers, or "current date" logic.**

## Structure

- `app/page.jsx` — the eagle signal, statement, fixed date, and sign-in CTA
- `app/signin/` — password sign-in (server action, HMAC session cookie)
- `app/admin/` — protected read-only private page
- `lib/session.js`, `lib/rate-limit.js`, `lib/date.js` — auth + date resolution
- `public/eagle-icon.svg` — the traced eagle used everywhere
- `test/` — smoke, visual, and axe accessibility tests (run in CI)

## Deployment notes

Vercel deploys `main` to [www.emir.com.au](https://www.emir.com.au). Protect
`main` in GitHub and require the `test` check before merge.
