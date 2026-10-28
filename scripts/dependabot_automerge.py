"""Fail-closed merge policy. The privileged job executes trusted base code only."""
import argparse
import base64
import copy
import json
import os
import re
import time
import urllib.request
import urllib.parse

REPOSITORIES = {'j0shcd/cerna-app': 'frontend/', 'j0shcd/cerna-landing': ''}
CHECKS = {'Dependency security audit', 'Dependency validation'}
VERSION = re.compile(r'^(\d+)\.(\d+)\.(\d+)$')
DEPENDENCIES = {'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'}


class Ineligible(ValueError):
    pass


def require(condition, reason):
    if not condition:
        raise Ineligible(reason)


def patch(before, after):
    old, new = VERSION.fullmatch(before), VERSION.fullmatch(after)
    require(old is not None and new is not None, 'non-stable or unknown version')
    a, b = tuple(map(int, old.groups())), tuple(map(int, new.groups()))
    require(a[:2] == b[:2] and a[2] < b[2], 'not a patch-only increase')


def versions_only(before, after):
    old, new = copy.deepcopy(before), copy.deepcopy(after)
    for section in DEPENDENCIES:
        a, b = old.pop(section, {}), new.pop(section, {})
        require(a.keys() == b.keys(), 'dependency added or removed')
        for name in a:
            if a[name] != b[name]:
                # Preserve the existing range operator as well as major/minor.
                x, y = re.fullmatch(r'([~^]?)(\d+\.\d+\.\d+)', a[name]), re.fullmatch(r'([~^]?)(\d+\.\d+\.\d+)', b[name])
                require(x is not None and y is not None and x[1] == y[1], 'dependency range changed')
                patch(x[2], y[2])
    require(old == new, 'manifest contains non-version changes')


def eligible(repo, pr, metadata, files, protection, old_manifest, new_manifest, old_lock, new_lock):
    require(repo in REPOSITORIES, 'repository not allowed')
    prefix = REPOSITORIES[repo]
    require(pr['state'] == 'open' and not pr['draft'], 'PR is closed or draft')
    require(pr.get('commits') == 1, 'exactly one verified Dependabot commit is required')
    require(pr['user']['login'] == 'dependabot[bot]' and pr['user']['id'] == 49699333, 'not Dependabot')
    require(pr['base']['ref'] == 'main' and pr['base']['repo']['full_name'] == repo and pr['head']['repo']['full_name'] == repo, 'wrong base or fork')
    require(metadata.get('group') == 'security-patches', 'not the security-only group')
    require(metadata.get('update_type') == 'version-update:semver-patch', 'not a patch update')
    require(metadata.get('ecosystem') in {'npm', 'npm_and_yarn'}, 'unsupported ecosystem')
    require(metadata.get('directory') == '/' + prefix.rstrip('/'), 'wrong dependency directory')
    require(files and len(files) == pr['changed_files'], 'incomplete file list')
    allowed = {prefix + 'package.json', prefix + 'package-lock.json'}
    require({f['filename'] for f in files} <= allowed and all(f['status'] == 'modified' for f in files), 'unexpected changed files')
    require(prefix + 'package-lock.json' in {f['filename'] for f in files}, 'missing lock change')
    require(protection and protection.get('requiresStatusChecks') is True and protection.get('requiresStrictStatusChecks') is True and protection.get('activeRulesVerified') is True, 'strict branch protection is missing or unreadable')
    require(protection.get('requiresApprovingReviews') is False, 'review approval is required; leave for review')
    require({'Dependency validation'} <= set(protection.get('requiredStatusCheckContexts') or []), 'required validation checks are missing')
    versions_only(old_manifest, new_manifest)
    a, b = copy.deepcopy(old_lock), copy.deepcopy(new_lock)
    old, new = a.pop('packages'), b.pop('packages')
    require(a == b and a.get('lockfileVersion') == 3, 'lock metadata changed')
    require(old.keys() == new.keys(), 'lock packages added, removed or relocated')
    versions_only(old[''], new[''])
    changed = 0
    for path in old.keys() - {''}:
        if old[path] == new[path]:
            continue
        x, y = dict(old[path]), dict(new[path])
        previous, version = x.pop('version', ''), y.pop('version', '')
        patch(previous, version)
        name = path.rsplit('node_modules/', 1)[-1]
        expected_url = f"https://registry.npmjs.org/{name}/-/{name.rsplit('/', 1)[-1]}-{version}.tgz"
        resolved, integrity = y.get('resolved', ''), y.get('integrity', '')
        require(resolved == expected_url and re.fullmatch(r'sha512-[A-Za-z0-9+/]+=*', integrity) and integrity != x.get('integrity'), 'untrusted or repackaged artifact')
        for field in ('resolved', 'integrity'):
            x.pop(field, None)
            y.pop(field, None)
        require(x == y, 'package metadata or engine requirements changed')
        changed += 1
    require(changed > 0, 'no resolved package was patched')




def signed_metadata(commit_message, pr, repo):
    # Parse only the narrow, signed Dependabot footer, never arbitrary YAML.
    # Patch-only is independently checked against EVERY resolved version below.
    require(len(commit_message) <= 128000, 'oversized bot metadata')
    lines = commit_message.splitlines()
    require(lines.count('---') == 1 and lines.count('...') == 1, 'unknown bot metadata format')
    start, end = lines.index('---'), lines.index('...')
    require(start < end and lines[start + 1] == 'updated-dependencies:', 'missing dependency metadata')
    records = []
    for line in lines[start + 2:end]:
        if line.startswith('- dependency-name: '):
            records.append({})
        else:
            require(records and line.startswith('  ') and ': ' in line, 'unknown metadata structure')
            key, value = line[2:].split(': ', 1)
            require(key in {'dependency-version', 'dependency-type', 'dependency-group', 'update-type'} and key not in records[-1], 'unknown or duplicate metadata field')
            records[-1][key] = value
    require(records and all(r.get('dependency-group') == 'security-patches' and r.get('update-type', 'version-update:semver-patch') == 'version-update:semver-patch' for r in records), 'not exclusively security patches')
    prefix = REPOSITORIES[repo]
    require(pr['head']['ref'].startswith('dependabot/npm_and_yarn/' + prefix + 'security-patches-'), 'unexpected bot branch')
    return {'group': 'security-patches', 'update_type': 'version-update:semver-patch', 'ecosystem': 'npm_and_yarn', 'directory': '/' + prefix.rstrip('/')}


def active_protection(rules):
    require(isinstance(rules, list) and 0 < len(rules) < 100, 'active rules missing or incomplete')
    statuses = [r['parameters'] for r in rules if r['type'] == 'required_status_checks']
    reviews = [r['parameters'] for r in rules if r['type'] == 'pull_request']
    require(statuses and reviews, 'active status and PR rules are required')
    require(all(p.get('strict_required_status_checks_policy') is True for p in statuses), 'strict checks are required')
    checks = [check for params in statuses for check in params['required_status_checks']]
    require(checks and all(c.get('integration_id') == 15368 for c in checks), 'checks must be bound to GitHub Actions')
    return {
        'activeRulesVerified': True,
        'requiresStatusChecks': True,
        'requiresStrictStatusChecks': True,
        'requiresApprovingReviews': any(p.get('required_approving_review_count', 1) != 0 or p.get('require_code_owner_review', True) is not False or p.get('require_last_push_approval', True) is not False for p in reviews),
        'requiredStatusCheckContexts': [c['context'] for c in checks],
    }



class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise Ineligible('unexpected HTTP redirect')


def verified_protection(repo):
    rules = api(f'repos/{repo}/rules/branches/main?per_page=100')
    protection = active_protection(rules)
    ids = {r.get('ruleset_id') for r in rules}
    require(ids and all(isinstance(i, int) and i > 0 for i in ids), 'ruleset identity missing')
    for identity in ids:
        details = api(f'repos/{repo}/rulesets/{identity}')
        require(details.get('enforcement') == 'active' and details.get('current_user_can_bypass') == 'never', 'merge token can bypass rules or bypass state is unknown')
    return protection


def publisher_identity(metadata):
    user = metadata.get('_npmUser')
    require(isinstance(user, dict) and isinstance(user.get('name'), str) and user['name'], 'unknown npm publisher')
    trusted = user.get('trustedPublisher')
    require(user['name'] != 'GitHub Actions' or isinstance(trusted, dict) and trusted, 'unknown trusted publisher configuration')
    return user['name'], json.dumps(trusted, sort_keys=True)


def publisher(name, version):
    # Registry requests deliberately receive NO GitHub Authorization header.
    encoded = urllib.parse.quote(name, safe='')
    request = urllib.request.Request(f'https://registry.npmjs.org/{encoded}/{version}', headers={'Accept': 'application/json'})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
        body = response.read(2 * 1024 * 1024 + 1)
    require(len(body) <= 2 * 1024 * 1024, 'oversized registry metadata')
    metadata = json.loads(body)
    require(metadata.get('name') == name and metadata.get('version') == version, 'registry identity mismatch')
    return publisher_identity(metadata)


def verify_publishers(before, after):
    changes = {(path.rsplit('node_modules/', 1)[-1], before['packages'][path]['version'], entry['version']) for path, entry in after['packages'].items() if path and before['packages'][path].get('version') != entry.get('version')}
    require(0 < len(changes) <= 25, 'too many publisher identities for automatic review')
    for name, old, new in sorted(changes):
        require(publisher(name, old) == publisher(name, new), 'npm publisher changed; manual review required')


def api(path, body=None, method=None):
    url = path if path.startswith('https://api.github.com/') else 'https://api.github.com/' + path
    request = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), headers={
        'Authorization': 'Bearer ' + os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'cerna-security-patch-policy'}, method=method or (None if body is None else 'POST'))
    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
        return json.load(response)


def content(repo, path, sha):
    item = api(f'repos/{repo}/contents/{path}?ref={sha}')
    require(item.get('encoding') == 'base64', 'unsupported file encoding')
    return json.loads(base64.b64decode(item['content']).decode('utf-8'))


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--merge', action='store_true')
    args = args.parse_args()
    repo = os.environ['GITHUB_REPOSITORY']
    require(repo in REPOSITORIES, 'repository not allowed')
    with open(os.environ['GITHUB_EVENT_PATH'], encoding='utf-8') as source:
        event = json.load(source)
    if 'pull_request' in event:
        expected = event['pull_request']['head']['sha']
        number = event['pull_request']['number']
    else:
        run = event['workflow_run']
        require(run['event'] == 'pull_request' and run['conclusion'] == 'success' and run['head_repository']['full_name'] == repo, 'not a successful same-repository PR workflow')
        expected = run['head_sha']
        candidates = run.get('pull_requests') or []
        require(len(candidates) == 1, 'cannot identify one checked PR')
        number = candidates[0]['number']
    pr = api(f'repos/{repo}/pulls/{number}')
    require(pr['head']['sha'] == expected, 'PR head changed')
    require(pr['user']['id'] == 49699333 and pr['user']['login'] == 'dependabot[bot]', 'not Dependabot')
    commits = api(f'repos/{repo}/pulls/{number}/commits?per_page=100')
    require(len(commits) == 1 and commits[0]['sha'] == expected and commits[0].get('author', {}).get('id') == 49699333 and commits[0].get('committer', {}).get('id') in {49699333, 19864447} and commits[0]['commit'].get('verification', {}).get('verified') is True and commits[0]['commit']['verification'].get('reason') == 'valid', 'unverified or mixed PR commits')
    metadata = signed_metadata(commits[0]['commit']['message'], pr, repo)
    files = api(f'repos/{repo}/pulls/{number}/files?per_page=100')
    repository = api(f'repos/{repo}')
    require(repository['default_branch'] == 'main', 'default branch changed')
    # This endpoint requires metadata:read, unlike administration-only classic
    # protection reads. It returns only active rules that apply to main.
    protection = verified_protection(repo)
    prefix = REPOSITORIES[repo]
    manifests = [content(repo, prefix + filename, sha) for filename in ('package.json', 'package-lock.json') for sha in (pr['base']['sha'], expected)]
    eligible(repo, pr, metadata, files, protection, manifests[0], manifests[1], manifests[2], manifests[3])
    verify_publishers(manifests[2], manifests[3])
    if not args.merge:
        print('Eligible security patch; check-only mode, no merge attempted')
        return
    required = set(protection['requiredStatusCheckContexts']) | CHECKS
    deadline = time.monotonic() + 25 * 60
    while time.monotonic() < deadline:
        current = api(f'repos/{repo}/pulls/{number}')
        require(current['head']['sha'] == expected and current['state'] == 'open' and not current['draft'], 'PR changed while waiting')
        runs = api(f'repos/{repo}/commits/{expected}/check-runs?per_page=100')
        require(runs['total_count'] <= 100, 'too many check runs to verify')
        latest = {}
        for run in sorted(runs['check_runs'], key=lambda r: r['id']):
            if run.get('app', {}).get('slug') == 'github-actions' and run['head_sha'] == expected:
                latest[run['name']] = run
        for name in required:
            run = latest.get(name)
            require(not run or run['status'] != 'completed' or run['conclusion'] == 'success', 'required check failed: ' + name)
        if all(name in latest and latest[name]['status'] == 'completed' and latest[name]['conclusion'] == 'success' for name in required) and current.get('mergeable') is True:
            tip = api(f'repos/{repo}/branches/main')['commit']['sha']
            comparison = api(f"repos/{repo}/compare/{tip}...{expected}")
            require(comparison['behind_by'] == 0 and comparison['merge_base_commit']['sha'] == tip, 'PR is behind main; rebase and retry')
            require(verified_protection(repo) == protection, 'branch rules changed; retry verification')
            # Immediate protected merge, never queue a request across later pushes.
            merged = api(f'repos/{repo}/pulls/{number}/merge', {'sha': expected, 'merge_method': 'squash'}, method='PUT')
            require(merged.get('merged') is True, 'GitHub declined the protected merge')
            print('Merged the verified security-patch head through branch protection')
            return
        time.sleep(15)
    raise Ineligible('required checks did not finish in the allowed time')


if __name__ == '__main__':
    try:
        main()
    except Ineligible as error:
        print('Not eligible for automatic merging:', error)
        raise SystemExit(0)
