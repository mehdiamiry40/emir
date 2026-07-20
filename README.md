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
| `ADMIN_USERNAME` | no | Username for `/signin`; defaults to `emir`. |
| `ADMIN_PASSWORD` | yes | Password for `/signin` → `/admin` and session signing; use a long, random value. |
| `NOTES_ENCRYPTION_KEY` | yes | Base64-encoded 32-byte key used for AES-256-GCM note encryption. Generate once with `openssl rand -base64 32`. |
| `UPSTASH_REDIS_REST_URL` or `KV_REST_API_URL` | production | Durable Redis endpoint used for private notes and sign-in rate limiting. |
| `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_TOKEN` | production | Token for the private notes and rate-limit database. |

Production sign-in and note storage fail closed when their configuration is
missing. Copy `.env.example` to `.env.local` for local setup. Development uses
in-memory fallbacks when Redis is not configured; production never does.

Notes are encrypted before they are written to Redis. Existing plaintext notes
are encrypted automatically the first time `/admin` loads after this variable is
configured. Keep a secure backup of `NOTES_ENCRYPTION_KEY`: replacing or losing
it makes existing notes unreadable. Never commit the real key to Git.

The date comes from `app/site.js` (`DATE_LABEL` / `DATE_ISO`) and only changes
via a commit. Runtime storage and environment variables must not override it.

**The date is intentionally fixed. It must never advance on its own —
do not add clocks, midnight timers, or "current date" logic.**

## Structure

- `app/page.jsx` — the eagle signal, statement, fixed date, and sign-in CTA
- `app/signal-field.jsx` — responsive canvas signal with reduced-motion support
- `app/signin/` — username/password sign-in (server action, HMAC session cookie)
- `app/admin/` — protected private notes editor
- `lib/session.js`, `lib/rate-limit.js`, `lib/notes.js` — auth + persistence
- `public/eagle-icon.svg` — the traced eagle used everywhere
- `test/` — smoke, visual, and axe accessibility tests (run in CI)

## Deployment notes

Vercel deploys `main` to [www.emir.com.au](https://www.emir.com.au). Protect
`main` in GitHub and require the `test` check before merge.
