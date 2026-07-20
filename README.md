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
| `ADMIN_PASSWORD` | yes | Password for `/signin` → `/admin`; use a long, random value. |
| `SESSION_SECRET` | no | Dedicated base64-encoded 32-byte key for authenticated session cookies. Generate with `openssl rand -base64 32`. When omitted, sessions use a domain-separated key derived from `NOTES_ENCRYPTION_KEY`. |
| `NOTES_ENCRYPTION_KEY` | yes | Base64-encoded 32-byte key used for AES-256-GCM note encryption and as the migration-safe session-key fallback. Generate once with `openssl rand -base64 32`. |
| `PASSKEY_RP_ID` | production | WebAuthn relying-party domain, without a scheme or port; for this site use `emir.com.au`. |
| `PASSKEY_ORIGINS` | production | Comma-separated HTTPS origins allowed to create and use passkeys. |
| `UPSTASH_REDIS_REST_URL` or `KV_REST_API_URL` | production | Durable Redis endpoint used for private notes, sessions, passkeys, and sign-in rate limiting. |
| `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_TOKEN` | production | Token for the private authentication and notes database. |

Production sign-in, session validation, and note storage fail closed when their
configuration is missing. Copy `.env.example` to `.env.local` for local setup.
Development uses in-memory fallbacks when Redis is not configured; production
never does.

Sessions are authenticated independently of `ADMIN_PASSWORD` and backed by
short-lived Redis records. Signing out revokes the current record immediately.
Sessions created with a passkey remain valid only while that credential is
registered. Setting a dedicated `SESSION_SECRET` lets session keys rotate
independently of encrypted notes; changing whichever key is active signs out
all existing sessions.

Notes are encrypted before they are written to Redis, and normal application
reads reject legacy plaintext records. If a trusted pre-encryption backup still
needs migration, review it offline, independently record its SHA-256 digest, and
run:

```bash
TRUSTED_SHA256='paste-the-reviewed-64-character-hex-digest-here'
node scripts/migrate-legacy-note.mjs /secure/path/legacy-note.json "$TRUSTED_SHA256" > encrypted-note.json.tmp &&
  mv encrypted-note.json.tmp encrypted-note.json
```

The command requires `NOTES_ENCRYPTION_KEY`, verifies the exact input digest,
performs no Redis operations, and emits an authenticated envelope for a
controlled maintenance import. With a trusted maintenance client, store the
parsed JSON object—not a quoted JSON string—at Redis key
`emir:notes:primary` before deploying the strict reader. Then load `/admin` and
confirm the expected note before deleting the trusted backup. Avoid placing
plaintext in logs or shell history. Keep a secure backup of
`NOTES_ENCRYPTION_KEY`: replacing or losing it makes existing notes unreadable.
Never commit the real key to Git.

Passkeys use WebAuthn discoverable credentials with device verification. Sign in
with the password once to add a passkey from `/admin`; subsequent sign-ins can
use the passkey without a username. The private key remains with the device or
its passkey provider. Redis stores only the public credential, transport
metadata, signature counter, and five-minute one-time challenges.

The date comes from `app/site.js` (`DATE_LABEL` / `DATE_ISO`) and only changes
via a commit. Runtime storage and environment variables must not override it.

**The date is intentionally fixed. It must never advance on its own —
do not add clocks, midnight timers, or "current date" logic.**

## Structure

- `app/page.jsx` — the eagle signal, statement, fixed date, and sign-in CTA
- `app/signal-field.jsx` — responsive canvas signal with reduced-motion support
- `app/signin/` — username/password sign-in (server action, revocable session cookie)
- `app/admin/` — protected private notes editor
- `lib/session.js`, `lib/rate-limit.js`, `lib/notes.js` — auth + persistence
- `scripts/migrate-legacy-note.mjs` — reviewed offline legacy-note conversion
- `public/eagle-icon.svg` — the traced eagle used everywhere
- `test/` — smoke, visual, and axe accessibility tests (run in CI)

## Deployment notes

Vercel deploys `main` to [www.emir.com.au](https://www.emir.com.au). Protect
`main` in GitHub and require the `test` check before merge.
