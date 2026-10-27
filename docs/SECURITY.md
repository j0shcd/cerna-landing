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

The published `.github/workflows/security.yml` runs `npm audit
--package-lock-only` daily at 06:17 UTC, on main pushes, manually and on
dependency/workflow PRs. It checks the remote npm lock, including development
dependencies. It installs no app packages or lifecycle scripts and has
`contents: read`, no deployment credentials and immutable action references.
Audit findings and command/network errors fail the job; reports remain for
14 days. This cloud check does not compare the installed tree or enforce the
local runtime policy. The broader local OSV scanner checks exact locked versions,
manifest drift, incomplete responses and policy; the local heartbeat runs it
with `--installed-npm`. Publishing that broader scanner remains a follow-up.

Dependabot is configured for weekly npm and GitHub Actions PRs, with a seven-day
cooldown for routine npm upgrades and no auto merge. Security PRs are not delayed
by the routine cooldown. Native Dependabot plus direct OSV queries was selected
over adding Renovate, Socket or Snyk accounts. Known-malware records help with
published compromises; they do not detect every unpublished malicious package.

The Dependabot configuration was published separately as `74f8368`. The owner
confirmed dependency graph, alerts and security updates enabled on 27 October;
the connector cannot independently read these administration settings. Actual
updater jobs and [Dependabot PRs](https://github.com/j0shcd/cerna-landing/pulls)
exist. Alert delivery has not been tested.

The npm-only cloud workflow was published separately as `ba08308`, without the
owner's nine unrelated pending commits. Its [first run](https://github.com/j0shcd/cerna-landing/actions/runs/40534703514)
completed on 27 October: checkout, Node setup and report upload succeeded; the
audit correctly failed with three vulnerable entries (one high, two moderate)
in the remote unpatched Wrangler/Miniflare/Undici chain. Local patched locks are
clean but not on the default branch. Automatic approval review initially
rejected a broader Cerna private-source/design upload. The owner then explicitly
approved security-only review PRs, excluding unrelated work and leaving merging
and deployment off. This public repository's proposal excludes the unrelated
analytics/welcome/unsubscribe commits and also restores the broader OSV cloud
scan; that scan becomes active on main only after merge. Verify the PR's own
cloud result separately from local scans and the default branch.

[Security review PR #3](https://github.com/j0shcd/cerna-landing/pull/3) is open,
unmerged. Its isolated remote-main snapshot excludes the nine local feature
commits and passes Worker typecheck, 58 unit tests, build and all 16 browser
tests. OSV covers 394 resolved versions with zero findings; the nine scanner
tests pass. The [PR cloud scan](https://github.com/j0shcd/cerna-landing/actions/runs/40536248619)
also passed and retained its report. This proves the proposed scanner runs;
the default branch still uses its older npm-only workflow and vulnerable lock.

Failed-workflow notification delivery and available Actions minutes were not
checked; no new subscription was created. The existing all-project 09:00 daily
local Codex security heartbeat covers both Cerna repos, retaining its previous
tasks without a duplicate. It stays quiet on unchanged findings. Local tasks
need the computer on and the app running; npm cloud audits run independently.
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

In the owner's broader local feature checkout, verified after the clean
install: Worker typecheck, 83 unit tests, the static
build and all 22 headless browser tests pass. The nine stdlib scanner tests pass;
mutation checks demonstrate that stale-store, missing-lock, manifest-drift and
incomplete-response failures cannot silently pass. The OSV scan covers all 406
locked package versions with zero findings. npm audit also reports zero. No
remote deployment or notification delivery was tested.
