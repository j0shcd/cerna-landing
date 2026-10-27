## Repo layout

This repo is `Cerna/cerna-landing`, a sibling of `Cerna/cerna-app` (the product). Plan: `docs/plan.md`; research: `docs/research/`; copy brief: `design/marketing.md`; mockups: `design/reference/`. Earlier locations (`~/Developer/cerna-site`, landing files inside the app repo) are obsolete.

## Development

`package-lock.json` is authoritative; use npm only. This checkout now lives
under Documents. Install/update dependencies in a temporary directory outside
iCloud, then move the completed `node_modules` tree into place. Keep the existing
`.nosync` Vite/Playwright caches. Mixing package managers previously left stale
vulnerable pnpm stores and conflict copies even after `npm audit` was clean.
See `docs/SECURITY.md` for dependency verification.

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
