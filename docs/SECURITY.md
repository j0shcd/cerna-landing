# Dependency security

Maintainer audit and monitoring runbook, 27 October 2026. Update after dependency
remediation and when activating the cloud checks.

The audit covered the complete npm lockfile, installed dependency tree, Node
runtime, Worker deployment shape and repository automation. It checked recent
September/October advisories and all known advisories for the recorded versions.
This is not a host-forensics or application penetration test. No Cloudflare
deployment, remote D1 mutation, mail delivery or analytics activation is part of
this work.

## Findings and fixes

The initial npm audit reported three entries: Wrangler, its Miniflare dependency
and Undici. They inherit three actual Undici advisories: EventSource memory
exhaustion (`GHSA-4qv8-2p9j-2685`), integrity-token validation bypass
(`GHSA-f72v-6w45-q472`) and excessive-content-encoding denial of service
(`GHSA-xjj6-f33q-929c`). The vulnerable copy was 7.29.1 nested under Wrangler;
the separate top-level 8.12.3 copy was not the affected version.

Wrangler 4.151.2 was updated to 4.153.0, resolving nested Undici to 7.30.1.
Astro 7.4.1 was updated to 7.4.2. Both the project and the owner-approved Volta
global default now use Node 24.22.1, replacing the vulnerable 24.16.0 runtime.
Node's October 21 fixes include Brotli memory corruption, DNS/TLS issues and
certificate trust changes. These are development/build-tool exposures here;
Cloudflare's deployed Worker runtime is managed separately.

The initial evidence is
[`audit-baseline-2026-10-27.json`](../security/audit-baseline-2026-10-27.json).
The updated lockfile reports zero npm vulnerabilities. The original installed
tree also contained stale `.pnpm`, `.ignored` and iCloud conflict copies of old
packages, which npm's lockfile audit did not cover. A clean `npm ci
--ignore-scripts` install was built outside iCloud and swapped into place;
installed versions must match the audited lock, including nested packages.
The app's native-library
findings do not apply to this separate JavaScript project. Exact dependency
matching is not proof that a development machine was never compromised.

[Node advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases),
[Undici EventSource](https://github.com/advisories/GHSA-4qv8-2p9j-2685),
[Undici integrity](https://github.com/advisories/GHSA-f72v-6w45-q472),
[Undici encoding](https://github.com/advisories/GHSA-xjj6-f33q-929c).

## Monitoring

`.github/workflows/security.yml` runs a complete OSV scan daily at 06:17 UTC,
on main pushes, manually and on dependency/policy PRs. It queries exact locked
versions including optional and development dependencies. It installs no app
packages or lifecycle scripts and has `contents: read`, no deployment
credentials and immutable action references. It fails on vulnerabilities,
network errors, missing locks, manifest/lock drift or incomplete OSV responses,
and retains its report for 14 days. Runtime policy checks the declared Node pin;
the local actual runtime was verified separately.

Dependabot is configured for weekly npm and GitHub Actions PRs, with a seven-day
cooldown for routine npm upgrades and no auto merge. Security PRs are not delayed
by the routine cooldown. Native Dependabot plus direct OSV queries was selected
over adding Renovate, Socket or Snyk accounts. Known-malware records help with
published compromises; they do not detect every unpublished malicious package.

The Dependabot configuration was published separately to the default branch
(commit `74f8368`) without publishing the owner's nine other pending commits.
The connector cannot change alert/security-update settings and the in-app
browser was signed out, so those settings await authenticated GitHub UI access.
The daily cloud scanner still requires publishing its files, checking the first
workflow result, and configuring failed-workflow notifications. Available
Actions minutes were not checked. Private jobs use the account's
included/paid Actions allowance; no new subscription was created. The existing
all-project 09:00 daily local Codex security heartbeat was updated to cover both
Cerna repositories explicitly, preserving its previous tasks and creating no
duplicate. It stays quiet on unchanged findings. Local tasks need the computer
on and the app running. Cloud monitoring is not active merely because these
files exist locally.
[Scheduled-task behavior](https://learn.chatgpt.com/docs/automations?surface=app).

```sh
node --version # >=24.22.1 in the pinned 24.x line
python3 -S tests/test_security_audit.py
python3 -S scripts/security_audit.py
npm audit
npm run check
npm test
npm run build
```

Use npm only. For installs/updates under Documents, stage `package.json` and
`package-lock.json` in a temporary directory outside iCloud, run npm there with
`--ignore-scripts`, inspect lockfile and advisory changes, then swap the completed
dependency tree into place and run verification. The Vite cache already uses
`.nosync`. Any future need for a dependency install
script should be reviewed explicitly before allowing it. Security fixes still
require tests and reviewed PRs. Record new exceptions with an expiry and concrete
reachability evidence; none are currently configured here.

## Verification status

Verified after the clean install: Worker typecheck, 83 unit tests, the static
build and all 22 headless browser tests pass. The nine stdlib scanner tests pass;
mutation checks demonstrate that stale-store, missing-lock, manifest-drift and
incomplete-response failures cannot silently pass. The OSV scan covers all 406
locked package versions with zero findings. npm audit also reports zero. No
remote deployment or notification delivery was tested.
