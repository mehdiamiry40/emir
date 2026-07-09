# Eagle

One page. One eagle. One date. Live at [www.emir.com.au](https://www.emir.com.au).

A single-screen Next.js site: a traced eagle mark centered above a fixed
date, with an adaptive light/dark theme, no scrolling, and a password-
protected admin page.

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
| `ADMIN_PASSWORD` | for sign-in | Password for `/signin` → `/admin`. Unset = sign-in disabled. |
| `SESSION_SECRET` | optional | HMAC key for session cookies (defaults to a hash of `ADMIN_PASSWORD`). |

The date comes from `app/site.js` (`DATE_LABEL` / `DATE_ISO`) and only changes
via a commit. Runtime storage and environment variables must not override it.

**The date is intentionally fixed. It must never advance on its own —
do not add clocks, midnight timers, or "current date" logic.**

## Structure

- `app/page.jsx` — the eagle + date + sign-in CTA
- `app/signin/` — password sign-in (server action, HMAC session cookie)
- `app/admin/` — protected admin page
- `app/api/date/` — authenticated endpoint that rejects date changes
- `lib/session.js`, `lib/date.js` — auth + date resolution
- `public/eagle-icon.svg` — the traced eagle used everywhere
- `test/` — smoke, visual, and axe accessibility tests (run in CI)

## Deployment notes

Vercel deploys this repo; **www.emir.com.au currently serves the
`claude/eagle-icon-homepage-tu0el3` branch** (the repo default), while
PRs typically merge to `main`. Recommended one-time cleanup:

1. GitHub → Settings → General → default branch → `main`
2. Vercel → Settings → Git → production branch → `main`
3. GitHub → Settings → Branches → protect `main`, require the `test` check
