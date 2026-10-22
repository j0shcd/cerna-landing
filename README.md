# Cerna site

## What this is

A static Astro launch page served by Cloudflare Static Assets, with a Worker API,
D1 waitlist and a Brevo outbox for owner notifications and welcome emails. The Worker handles `/api/*`;
static assets handle the site. No analytics, cookies or browser requests to third
parties are part of this backend. The Worker calls Brevo server-side when enabled.

## Local development

Use the existing dependencies (Node >=22.22; tests require `node:sqlite`).

```sh
npm run db:migrate:local
cp .dev.vars.example .dev.vars
npm run worker:dev
```

Set local secrets in `.dev.vars`; never commit that file. Keep `EMAIL_ENABLED=false`
for local work unless real owner and welcome email delivery is intended. Wrangler vars live in
`wrangler.jsonc`; use `.dev.vars` for local overrides. Set `SITE_ORIGIN` to the
local origin for development. HTTP localhost and 127.0.0.1 origins are accepted
only when `SITE_ORIGIN` is not HTTPS. For the Astro-only server use
`npx astro dev --background`; manage it with `npx astro dev status`,
`npx astro dev logs` and `npx astro dev stop`.

Checks:

```sh
npx tsc --noEmit -p worker/tsconfig.json
npx vitest run
```

Tests use the actual migration and SQL in in-memory Node SQLite, not a deployed
D1 database. Backend regressions cover legacy migration preservation, atomic
owner/welcome enqueueing (including rollback on welcome failure), duplicate and
honeypot behavior, welcome headers/template/recipient, signed deletion in all
POST formats, idempotency, GET safety, body limits, origins and shared rate limits.
Mutation checks confirmed that skipping deletion fails all four POST-format tests,
and accepting a tampered signature fails the invalid-token test; both mutations
were restored before the passing checks. `e2e/unsubscribe.spec.ts` covers page
states and native POST/303 navigation but still requires a Playwright run.
Minimal local declarations cover Node test APIs because the scaffold
has no `@types/node`. Ports, browser behavior, remote D1 and actual Brevo delivery
must be checked by the release owner.

## One-time Cloudflare and Brevo setup

```sh
npx wrangler d1 create cerna-waitlist --jurisdiction=eu
```

Put the returned database ID into the existing `WAITLIST_DB` binding in
`wrangler.jsonc`. Keep `migrations_dir` set to `migrations`; Wrangler applies
numbered migrations in order. Configure a Brevo sender on an owned domain with
verified DKIM/DMARC. `MAIL_FROM` must be an address on that domain, never Gmail.
Set `MAIL_FROM_NAME` to the intended sender name. `ADMIN_NOTIFY_TO` (the owner
recipient) is a secret, not a `wrangler.jsonc` var: `.dev.vars` locally, `wrangler secret put` in production. Signup addresses are never used as sender or Reply-To.

```sh
npx wrangler secret put BREVO_API_KEY
npx wrangler secret put ADMIN_NOTIFY_TO
npx wrangler secret put RATE_LIMIT_HMAC_KEY
npx wrangler secret put UNSUBSCRIBE_HMAC_KEY
```

Use separate randomly generated, high-entropy secrets for both HMAC keys. Set vars `SITE_ORIGIN` to the
public HTTPS origin (no trailing slash), `MAIL_FROM` to the verified sender,
`CONSENT_VERSION` to the approved consent version, and `EMAIL_ENABLED=true` when
backlog delivery is intended. The placeholder origin, sender and database ID must
be replaced before deployment.

```sh
npm run db:migrate:remote
npm run deploy
```

### Cloudflare rate-limiting rule

Before sharing the site, open Security → WAF → Rate limiting rules and add one
rule: URI Path starts with `/api/`, counting by IP, 10 requests per 10 seconds,
action Block for 10 seconds. The free plan allows one rule with 10-second
periods; the owner should confirm the available options in the dashboard.

The existing cron runs every minute. Deployment and account setup are not
performed by local tests.

## API and delivery

`GET /api/health` returns `200 {"ok":true}`. `POST /api/waitlist` accepts JSON or
form-encoded `email` and honeypot `company`, up to 2 KB. Emails are NFKC-normalized,
trimmed and lowercased before validation. Supported addresses deliberately use
ASCII only after normalization; non-ASCII local parts or domains return
`invalid_email` (use ASCII punycode for internationalized domains). Addresses
must contain exactly one `@`, a 1–64 character local part using letters, digits
or `!#$%&'*+/=?^_` plus backtick, `{|}~.-`, with no leading, trailing or consecutive
dots, and at least two domain labels. Each domain label contains 1–63 letters,
digits or hyphens with no leading or trailing hyphen. The final label must be
at least two letters or an `xn--` punycode label. Total length is at most 254
UTF-8 bytes. Duplicate signups return success without any additional outbox
rows. Nonempty honeypots return success without storing anything. Other methods
on these routes return 405 with `Allow`; unknown API routes return JSON 404.

JSON results are `200 {"ok":true}`, or `{ "ok":false, "error": ... }` with 400
`invalid_email`, 429 `rate_limited`, or 500 `save_failed`. Malformed or oversized
bodies use `invalid_email`. Form posts redirect with 303 to `/?joined=1#join` or
`/?error=invalid_email#join`, `/?error=rate_limited#join`, `/?error=save_failed#join`.
A rejected Origin (or Referer origin when Origin is absent) returns 403 JSON
`forbidden` for either encoding. Missing both headers is allowed.

Every new signup queues one owner notification and one welcome email in the
same transaction. The welcome uses `worker/emails/welcome.ts` unchanged, sent
from `MAIL_FROM`/`MAIL_FROM_NAME` to the signup address. The launch email is a
later operator workflow; no launch campaign sender is implemented here. Existing
signups are preserved by migration 0002 without welcome backfill. Apply both
numbered migrations before running the updated Worker. Migration 0002 copies
all existing signup/outbox data, rebuilds the tables with foreign keys enabled,
and restores the indexes; old consent remains valid alongside the new sentence.

`GET /api/unsubscribe` never deletes: it redirects with 303 to `/unsubscribe`
with the original query. `POST /api/unsubscribe` accepts `token` in the query,
a form-encoded body or JSON `{token}`; RFC 8058 `List-Unsubscribe=One-Click`
form bodies use the query token. The same 2 KB body cap, Origin/Referer policy
and shared per-IP limiter apply. A verified token deletes the signup and all
outbox rows immediately; repeating it succeeds. JSON and one-click requests
return `200 {"ok":true}` or `400 {"ok":false,"error":"invalid_token"}`.
Native forms redirect with 303 to `/unsubscribe?done=1` or
`/unsubscribe?error=invalid_token`; rate/storage failures use `rate_limited` /
`save_failed` with 429/500 for JSON and 303 for forms. Forbidden origins return
403 JSON. Other methods return 405 with `Allow: GET, POST`.

Tokens contain no email: `signupId.hex(HMAC-SHA256(UNSUBSCRIBE_HMAC_KEY,
"unsubscribe:" + signupId))`, verified with a constant-time signature comparison.
Keep the secret stable: rotating it invalidates previously sent links. Welcome
emails carry `List-Unsubscribe` pointing at the API and `List-Unsubscribe-Post:
List-Unsubscribe=One-Click`; the body link opens the human confirmation page.
The page is noindex and uses a native POST form with a tiny script for the token
and confirm/done/invalid states. Pending rows are deleted on unsubscribe; a send
already accepted by Brevo cannot be recalled, nor are copies in the owner's
mailbox deleted by this endpoint.

Rate counters use fixed 10-minute windows (5 attempts) and UTC days (20).
Every processor run first deletes counters older than the previous UTC day's
start, retaining only the current and previous day (the two-day window), even
when email is disabled or delivery fails.
Each window's increment is atomic and both increments share one D1 batch.
Signup and both conditional outbox insertions share one transactional batch.
The processor claims at most 20 due rows per run with a conditional 60-second
lease, and bounds each Brevo fetch to 15 seconds. Sends retry after 1 minute,
doubling to a 6-hour cap; attempt 10 fails permanently. Disabled email logs
`email disabled` once per run and preserves the backlog. Notification failure
does not change a saved signup's response.

Leases prevent simultaneous processors from sending the same claimed row during
normal operation. Delivery is at least once: a crash after Brevo accepts an email
but before D1 records success, or a process stalled beyond its lease, can cause a
duplicate. D1 and Brevo do not share a transaction.

Read the list:

```sh
npx wrangler d1 execute WAITLIST_DB --remote --command "SELECT email, created_at FROM waitlist_signups ORDER BY created_at"
```

Inspect failed delivery rows through D1 (`outbox.status='failed'`). After resolving
the cause, an operator can deliberately reset the chosen row to pending, clear
its lock and reset attempts to retry; avoid replaying rows already accepted by
Brevo. Error fields and logs contain fixed codes, never vendor response bodies.

## Data and privacy

Signup rows store a UUID, normalized email, ISO UTC timestamp, consent version,
exact consent sentence “Get notified when we launch.” (version `2026-10-22`) and source
`landing`. The outbox links to that UUID and stores delivery state, attempt count,
retry time, lease, fixed error code and sent time. Notifications to the owner
contain only the signup email, signup UTC timestamp and running signup total.
Rate-limit rows store only a keyed HMAC-SHA-256 IP digest, window and counter;
raw IPs and user agents are not stored. Old counters are pruned during all
outbox runs, retaining the current and previous UTC day. Unsubscribe immediately deletes the signup and cascades to all its outbox rows.
Other retention cleanup is not automated. Cloudflare and Brevo may separately retain
service logs according to account settings and their terms.

Privacy notice and impressum are drafted in `src/content/legal.ts` (pages `/privacy` and `/impressum`, linked from the footer). They contain `{{PLACEHOLDERS}}` for facts only the operator can supply; `npm run check:legal` lists them and `npm run deploy` refuses to run until none remain. Bump `CONSENT_VERSION` in `wrangler.jsonc` and the notice date whenever the notice changes in a way that affects what visitors agreed to.

Before launch the owner must publish the controller's identity and contact,
waitlist, welcome-email and owner-notification purposes and legal basis, recipients Cloudflare
and Brevo (including any transfers), concrete retention periods, and how to
exercise access, correction, deletion, withdrawal and other applicable rights.
The owner must choose those periods and handle requests, including any copies in
owner email. The privacy notice and sender configuration are launch requirements.

## Deliberately not built yet

Double opt-in confirmation mail: add a separate outbox kind and confirmation
state/token boundary before treating a signup as confirmed. Turnstile: verify server-side in `worker/handler.ts`
before persistence and add its browser integration separately; it would change
the current no-third-party-browser-request requirement.

Next release step: replace placeholders, set secrets and publish privacy facts,
then have the release owner run local live API/form checks and deploy verification.
No Cloudflare resources or Brevo settings are created by this implementation.
