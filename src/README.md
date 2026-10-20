# Landing page frontend

`pages/index.astro` composes the page. `layouts/Base.astro` owns metadata, local
font preloads, the skip link and the guarded intro flag. `styles/global.css`
owns Tailwind and shared tokens. All visible copy, demo data and accessible
names live in `content/copy.ts`. Components own their styles and interactions;
shared form behavior lives in `scripts/waitlist.ts`.

The marketing direction remains in [the owner's brief](../design/marketing.md).
D5 supplies the layout; D3 supplies the clearing sequence and product examples,
D4 the formula-bar form, D1 the import notes, and D2 the category pigments.
The financial examples are sample data. In particular, the monthly summary is
an intended product experience, not proof of implemented finance-app behavior.

## Forms and motion

Both forms post natively to `/api/waitlist`; the enhancement sends the agreed
JSON shape. Pending state prevents concurrent submissions across both forms.
Success updates both instances. API errors preserve the address, and malformed
responses or network failures show `save_failed`. The native redirect carries
no email, so `?joined=1` uses “You’re on the list. We’ll write when Cerna opens.”
Redirect feedback needs JavaScript; the native submission itself does not.

Server-rendered HTML contains the final visual state. The early head script
opts into the intro only on the first session visit, when motion is allowed
and session storage is available. A blocked storage API leaves the final state.
The statement demo plays once after that intro or on Replay. Scroll reveals
hide only sections below the viewport. There are no animation loops.

Fonts use only the three installed Latin variable WOFF2 files, preloaded from
this origin with optional display to avoid a late font swap. No external
browser service is used.

## Verification and next step

```sh
npx astro build
node --test src/scripts/waitlist.test.mjs
npx tsc --noEmit --types @cloudflare/workers-types
```

The Node tests exercise the built form module with a small DOM adapter. They
cover the JSON contract, shared pending/success states, error retention, failed
responses and redirect parameters. They do not verify browser DOM behavior.
Root `npx tsc --noEmit` requires the backend Cloudflare globals; supplying the
installed types explicitly avoids changing the shared tsconfig.

Next: the orchestrator should check 1440, 1024, 768 and 390px in a real browser,
keyboard and reduced-motion behavior, storage denial, both form locations,
no-JS submission through the Worker, API failures and the browser network log.
No browser, port binding, live signup, commit or deployment was performed by
the frontend worker. Changes remain uncommitted for integration.
