# Landing page frontend

`pages/index.astro` composes the page. `layouts/Base.astro` owns metadata, local
font preloads, the skip link and the guarded intro flag. `styles/global.css`
owns Tailwind and shared tokens. All visible copy, demo data and accessible
names live in `content/copy.ts`. Components own their styles and interactions;
shared form behavior lives in `scripts/waitlist.ts`.

The marketing direction remains in [the owner's brief](../design/marketing.md).
The page is a near one-to-one rebuild of `design/reference/d5-design-led`
(tokens, grid, formula bar, statement card and its sequence, the three ruled
beats, closing, footer). On that base sit the owner's choices: the copy in
`copy.ts`, D3's first-visit clutter clearing off the grid, D4's `fx` nod in the
form, D1's import files with a Revolut EUR line, D3's categorise and check-in
examples compressed into D5's beat cards, and pastel category pigments as the
pop of colour. The "Sample data" labels were dropped to match D5; the hero card
keeps an "Example:" accessible name.
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
hide only sections below the viewport. There are no animation loops (the formula caret blinks six times and stops).

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
