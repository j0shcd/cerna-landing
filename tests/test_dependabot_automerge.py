"""Adversarial fixtures for the policy used by the privileged merge job."""
import copy
import importlib.util
from pathlib import Path
import unittest

path = Path(__file__).resolve().parents[1] / 'scripts/dependabot_automerge.py'
spec = importlib.util.spec_from_file_location('merge_policy', path)
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


def fixture(repo='j0shcd/cerna-app'):
    prefix = policy.REPOSITORIES[repo]
    pr = {'state': 'open', 'draft': False, 'user': {'login': 'dependabot[bot]', 'id': 49699333}, 'base': {'ref': 'main', 'repo': {'full_name': repo}}, 'head': {'repo': {'full_name': repo}}, 'changed_files': 2, 'commits': 1}
    meta = {'group': 'security-patches', 'update_type': 'version-update:semver-patch', 'ecosystem': 'npm_and_yarn', 'directory': '/' + prefix.rstrip('/')}
    files = [{'filename': prefix + x, 'status': 'modified'} for x in ['package.json', 'package-lock.json']]
    rule = {'requiresStatusChecks': True, 'requiresStrictStatusChecks': True, 'activeRulesVerified': True, 'requiresApprovingReviews': False, 'requiredStatusCheckContexts': list(policy.CHECKS)}
    before = {'name': 'fixture', 'scripts': {'test': 'test'}, 'dependencies': {'example': '^1.2.3'}}
    after = copy.deepcopy(before); after['dependencies']['example'] = '^1.2.4'
    lock = {'name': 'fixture', 'lockfileVersion': 3, 'packages': {'': copy.deepcopy(before), 'node_modules/example': {'version': '1.2.3', 'resolved': 'https://registry.npmjs.org/example/-/example-1.2.3.tgz', 'integrity': 'sha512-AAAA'}}}
    updated = copy.deepcopy(lock); updated['packages'][''] = copy.deepcopy(after); updated['packages']['node_modules/example'].update(version='1.2.4', resolved='https://registry.npmjs.org/example/-/example-1.2.4.tgz', integrity='sha512-BBBB')
    return [repo, pr, meta, files, rule, before, after, lock, updated]


class PolicyTests(unittest.TestCase):
    def test_patch_security_group_in_both_repos(self):
        for repo in policy.REPOSITORIES:
            with self.subTest(repo=repo):
                policy.eligible(*fixture(repo))

    def test_lock_only_security_update(self):
        args = fixture(); args[3] = args[3][1:]; args[1]['changed_files'] = 1
        args[6] = copy.deepcopy(args[5]); args[8]['packages'][''] = copy.deepcopy(args[5])
        policy.eligible(*args)

    def test_rejects_untrusted_or_incomplete_policy(self):
        changes = [
            lambda a: a[1]['user'].update(login='someone'),
            lambda a: a[1]['user'].update(id=1),
            lambda a: a[1].update(draft=True),
            lambda a: a[1].update(commits=2),
            lambda a: a[1].update(state='closed'),
            lambda a: a[1]['base'].update(ref='other'),
            lambda a: a[1]['head']['repo'].update(full_name='attacker/fork'),
            lambda a: a[2].update(group='routine-patches'),
            lambda a: a[2].update(update_type='version-update:semver-minor'),
            lambda a: a[2].update(update_type='version-update:semver-major'),
            lambda a: a[2].update(ecosystem='conda'),
            lambda a: a[2].update(directory='/other'),
            lambda a: a[2].pop('group'),
            lambda a: a[2].pop('update_type'),
            lambda a: a[3][0].update(filename='.github/workflows/evil.yml'),
            lambda a: a[3][0].update(filename='frontend/src/evil.js'),
            lambda a: a[3][0].update(status='renamed'),
            lambda a: a[1].update(changed_files=3),
            lambda a: a[4].update(requiresStatusChecks=False),
            lambda a: a[4].update(requiresStrictStatusChecks=False),
            lambda a: a[4].update(activeRulesVerified=False),
            lambda a: a[4].update(requiresApprovingReviews=True),
            lambda a: a[4].update(requiredStatusCheckContexts=['Dependency security audit']),
            lambda a: a[6]['scripts'].update(test='exfiltrate'),
            lambda a: a[6]['dependencies'].update(example='^1.3.0'),
            lambda a: a[6]['dependencies'].update(example='~1.2.4'),
            lambda a: a[6]['dependencies'].update(extra='1.0.0'),
            lambda a: a[8]['packages']['node_modules/example'].update(version='2.0.0'),
            lambda a: a[8]['packages']['node_modules/example'].update(version='1.2.2'),
            lambda a: a[8]['packages']['node_modules/example'].update(version='1.2.4-beta'),
            lambda a: a[8]['packages']['node_modules/example'].update(version='1.2.3'),
            lambda a: a[8]['packages']['node_modules/example'].update(resolved='https://evil.test/package.tgz'),
            lambda a: a[8]['packages']['node_modules/example'].update(integrity='sha1-AAAA'),
            lambda a: a[8]['packages']['node_modules/example'].update(integrity='sha512-AAAA'),
            lambda a: a[8]['packages']['node_modules/example'].update(resolved='https://registry.npmjs.org/other/-/other-1.2.4.tgz'),
            lambda a: a[8]['packages']['node_modules/example'].update(engines={'node': '>=99'}),
            lambda a: a[8]['packages'].update({'node_modules/extra': {'version': '1.0.0'}}),
            lambda a: a[8].update(lockfileVersion=2),
        ]
        for index, change in enumerate(changes):
            with self.subTest(case=index):
                args = fixture(); change(args)
                with self.assertRaises(policy.Ineligible):
                    policy.eligible(*args)

    def test_unreadable_branch_protection_is_rejected(self):
        args = fixture(); args[4] = None
        with self.assertRaises(policy.Ineligible):
            policy.eligible(*args)

class MergeLifecycleTests(unittest.TestCase):
    def exercise(self, *, move=False, fail=False, spoof=False, missing=False, check_only=False, unverified=False, workflow_run=False, wrong_committer=False, wrong_check_head=False, pending=False, behind=False, native_validation_only=False, bypass=False, bypass_after=False, new_main=False, missing_native=False):
        import contextlib
        import io
        import json
        import os
        import tempfile
        from unittest import mock
        args = fixture()
        repo, pr, metadata, files, rule, old, new, lock, updated = args
        sha = 'a' * 40
        pr.update(number=7, mergeable=True, mergeable_state='unstable')
        pr['base']['sha'] = 'b' * 40
        pr['head']['sha'] = sha
        pr['head']['ref'] = 'dependabot/npm_and_yarn/frontend/security-patches-1234'
        current = copy.deepcopy(pr)
        if move:
            current['head']['sha'] = 'c' * 40
        checks = [{'id': i, 'name': name, 'app': {'slug': 'someone' if spoof else 'github-actions'}, 'head_sha': sha, 'status': 'completed', 'conclusion': 'failure' if fail else 'success'} for i, name in enumerate(policy.CHECKS)]
        if wrong_check_head:
            for check in checks: check['head_sha'] = 'c' * 40
        if pending:
            for check in checks: check.update(status='in_progress', conclusion=None)
        if missing:
            checks = checks[:1]
        writes = []
        pr_reads = []
        rule_reads = []
        def api(path, body=None, method=None):
            if method == 'PUT':
                writes.append((path, body))
                return {'merged': True, 'sha': 'd' * 40}
            if path.endswith('/pulls/7'):
                pr_reads.append(path)
                return pr if len(pr_reads) == 1 else current
            if '/commits?per_page=' in path:
                return [{'sha': sha, 'author': {'id': 49699333}, 'committer': {'id': 1 if wrong_committer else 19864447}, 'commit': {'message': 'Patch\n\n---\nupdated-dependencies:\n- dependency-name: example\n  dependency-group: security-patches\n...\n', 'verification': {'verified': not unverified, 'reason': 'valid'}}}]
            if '/files?' in path:
                return files
            if path == 'repos/' + repo:
                return {'default_branch': 'main'}
            if '/rules/branches/main?' in path:
                return [{'ruleset_id': 42, 'type': 'required_status_checks', 'parameters': {'strict_required_status_checks_policy': True, 'required_status_checks': [{'context': name, 'integration_id': 15368} for name in (['Dependency validation'] if native_validation_only else policy.CHECKS)]}}, {'ruleset_id': 42, 'type': 'pull_request', 'parameters': {'required_approving_review_count': 0, 'require_code_owner_review': False, 'require_last_push_approval': False}}]
            if path.endswith('/rulesets/42'):
                rule_reads.append(path)
                return {'enforcement': 'active', 'current_user_can_bypass': 'always' if bypass or bypass_after and len(rule_reads) > 1 else 'never'}
            if path.endswith('/branches/main'):
                return {'commit': {'sha': 'e' * 40 if new_main else pr['base']['sha']}}
            if '/compare/' in path:
                return {'behind_by': 1 if behind else 0, 'merge_base_commit': {'sha': pr['base']['sha']}}
            if '/check-runs?' in path:
                return {'total_count': len(checks), 'check_runs': checks}
            raise AssertionError(path)
        with tempfile.TemporaryDirectory() as tmp:
            event = Path(tmp) / 'event.json'; event.write_text(json.dumps({'workflow_run': {'event': 'pull_request', 'conclusion': 'success', 'head_repository': {'full_name': repo}, 'head_sha': sha, 'pull_requests': [{'number': 7}]}} if workflow_run else {'pull_request': pr}))
            with mock.patch.dict(os.environ, {'GITHUB_REPOSITORY': repo, 'GITHUB_EVENT_PATH': str(event), 'IGNORED_TEST_VALUE': 'unused'}), mock.patch('sys.argv', ['policy'] + ([] if check_only else ['--merge'])), mock.patch.object(policy, 'api', side_effect=api), mock.patch.object(policy, 'content', side_effect=[old, new, lock, updated]), mock.patch.object(policy, 'publisher', return_value=('stable-publisher', 'null')), mock.patch.object(policy, 'require_full_app_audit', side_effect=policy.Ineligible('missing native coverage') if missing_native else None), mock.patch.object(policy.time, 'monotonic', side_effect=[0, 0, 1501]), mock.patch.object(policy.time, 'sleep'), contextlib.redirect_stdout(io.StringIO()):
                try:
                    policy.main()
                except Exception:
                    self.assertEqual(writes, [])
                    raise
        return writes

    def test_only_verified_successful_head_is_sent_to_merge_api(self):
        writes = self.exercise()
        self.assertEqual(writes, [('repos/j0shcd/cerna-app/pulls/7/merge', {'sha': 'a' * 40, 'merge_method': 'squash'})])

    def test_completion_event_retries_the_same_verified_head(self):
        self.assertEqual(len(self.exercise(workflow_run=True)), 1)

    def test_guard_still_requires_audit_when_native_rule_only_requires_validation(self):
        self.assertEqual(len(self.exercise(native_validation_only=True)), 1)
        with self.assertRaises(policy.Ineligible):
            self.exercise(native_validation_only=True, missing=True)

    def test_check_only_never_merges(self):
        self.assertEqual(self.exercise(check_only=True), [])

    def test_changed_head_failed_checks_missing_checks_and_spoofed_checks_never_merge(self):
        for options in [{'move': True}, {'fail': True}, {'spoof': True}, {'missing': True}, {'unverified': True}, {'wrong_committer': True}, {'wrong_check_head': True}, {'pending': True}, {'behind': True}, {'bypass': True}, {'bypass_after': True}, {'new_main': True}, {'missing_native': True}]:
            with self.subTest(options=options), self.assertRaises(policy.Ineligible):
                self.exercise(**options)

class MetadataAndRuleTests(unittest.TestCase):
    def test_signed_footer_in_each_expected_security_branch(self):
        message = 'Patch\n\n---\nupdated-dependencies:\n- dependency-name: "@scope/package"\n  dependency-version: 1.2.4\n  dependency-group: security-patches\n...\n'
        for repo, prefix in policy.REPOSITORIES.items():
            pr = {'head': {'ref': 'dependabot/npm_and_yarn/' + prefix + 'security-patches-1234'}}
            self.assertEqual(policy.signed_metadata(message, pr, repo)['group'], 'security-patches')
        for bad in [message.replace('security-patches', 'routine'), message.replace('  dependency-group: security-patches\n', ''), message.replace('...\n', ''), message + '\n---\n', message.replace('...\n', '  dependency-group: security-patches\n...\n'), message.replace('...\n', '  update-type: version-update:semver-minor\n...\n')]:
            with self.subTest(message=bad), self.assertRaises(policy.Ineligible):
                policy.signed_metadata(bad, {'head': {'ref': 'dependabot/npm_and_yarn/frontend/security-patches-1234'}}, 'j0shcd/cerna-app')

    def test_effective_active_rules_require_strict_github_actions_and_a_pr_rule(self):
        rules = [{'ruleset_id': 42, 'type': 'required_status_checks', 'parameters': {'strict_required_status_checks_policy': True, 'required_status_checks': [{'context': 'Dependency validation', 'integration_id': 15368}]}}, {'ruleset_id': 42, 'type': 'pull_request', 'parameters': {'required_approving_review_count': 0, 'require_code_owner_review': False, 'require_last_push_approval': False}}]
        normalized = policy.active_protection(rules)
        self.assertTrue(normalized['activeRulesVerified'])
        self.assertEqual(normalized['requiredStatusCheckContexts'], ['Dependency validation'])
        invalid = [[], rules[:1]]
        altered = copy.deepcopy(rules); altered[0]['parameters']['strict_required_status_checks_policy'] = False; invalid.append(altered)
        altered = copy.deepcopy(rules); altered[0]['parameters']['required_status_checks'][0]['integration_id'] = None; invalid.append(altered)
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(policy.Ineligible):
                policy.active_protection(value)

    def test_native_validation_without_required_audit_does_not_lock_human_repairs(self):
        args = fixture(); args[4]['requiredStatusCheckContexts'] = ['Dependency validation']
        policy.eligible(*args)

class PublisherTests(unittest.TestCase):
    def test_unknown_or_changed_publishers_require_review(self):
        from unittest import mock
        args = fixture()
        for metadata in [{}, {'_npmUser': {}}, {'_npmUser': {'name': 'GitHub Actions'}}]:
            with self.subTest(metadata=metadata), self.assertRaises(policy.Ineligible):
                policy.publisher_identity(metadata)
        with mock.patch.object(policy, 'publisher', side_effect=[('old', 'null'), ('new', 'null')]), self.assertRaises(policy.Ineligible):
            policy.verify_publishers(args[7], args[8])
        trusted = {'_npmUser': {'name': 'GitHub Actions', 'trustedPublisher': {'id': 'github', 'oidcConfigId': 'one'}}}
        changed = copy.deepcopy(trusted); changed['_npmUser']['trustedPublisher']['oidcConfigId'] = 'two'
        self.assertNotEqual(policy.publisher_identity(trusted), policy.publisher_identity(changed))

    def test_registry_requests_never_receive_the_github_token(self):
        import io
        import json
        from unittest import mock
        payload = {'name': '@scope/example', 'version': '1.2.4', '_npmUser': {'name': 'stable'}}
        class Opener:
            def open(self, request, **kwargs):
                self_request = request
                assert not self_request.has_header('Authorization')
                assert self_request.full_url == 'https://registry.npmjs.org/%40scope%2Fexample/1.2.4'
                return io.BytesIO(json.dumps(payload).encode())
        with mock.patch.object(policy.urllib.request, 'build_opener', return_value=Opener()):
            self.assertEqual(policy.publisher('@scope/example', '1.2.4'), ('stable', 'null'))

    def test_redirects_are_rejected(self):
        with self.assertRaises(policy.Ineligible):
            policy.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://elsewhere.test')


class NativeCoverageTests(unittest.TestCase):
    def test_npm_only_workflow_cannot_authorize_app_merge(self):
        from unittest import mock
        with mock.patch.object(policy, 'file_text', return_value='        run: npm audit\n'), self.assertRaises(policy.Ineligible):
            policy.require_full_app_audit('j0shcd/cerna-app', 'a' * 40)

    def test_full_workflow_needs_native_inventory(self):
        from unittest import mock
        workflow = '        run: python -S scripts/security_audit.py | tee security-report.json\n'
        with mock.patch.object(policy, 'file_text', return_value=workflow), mock.patch.object(policy, 'content', return_value={}), self.assertRaises(policy.Ineligible):
            policy.require_full_app_audit('j0shcd/cerna-app', 'a' * 40)
        with mock.patch.object(policy, 'file_text', return_value=workflow), mock.patch.object(policy, 'content', return_value={'distributions': [{}], 'conda_packages': [{}], 'environment_sha256': 'a' * 64}):
            policy.require_full_app_audit('j0shcd/cerna-app', 'a' * 40)



if __name__ == '__main__':
    unittest.main()
