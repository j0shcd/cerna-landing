**Recommendation (inference): Astro + TypeScript + Tailwind, Cloudflare Workers Static Assets, D1 with EU jurisdiction, and Brevo for email. Runner-up: Supabase Pro in Frankfurt or Zurich.**

Choose Supabase if hosted accounts and a billing portal are committed near-term work. Choose Convex when a future cloud product genuinely needs its reactive backend. A waitlist should not determine Cerna’s eventual application architecture.

Prices checked against current public documentation; USD unless stated. Scale estimates distinguish **100,000 retained addresses** from **100,000 new signups/month**, generating **200,000 emails** with owner notifications and double opt-in. Estimates exclude tax, domains, abuse and launch broadcasts.

### Store comparison

Judgments about fit, operational burden and lock-in are **inference**.

| Option | Residency and price | Decision |
|---|---|---|
| **D1 + Worker — pick** | Actual EU database jurisdiction. Workers can process requests globally. Free available; budget **$5/month** for Workers Paid, likely sufficient at the modelled scale. [Location](https://developers.cloudflare.com/d1/configuration/data-location/), [database pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/). | Small TS backend, low ops; portable SQL data, Cloudflare-specific bindings. Auth added separately later. |
| **Supabase — runner-up** | Frankfurt and Zurich available. Free pauses after inactivity; **$25/month Pro** includes the first project and daily backups. Regional database/Auth/storage/backups; some operational processing crosses borders. [Regions](https://supabase.com/docs/guides/platform/regions), [pricing](https://supabase.com/pricing), [residency](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq). | Best integrated relational platform here. Standard Postgres exit; more configuration than this waitlist needs. Budget $25 at either scale. |
| **Convex** | Ireland available; **30% regional usage surcharge**. Free/Starter available; Pro **$25/developer/month**. [Regions](https://docs.convex.dev/production/regions), [pricing](https://www.convex.dev/pricing). | Excellent TS experience, probably within free quotas for this workload; higher application-code coupling than SQL. No realtime requirement today. |
| **Neon + tiny API** | Frankfurt; free **1GB/100 CU-hours**. Launch compute **$0.106/CU-hour** plus storage. [Pricing](https://neon.com/pricing), [regions](https://neon.com/demos/regional-latency). | Portable Postgres; separate API plumbing. Tiny intermittent use can be free; continuously active 0.25 CU calculates to **$19.35/month** before storage/API. |
| **Firebase** | EU/Zurich Firestore options; free daily quotas. Firebase Authentication remains US-only. [Locations](https://firebase.google.com/docs/firestore/locations), [pricing](https://firebase.google.com/docs/firestore/pricing), [Auth residency](https://firebase.google.com/support/privacy#us-only_services). | Likely inexpensive database, but document/rules coupling and future auth residency weaken fit. |
| **PocketBase** | Free software; residency follows your host. Official pre-v1 production caution. [Documentation](https://pocketbase.io/docs/). | Josh owns patching, uptime and recovery. Unnecessary operational work. Hosting price unverified. |
| **Xata** | Current Postgres offering starts **$0.012/hour + $0.28/GB-month**. [Pricing](https://xata.io/pricing). | Portable data; current EU contractual coverage unverified. No clear advantage here. |
| **Airtable / Sheets** | Airtable EU residency requires Enterprise; Google regional controls depend on Workspace edition. [Airtable](https://support.airtable.com/articles/3345708696-data-residency-at-airtable), [Google](https://support.google.com/a/answer/14316863). | Useful exports, weak authoritative stores: sharing mistakes, manual edits and ingestion constraints. |

Convex supports [Clerk](https://docs.convex.dev/auth/clerk), [Better Auth](https://labs.convex.dev/better-auth), and its own [beta Auth library](https://docs.convex.dev/auth/overview). Its [Stripe component](https://stack.convex.dev/how-to-use-convex-stripe-component) handles integration plumbing. [Exports](https://docs.convex.dev/database/backup-restore) preserve table data, but migrating functions still requires work. **Inference:** neither auth nor Stripe makes Convex necessary.

D1 provides encryption at rest/in transit, with vendor-managed keys. [Security](https://developers.cloudflare.com/d1/reference/data-security/). **EU storage is not sovereignty:** overseas legal jurisdiction can remain relevant regardless of storage location. [US DOJ explanation](https://www.justice.gov/archives/opa/pr/justice-department-announces-publication-white-paper-cloud-act).

### Managed alternatives

Judgments below are **inference**; these can replace substantial backend work, but do not establish a future account backend.

| Tool | Published economics / material limitation |
|---|---|
| **Formspark** | Strongest managed runner-up: 250 free submissions; 50k bundles **$25 promotional/$50 list**. EU storage, notifications, exports and Turnstile. Disable optional US spam processor. [Pricing](https://formspark.io/pricing/), [subprocessors](https://formspark.io/legal/subprocessors/). |
| **Tally** | Unlimited forms under fair use; notifications/webhooks. Consistent 50k monthly notifications triggers fair-use discussion. [Plans](https://tally.so/help/plans-and-pricing), [fair use](https://tally.so/help/fair-use-policy). |
| **Getwaitlist** | **$15/month** unlimited signups; US processing. Referral machinery unnecessary here. [Pricing](https://getwaitlist.com/pricing), [privacy](https://getwaitlist.com/privacy). |
| **Loops** | Free below 1k contacts; **$399/month at 100k**. EU residency unverified. [Pricing](https://loops.so/pricing). |
| **Resend Contacts** | Former Audiences model changed; approximately **$450/month at 100k marketing contacts**. US storage. [Current model](https://resend.com/blog/new-contacts-experience), [tariff](https://resend.com/migrate/customer-io), [residency](https://resend.com/security/gdpr). |
| **Buttondown / Kit** | Free to 100 / 10k subscribers respectively; 100k quotes unverified. Better suited to newsletter operations. [Buttondown](https://buttondown.com/pricing), [Kit](https://help.kit.com/en/articles/16627071-the-kit-free-plan). |
| **Basin** | Free 50 submissions/month; paid tiers/overages. Optional spam-training retention deserves scrutiny. [Pricing](https://usebasin.com/pricing), [privacy](https://usebasin.com/gdpr). |

### Email path

| Sender | Tiny scale / 200k sends | Residency and fit |
|---|---|---|
| **Brevo — pick** | Free **300/day**; exact 200k tier unverified. [Plans](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans). | EU databases in France/Germany/Belgium; straightforward REST API. [Storage](https://help.brevo.com/hc/en-us/articles/360001005510-Data-storage-location). |
| **Mailgun EU** | Free 100/day; calculated **$200/month** on Scale plus overage. [Pricing](https://www.mailgun.com/pricing/). | EU messages/logs/suppressions; some account data global. [Regions](https://www.mailgun.com/about/regions/). |
| **SES EU** | Metered; **$32 Essentials or $20 explicitly selected à-la-carte**, plus ancillary charges. [Pricing](https://aws.amazon.com/ses/pricing/). | Regional setup; sandbox approval, IAM and bounce handling increase ops. [Regions](https://docs.aws.amazon.com/ses/latest/dg/regions.html). |
| **Resend** | Free 3k/month, 100/day; calculated **$155** using Pro overages. [Pricing](https://resend.com/pricing). | EU sending still stores content/logs in the **US**. [Explicit clarification](https://resend.com/security/gdpr). |
| **Postmark** | Free 100/month; paid from $15. Exact optimal 200k tier unverified. [Pricing](https://postmarkapp.com/pricing). | US infrastructure; no EU-server offering. [Residency](https://postmarkapp.com/eu-privacy). |
| **Infomaniak SMTP** | Normal mailbox limit **500 recipients/24h**. [Limits](https://www.infomaniak.com/en/support/faq/2065/understanding-the-24-hour-outgoing-email-limit). | Swiss option for small volume; equivalent scalable transactional API/tariff unverified. |
| **Scaleway TEM** | 300 included; approximately **€49.93/200k**. [Pricing](https://www.scaleway.com/en/transactional-email-tem/). | Additional European contender; quota increase required. |

**Inference:** use Brevo initially behind one sending adapter. With two messages per signup, its free allowance covers at most 150 signups/day.

Use an owned sender domain, never the visitor’s address or Gmail as `From`. Configure provider-generated DKIM/DMARC; preserve existing DNS records. Brevo shared-IP authentication does not require adding SPF/MX records. [Brevo instructions](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC). Verify alignment in Gmail “Show original,” ramp volume gradually, and disable tracking. No provider guarantees inbox placement. [Gmail requirements](https://support.google.com/mail/answer/81126).

### Hosting, framework and analytics

| Choice | Comparison |
|---|---|
| **Cloudflare hosting** | Free unlimited static delivery; Workers execution separate. Cloudflare recommends **Workers Static Assets for new projects**, with previews available. [Pricing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [guidance](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/), [previews](https://developers.cloudflare.com/workers/previews/). |
| Alternatives | Vercel Pro **$20/month**; Hobby noncommercial. Netlify Free uses 300 credits; Personal **$9/month**. Both offer previews/global delivery. GitHub Pages has commercial-use restrictions. Infomaniak starts **CHF10.91/month**, Swiss hosting; managed previews unverified. [Vercel](https://vercel.com/pricing), [Hobby](https://vercel.com/docs/plans/hobby), [Netlify](https://www.netlify.com/pricing/), [GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [Infomaniak](https://www.infomaniak.com/en/hosting/prices-and-characteristics). |
| **Astro — inference: pick** | Static HTML, selective interactive islands and file routes fit marketing growth. [Documentation](https://docs.astro.build/en/concepts/why-astro/). |
| Framework alternatives | [React Router](https://reactrouter.com/how-to/pre-rendering) prerenders and suits a committed React portal; [TanStack Start](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode) adds rendering beyond Router. [Vike](https://vike.dev/pre-rendering) supports mixed rendering. [vite-react-ssg](https://github.com/Daydreamer-riri/vite-react-ssg) recommends official React Router SSG for v7. [Plain Vite MPA](https://vite.dev/guide/build#multi-page-app) works but leaves shared page conventions manual. |
| Analytics | **Inference: start without client analytics; add Plausible when useful.** [Plausible](https://plausible.io/compliance) offers EU hosting/cookie-free measurement, from [$9/month](https://plausible.io/). [Fathom](https://usefathom.com/features/data-isolation) anonymizes EU traffic before US analytics storage; from $15. [Umami](https://umami.is/pricing) has free cloud/self-host options. [Cloudflare](https://developers.cloudflare.com/web-analytics/about/) is free; EU-only analytics storage unverified. |

### Recommended architecture in 10 lines — inference

```text
1. Astro builds HTML/CSS; small TypeScript form enhancement.
2. Workers Static Assets serves marketing pages.
3. POST /api/waitlist validates and limits submissions.
4. Honeypot plus optional Turnstile protects ingestion.
5. D1 EU stores unique emails, consent and pending/confirmed status.
6. One transaction inserts signup and durable email outbox.
7. Worker sends each new accepted signup notification to Gmail.
8. Brevo sends confirmation; retries never lose the signup.
9. Confirmation/unsubscribe endpoints update state; cron cleans expired data.
10. Future accounts/billing remain separate; export SQL when needed.
```

### Exact setup plan — proposed, not executed

1. Scaffold with `npm create astro@latest cerna-site`; choose strict TypeScript; run `npx astro add tailwind`. Set Astro’s `site` URL and retain static output. [Setup](https://docs.astro.build/en/guides/styling/).
2. Install Wrangler. Create `cerna-waitlist` using `npx wrangler d1 create cerna-waitlist --jurisdiction=eu`; create a separate preview database. Jurisdiction must be set at creation. [Documentation](https://developers.cloudflare.com/d1/configuration/data-location/).
3. Configure `main: "worker/index.ts"`, assets directory `./dist`, `run_worker_first: ["/api/*"]`, D1 binding `WAITLIST_DB`, and cron `*/1 * * * *`. [Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).
4. Proposed public build variable: `PUBLIC_TURNSTILE_SITE_KEY`. Runtime secrets, set through `wrangler secret put`: `BREVO_API_KEY`, `TURNSTILE_SECRET_KEY`, `RATE_LIMIT_HMAC_KEY`. Runtime variables: `SITE_ORIGIN`, `MAIL_FROM`, `ADMIN_NOTIFY_TO=owner@cerna.example`, `CONSENT_VERSION`, `EMAIL_ENABLED`. CI only: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
5. Add migrations for unique email, consent timestamps/version, token hashes/expiry, and retryable outbox. Apply with `wrangler d1 migrations apply cerna-waitlist --remote`. Send through [Brevo’s API](https://developers.brevo.com/reference/send-transac-email).
6. Build with `npm run build`; deploy with `wrangler deploy`. Before launch, verify duplicates, concurrent submissions, email failures/retries, confirmation expiry, unsubscribe, preview isolation and SQL restoration.

### Privacy, abuse and legal minimum

**Inference:** use honeypots, short-lived HMAC-based IP rate limits, per-address resend cooldowns and global sending caps. KV should not enforce authoritative uniqueness because it is eventually consistent. [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/). Validate Turnstile server-side, including hostname/action; tokens expire after five minutes and are single-use. [Validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). Turnstile still processes signals and has an independent-controller role for improvement. [Privacy addendum](https://www.cloudflare.com/en-in/turnstile-privacy-policy/).

Swiss email marketing generally requires prior opt-in and an opt-out route. [FDPIC](https://www.edoeb.admin.ch/de/werbung-marketing). **Inference:** use double opt-in for evidence and list hygiene; it is not a universal standalone GDPR/nDSG mandate. Suggested scope: “Email me when Cerna launches. Unsubscribe anytime.” Record the wording/version; avoid bundling unrelated newsletters.

Publish controller identity/contact, purposes, data categories, recipients, transfer countries/safeguards, retention, rights and withdrawal/complaint routes. [Swiss law](https://www.fedlex.admin.ch/eli/cc/2022/491/en), [GDPR Articles 3/13](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679). **Inference:** publish an impressum with legal name, postal address and email; exact application of e-commerce obligations to a waitlist-only page needs confirmation. [Swiss guidance](https://www.kmu.admin.ch/en/statutory-obligations-swiss-and-european-e-commerce-laws).

**Inference:** the simplest banner-free baseline has no analytics, ad pixels, embeds or persistent identifiers, and self-hosted fonts. Cookie-free analytics alone does not settle consent obligations across Europe. [CNIL](https://www.cnil.fr/fr/node/677).

**Risks and unverified:** complete vendor incident histories, account approvals, actual Gmail delivery, exact Brevo/Kit/Buttondown growth quotes, Xata EU terms, and country-specific legal applicability. EU database placement does not constrain global Workers, support or Gmail copies. Minimize notification content and log no emails/tokens.

Research only: no accounts, messages, implementation, deployment or commits. The recommendation remains proposed; the next bounded step is implementing and verifying the isolated signup flow. Repository documentation was unchanged in this read-only session.