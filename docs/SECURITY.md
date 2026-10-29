# Dependency security

Maintainer audit and monitoring runbook. Status verified 29 October 2026.
Update after dependency remediation and cloud-check changes.

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

The published `.github/workflows/security.yml` queries OSV for every exact
locked npm version daily at 06:17 UTC, on main pushes, manually and on PRs.
The scanner also checks manifest/lock agreement and the recorded Node runtime
policy. It installs no app packages or lifecycle scripts and has
`contents: read`, no deployment credentials and immutable action references. Findings,
command/network errors and incomplete responses fail the job; reports remain
for 14 days. The nine scanner regression tests run before each cloud scan.

The cloud scan does not inspect the local installed tree. Use
`python3 -S scripts/security_audit.py --installed-npm` for that additional check;
`npm audit --package-lock-only --ignore-scripts` is a separate registry check.

Dependabot is configured for weekly npm and GitHub Actions PRs, with a seven-day
cooldown for routine npm upgrades. Guarded security-patch merging is configured
but activation remains unverified, as described below. Security PRs are not delayed
by the routine cooldown. Native Dependabot plus direct OSV queries was selected
over adding Renovate, Socket or Snyk accounts. Known-malware records help with
published compromises; they do not detect every unpublished malicious package.

The Dependabot configuration was published separately as `74f8368`. The owner
confirmed dependency graph, alerts and security updates enabled on 27 October;
the connector cannot independently read these administration settings. Actual
updater jobs and [Dependabot PRs](https://github.com/j0shcd/cerna-landing/pulls)
exist. Alert delivery has not been tested.

The initial npm-only cloud workflow correctly reported the vulnerable
Wrangler/Miniflare/Undici chain. The owner separately approved merging
[security PR #3](https://github.com/j0shcd/cerna-landing/pull/3) on 29 October;
it is merged on main as `9a4911504ebf1650c0249d52678cfab43a62bdc1`. This publishes
the patched dependencies and broader OSV scanner. The unrelated local
analytics/welcome/unsubscribe work remains unpublished.

Failed-workflow notification delivery and available Actions minutes were not
checked; no new subscription was created. The existing all-project 09:00 daily
local Codex security heartbeat covers both Cerna repos, retaining its previous
tasks without a duplicate. It stays quiet on unchanged findings. Local tasks
need the computer on and the app running; OSV cloud audits run independently.
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

## Cloud rollout, 29 October 2026

PR #3 merged at reviewed head `54c8da2` after fresh npm and OSV checks reported
zero findings across its 394 resolved versions. The merged main commit's
[security audit](https://github.com/j0shcd/cerna-landing/actions/runs/40834461783)
passes all nine scanner tests, scans 394 versions with zero findings and retains
the report. Its
[validation run](https://github.com/j0shcd/cerna-landing/actions/runs/40834461778)
passes policy checks, installation, types, units, build and browser tests.
The merged security branch has been deleted.

Validation pins Ubuntu 24.04 because the locked Playwright 1.60.0 rejects Ubuntu
26.04. The metadata-only audit ran successfully on Ubuntu 26.04. The audit's
upload-artifact v4 still emits a Node 20 deprecation warning while GitHub forces
it onto Node 24; this warning did not fail the audit. A separate Dependabot
upload-artifact 7.0.2 branch exists. Next toolchain step: review its bundled
dependencies and compatibility, then validate the action update before merging.

Local main includes the remote merge while preserving the owner's unpublished
feature commits. The 29 October preflight found recurring iCloud conflict
copies in local node_modules. No packages were installed during this merge;
prior installed-tree results below are historical. Before the next local app
verification, rebuild dependencies outside iCloud using the procedure above and
rerun the installed-tree scan. The optional PostHog key can remain unset.

Next merge-policy step: verify the owner-created main ruleset, requiring only
`Dependency validation` from GitHub Actions with strict/up-to-date branches,
a PR with zero approvals and no bypass actors, then observe a qualifying
Dependabot PR. `Dependency security audit` remains mandatory in the bot guard
and stays outside native required checks. Passing CI does not prove ruleset
activation or an actual automatic merge. The app repository's status must be
verified separately.

## Guarded security-patch merges (activation unverified)

The owner authorized guarded Dependabot security-patch merging on 27 October.
This authorizes future qualifying bot merges by this guard; it does not waive
confirmation for agent-authored pushes or manual PR merges.
Publication and activation must be verified separately; per-push confirmation
is required for agent-authored changes.
Human-authored PR merges and product deployment require separate authorization.
Landing PR #3 received that merge authorization on 29 October; app PR #15 did not
receive authorization in this task. The guard authorization applies only to
these repositories; it is not a global setting for future projects.

Only npm's `security-patches` group is eligible. The group applies exclusively
to security updates and patch versions. The controller verifies exactly one
signature-verified Dependabot-authored commit, with a Dependabot or GitHub
web-flow committer and verification reason `valid`. It parses the narrow signed
metadata footer and checks the canonical same-repository bot branch. Every
resolved version change must independently be a stable same-major/minor patch.

Only the existing manifest/lock paths can change. Scripts, dependency names,
package layout, engine requirements and other metadata must stay unchanged.
Tarball URLs must match the package name/version on npm's registry, and SHA-512
integrity must change. The actual npm publisher identity (including trusted
publisher configuration) must remain unchanged; missing or changed identities
require manual review. Registry requests receive no GitHub Authorization header,
and HTTP redirects are refused. Added/removed packages, prereleases, minor/major, Conda,
GitHub Actions, unknown data or broader transitive changes require review.

The privileged job uses Python's standard library and fetches its policy only
from a GitHub-verified `main` commit. It checks out no PR code, consumes no PR
artifacts and uses no helper action packages. Read-only validation jobs run
types, units, builds and headless browser tests; the app also runs backend tests
and source guards against isolated fixtures. No application credentials or
live ledger are supplied. The CI micromamba binary is release `2.10.0-0`, with
SHA-256 `701f39c06f8e6a670a0e186c8479b9e5c0502a2f0cda6cef65d83bdd2875e8bd`.

The controller requires successful `Dependency validation` AND `Dependency
security audit` checks from GitHub Actions on the exact PR head, including any
other native required checks. It verifies the branch is current with main, then
uses the immediate protected merge API with the expected head SHA. It never
queues an auto-merge request across later pushes. Completion events retry late
CI results; stale heads and behind-main branches decline safely. No deployment
step is added. The repository's “Allow auto-merge” checkbox is not required.
GitHub's built-in token does not trigger post-merge push workflows. The exact
PR head is validated before merging; the next scheduled audit checks main.
No post-merge validation or deployment delivery is claimed.

**Owner-only activation:** both main branches were unprotected in the live
27 October read. After publishing and verifying CI, import
[`dependabot-automerge.ruleset.json`](../security/dependabot-automerge.ruleset.json)
under repository Settings → Rules → Rulesets. This is an active main-branch
ruleset with no bypass actors, no force pushes/deletion, pull requests with zero
required approvals, and up-to-date `Dependency validation` from GitHub Actions.
The connector cannot change administration settings; no local GitHub CLI login
is available. Do not buy a plan or widen app/token permissions incidentally.

The native rule requires functional validation only. The controller separately
requires the absolute security audit to pass before ANY automatic merge. This
keeps known vulnerabilities blocking bots without locking out manually reviewed
repairs when upstream fixes are unavailable. The app additionally requires the
full OSV/Python/native workflow and its resolved inventory at the exact PR head;
a green npm-only job cannot authorize an app merge. Until the broader security
PR is merged and its native findings clear, app bot merges remain blocked.

Active strict rules and check-source IDs are read from the metadata-accessible
REST branch-rules API. Every effective ruleset must report this token's
`current_user_can_bypass` as `never`; unknown/bypass-capable responses decline.
The controller rechecks the rules and the live main tip immediately before the
merge. The read-only API probe confirmed that bypass field exists without
administration access. Classic-only protection is not supported. The actual
workflow token, runner behavior and first qualifying automatic merge still
need live verification; fixture tests are not activation proof.
If private-repository rulesets are unavailable on the current plan, keep that
repository manual and ask before changing plans.

Review found and corrected the original administration-only GraphQL lookup,
a self-check wait that could never become `clean`, a Chrome reinstall conflict,
and a rule that would lock main on existing vulnerabilities. New helper actions
were rejected after exact runtime-lock scans found known advisories, including
Undici in fetch-metadata v3.1.0 and setup-micromamba v3.2.1. Neither is used.
Seventeen policy tests cover the controller and parser with adversarial cases;
disabling strict-rule enforcement makes a regression fail. Registry probes
exercise real version metadata without installing packages. The latest complete
local app browser run is 196 passed / one pre-existing sentinel-crawl failure;
focused policy/runtime/source-guard tests pass. The remaining app gate failure
is not hidden by this setup.

Existing pinned checkout/setup-node/upload actions remain separate toolchain
components: application-lock scans do not establish their bundled dependencies
are clean. The privileged merge path uses none of them; continue upstream
bundled-dependency checks in the security monitor.

Next: verify the owner-created ruleset and a qualifying Dependabot PR end to
end. The daily monitor
owns follow-up and reports meaningful activation/CI failures without repeating
unchanged findings. Behind-main branches need a Dependabot rebase before retry;
never force-push or bypass checks to obtain an automatic merge.

## Earlier local verification, 27 October 2026

In the owner's broader local feature checkout, verified after the clean
install: Worker typecheck, 83 unit tests, the static
build and all 22 headless browser tests pass. The nine stdlib scanner tests pass;
mutation checks demonstrate that stale-store, missing-lock, manifest-drift and
incomplete-response failures cannot silently pass. The OSV scan covers all 406
locked package versions with zero findings. npm audit also reports zero. No
remote deployment or notification delivery was tested.
