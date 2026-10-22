# Cerna landing page: research, copy, design, stack

Status: direction chosen by the owner 2026-10-20 (his words in `design/marketing.md`); build not started when this was written. Evidence in `docs/research/` (six cited research runs and the copy brief). Five design mockups in `design/reference/d1..d5/`.

Brief (owner): a light single page about having finances on autopilot whose one action is a waitlist; a stack that grows into a multi-page launch site; an email to the owner's email (`ADMIN_NOTIFY_TO`, a secret) on every signup; a sensible store for the list; the seed of a real brand.

## Owner decisions

- **Copy:** taken from the design agents' lines, as listed in `design/marketing.md` (hero: "Life doesn't fit in a spreadsheet." with the live strikethrough on "spreadsheet"; closing: a huge "Close the spreadsheet." with only the waitlist button; waitlist note "The last cell you fill in. One email when Cerna opens, nothing else."; footer note as written there). The research run advised against "close the spreadsheet" style lines as contempt for the reader's tool; the owner overruled it. Short, scannable, human is the bar (a 4 to 7 word hit).
- **Design:** D5 is the base. Borrow D4's CTA nod to spreadsheets, D3's spreadsheet loading animation leading into D5's hero, D5's horizontal main-content section, D1's statement-import visual (plus a Revolut EUR line so currency conversion is visible), D3's categorisation visual (closest to the real UI) and D3's check-in visual, a pop of colour on D5's base, and light interactivity. D2's spreadsheet-to-band animation is kept for a future onboarding sequence, not this page. The D3 check-in view (a short summary of what changed and why) is a real-product goal.
- **Stack:** Astro + TypeScript + Tailwind on Cloudflare Workers, D1 (EU jurisdiction) for the list, Brevo for email. Convex is not used: the accepted plan (`HOSTED_BETA_PLAN.md`) already has FastAPI, one SQLite database per user and WorkOS AuthKit, so a Convex waitlist would add a third backend for no gain.
- **Location (owner, 2026-10-20; done 2026-10-21):** `~/Documents/03_Projects/Cerna/` holds two repos: `cerna-app` and `cerna-landing` (this repo: the site, plus this plan, `docs/research/` and the mockups in `design/reference/`). Stays in iCloud (the app and landing use `.nosync` for node_modules, caches and build output).
- **Privacy wording:** the owner's footer note, which is true of the hosted design (no ads, no selling data, take everything with you); the page makes no "stays on your computer" claim.

## What the research gave us (still useful)

- Show the product doing its job in the hero; every research-led design converged on a statement tidying itself next to the headline.
- Bound "autopilot" (the chores run on their own; every category waits for the owner's confirmation); name inputs (UBS, Revolut, francs) near the top; privacy as behaviour, not a badge.
- Waitlist form: email only, a defined next step, honest states, no fake scarcity (`docs/research/05-waitlist-craft.md`).
- Page budget of roughly 330 to 470 words excluding legal, one repeated CTA.
- The `copywriting` skill now carries five references distilled from this research (`voice-and-ban-list`, `positioning-and-narrative`, `hero-and-landing-craft`, `waitlist-and-launch`, `product-copy`). `product-copy.md` is a thin seed that needs its own research when product copy becomes a project.

Lesson recorded: the copy brief given to the proposers contained invented persona details (a weekly evening ritual) that the owner never supplied and that contradict the product's no-ritual stance. Copy briefs must use only facts and language the owner provided.

## Stack detail (research `docs/research/06-stack-and-vendors.md`, inference with sources)

Astro static site, one small Worker route `POST /api/waitlist` (validate, honeypot or Turnstile, rate limit), unique email in D1 with consent text and version, a durable outbox so a failed email never loses a signup, Brevo for the notification to the owner and for the signup confirmation, no analytics at first, a privacy page and an impressum. Runner-up: Supabase (Zurich or Frankfurt). The site lives in its own repository outside iCloud-synced folders (see the `icloud-sync` skill) so marketing deploys stay separate from the ledger repo.

Needs the owner (accounts, not code): a domain, a Cloudflare account, a Brevo account with a verified sender domain (DKIM and DMARC). Never use the visitor's or a Gmail address as the `From`.

Facts the owner still has to supply: launch date, price, countries beyond Switzerland, a founder note if one is wanted (the designs contain invented placeholders; none ship without the owner's words).

## Carried to the product (owner, 2026-10-20)

- The D3 check-in view (a short summary of what changed and why, set against the owner's usual) is a real-product goal, not only a landing visual.
- D2's spreadsheet-collapsing-into-a-plot animation is reserved for an onboarding sequence.

## Status: built, not deployed

Repository `cerna-landing` (moved from `~/Developer/cerna-site`; its own git history). Backend (Worker, D1 schema, outbox, Brevo adapter, 58 tests) and the D5-based page are implemented and were verified locally: unit tests, type check, build, a live local Worker run (valid, duplicate, invalid, honeypot, rate limit, origin, form post), and a real-browser pass at 1440, 1024, 768 and 390 (no overflow, no console errors, no third-party requests; form success and error states; the three demos; JS off; reduced motion). An independent read-only review found three P2s; two were fixed with tests (stricter email validation, retention cleanup independent of email delivery) and one was accepted (an owner notification can be delivered twice if a crash lands between Brevo accepting and D1 recording it; the same delivery limitation also applies to welcome mail).

Not done, needs the owner: a domain, a Cloudflare account (`wrangler d1 create cerna-waitlist --jurisdiction=eu`, put the id in `wrangler.jsonc`), a Brevo account with a verified sender domain and DKIM/DMARC, secrets and `EMAIL_ENABLED=true`, then `npm run db:migrate:remote` and `npm run deploy` (all steps in the site README). A live Brevo delivery to the owner's inbox has not been tested.

Privacy notice and impressum are drafted (`src/content/legal.ts`, pages `/privacy` and `/impressum`, footer links) with `{{PLACEHOLDERS}}` for the operator's legal name, address, contact email, transfer basis for Cloudflare and Google, retention period and register entry; `npm run deploy` refuses to run until they are filled. They have not had a legal review. Not built: double opt-in confirmation mail, Turnstile, analytics. Welcome and unsubscribe are implemented locally; see Go-live below. Wording drafted by the orchestrator and awaiting the owner's read: the currency sentence in column 1 and the shortened column 2 body; "Sample data" labels on the demos; the owner's other copy is verbatim from `design/marketing.md`.

## Rebuilt on D5 (2026-10-21)

The owner asked for the page to be "pretty much 1-1 with design 5 for a clean base" while keeping the choices in `design/marketing.md`. The earlier build had drifted (spreadsheet row and column headers, a coloured gradient band behind the features, heavy demo cards with "Sample data" labels). It now uses D5's tokens, grid, formula bar, statement card and its tidy-up sequence, ruled three-beat section, closing and footer, with the owner's copy, D3's first-visit clutter clearing, D4's `fx` nod in the form, D1's import files plus a Revolut EUR line, compact D3 categorise and check-in visuals, and pastel category pills as the pop of colour. Details in `src/README.md`. An adversarial design review of this version is in `docs/plans/2026-10-21-design-review-d5-rebuild.md`; the owner's decisions from it are implemented, with the beat-3 result lines awaiting his read and a bank-coverage line still open, using the new global `adversarial-design-review` skill.

## Review visual, dark theme, waitlist call (owner, 2026-10-21)

The owner asked for the sorting visual to look like the real app, a dark mode, and a short highlight on the waitlist form when the header link is used. All three are built (see `src/README.md`, "Themes and the review demo"). Browser tests cover them in `e2e/landing.spec.ts` (written by Codex): the header call, reduced motion, legal-page arrival, modified clicks, focus after signup, native POSTs without JavaScript, the review queue by pointer and keyboard, and WCAG AA text contrast in both themes. Each check was confirmed to fail with its bug reintroduced.

## Go-live (owner decisions 2026-10-22)

- **Signup email:** every new signup gets one welcome email (owner's text, `worker/emails/welcome.ts`; subject "You’re on the waitlist ✉️"; footer "Cerna · Based in Zurich" and a quiet unsubscribe link). The form note becomes "The last cell you fill in. Get notified when we launch." (owner: "no need to over-explain"), stored as consent text "Get notified when we launch." from version 2026-10-22. Implemented locally, uncommitted: migration 0002, welcome delivery, signed one-click unsubscribe (RFC 8058 headers plus a link in the email body), immediate signup/outbox deletion, the `/unsubscribe` page, and privacy wording. Local checks and mutation regressions pass; Playwright and deployed delivery remain unverified. Deployment steps and token semantics are in README.md.
- **Bot defence:** keep the honeypot and per-IP limits, and add one Cloudflare WAF rate-limiting rule on `/api/*` at deploy. No Turnstile (no third-party script in the page).
- **Analytics:** the owner wants basic analytics; vendor survey in progress (`tool-selection-research`), and the choice will be recorded here. The privacy notice must then be updated ("runs no analytics" becomes false).

Checklist before going live:
1. Owner: domain and DNS (SPF, DKIM, DMARC for the sender); Cloudflare account; Brevo account with a sender on the domain; a contact mailbox on the domain; legal details for the privacy notice and impressum placeholders (a legal read is advised).
2. Build: analytics once chosen; a link preview (og:image, og:url, canonical); a 404 page (`not_found_handling: 404-page` expects one); a real favicon (the current one is the removed square mark); robots.txt and a sitemap.
3. Verify: real Safari (iPhone) and Firefox (tests run in Chromium only; the page uses light-dark(), @property, subgrid and container queries); a preview deploy with one real signup end to end (owner notification, welcome email, unsubscribe, mail headers checked with a tester).

## Next bounded step

Owner reviews the page (the intro animation, the colour wash behind the feature columns, the demos), supplies the accounts and domain, and decides the privacy page content. Then deploy to a preview, send one real signup end to end, and add the privacy page before sharing the link.
