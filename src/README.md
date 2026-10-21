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

## Themes and the review demo

Light is the default. Dark follows the system setting (`prefers-color-scheme`),
and `<html data-theme="light|dark">` can force either; there is no toggle. The
dark palette is the app's warm ink (`cerna-app/DESIGN.md` §2), and every
colour, shadow and category dot is a token in `styles/global.css`, so nothing
outside it hard-codes a colour.

The "It sorts. You nod." visual is a small copy of the app's Review queue
(`cerna-app` `ReviewCard.svelte`): merchant and amount, date and account, the
category with its pigment dot, "Worth checking" on the unsure row, and one
outlined Approve. Only the unsure row's category is interactive.

The header "Join the waitlist" link brings the nearest form into view, focuses
its email field and adds `.is-called` for one beam-and-ripple pass. Without
JavaScript it is a plain link to `/#join`; arriving on `/#join` from another
page plays the same call.

## Forms and motion

Both forms post natively to `/api/waitlist`; the enhancement sends the agreed
JSON shape. Pending state prevents concurrent submissions across both forms.
Success updates both instances. API errors preserve the address, and malformed
responses or network failures show `save_failed`. The native redirect carries
no email, so `?joined=1` uses “You’re on the list. We’ll write when Cerna opens.”
Redirect feedback needs JavaScript; the native submission itself does not.

After signup the header link focuses the visible confirmation instead of the
hidden field, and modified clicks (Cmd/Ctrl/Shift/Alt) keep native link behaviour.

Server-rendered HTML contains the final visual state. The early head script
opts into the intro only on the first session visit, when motion is allowed
and session storage is available. A blocked storage API leaves the final state.
The statement demo plays once on that first visit, when the card is half in view (so phones see it), or on Replay; its wrapper keeps the five-row height so the collapsing duplicate never moves the page. Header, hero and backdrop share one twelve-column grid of the content box (`--cols`, `--cw`, `--x0` on `.hero`). Scroll reveals
hide only sections below the viewport. There are no animation loops (the formula caret blinks six times and stops).

Fonts use only the three installed Latin variable WOFF2 files, preloaded from
this origin with optional display to avoid a late font swap. No external
browser service is used.

## Verification and next step

```sh
npx astro build
npx vitest run
node --test src/scripts/waitlist.test.mjs
npx tsc --noEmit --types @cloudflare/workers-types
npm run test:e2e   # Playwright 1.60: builds, serves dist via e2e/serve.mjs on :4329, headless
```

The browser checks in `e2e/` cover what only a real layout engine shows: the
intro never moves the section below the hero, and on a phone the statement
sequence waits until half the card is visible. Each was confirmed to fail with
its bug reintroduced.

`e2e/landing.spec.ts` adds header focus, call timing, hash navigation, closing-form
scroll preservation, reduced motion, legal-page arrival, pointer and keyboard
review decisions, and light/dark text contrast. It also covers modified clicks,
focus after signup, and both native POSTs with JavaScript disabled. Network
responses are intercepted; these checks do not submit real signups.

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
