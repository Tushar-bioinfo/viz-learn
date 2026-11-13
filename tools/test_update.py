import tempfile
import unittest
import json
import subprocess
from pathlib import Path
from unittest.mock import patch
import update
import update_harnesses as harnesses


class AuditTests(unittest.TestCase):
    def test_exact_missing_changed_extra_and_transient(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill = root / 'skills/deck'
            skill.mkdir(parents=True)
            (skill / 'SKILL.md').write_bytes(b'original')
            expected = {'skills/deck/SKILL.md': b'original'}
            self.assertEqual(update.compare_skills(expected, root), ([], [], []))
            (skill / 'SKILL.md').write_bytes(b'changed')
            (skill / 'extra').write_text('x')
            (skill / '.DS_Store').write_text('x')
            missing, extra, changed = update.compare_skills(expected, root)
            self.assertEqual((missing, extra, changed), ([], ['skills/deck/extra'], ['skills/deck/SKILL.md']))
            (skill / 'SKILL.md').unlink()
            self.assertEqual(update.compare_skills(expected, root)[0], ['skills/deck/SKILL.md'])

    def test_symlink_is_not_followed_as_a_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'skills').mkdir()
            (root / 'skills/x').symlink_to('/etc/passwd')
            self.assertEqual(update.compare_skills({'skills/x': b'x'}, root)[2], ['skills/x'])

    def test_dirty_input_blocks_checks(self):
        with patch.object(update, 'dirty_inputs', return_value='?? tools/new.py'):
            with self.assertRaisesRegex(RuntimeError, 'release inputs'):
                update.check('HEAD')

    def test_publish_requires_explicit_reviewed_base(self):
        with patch('sys.argv', ['update.py', 'publish']):
            self.assertEqual(update.main(), 1)

    def test_runner_does_not_use_shell(self):
        with patch.object(update.subprocess, 'run') as run:
            update.run(['git', 'status'])
            self.assertNotIn('shell', run.call_args.kwargs)
            self.assertEqual(run.call_args.args[0], ['git', 'status'])

    def test_extra_push_destination_is_rejected(self):
        responses = [subprocess.CompletedProcess([], 0, update.REMOTE + '\n'),
                     subprocess.CompletedProcess([], 0, update.REMOTE + '\nhttps://example.invalid/other\n')]
        with patch.object(update, 'run', side_effect=responses):
            with self.assertRaisesRegex(RuntimeError, 'single expected'):
                update.check_remote()

    def test_bare_invocation_only_runs_read_only_status(self):
        with patch('sys.argv', ['update.py']), patch.object(update, 'status') as status, \
             patch.object(update, 'publish') as publish:
            self.assertEqual(update.main(), 0)
            status.assert_called_once_with('HEAD', False)
            publish.assert_not_called()

    def test_user_wide_lock_blocks_overlapping_mutations(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            path = home / '.cache/viz-os-update/update.lock'
            path.parent.mkdir(parents=True)
            with path.open('w') as held:
                update.fcntl.flock(held, update.fcntl.LOCK_EX | update.fcntl.LOCK_NB)
                with patch.object(update.Path, 'home', return_value=home), \
                     patch.object(update, 'OUT', home / 'out'), patch('sys.argv', ['update.py', 'check']), \
                     patch.object(update, 'check') as check:
                    self.assertEqual(update.main(), 1)
                    check.assert_not_called()


class ReleaseTests(unittest.TestCase):
    """Real Git archives and pushes, confined to a temporary local bare repository."""
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'source'
        self.root.mkdir()
        for attr, value in [('ROOT', self.root), ('OUT', self.root / 'out/update')]:
            p = patch.object(update, attr, value)
            p.start(); self.addCleanup(p.stop)
        p = patch.object(update, 'environment', return_value={'environment': 'fixture-v1'})
        self.environment = p.start(); self.addCleanup(p.stop)
        p = patch.object(update, 'check_remote')  # Only this fixture permits the local bare remote.
        p.start(); self.addCleanup(p.stop)
        self.call('init', '-b', 'main')
        self.call('config', 'user.email', 'fixture@example.invalid')
        self.call('config', 'user.name', 'Fixture')
        self.write('.gitignore', 'out/\n')
        self.write('tools/test_update.py', 'import unittest\nclass Fixture(unittest.TestCase):\n def test_ok(self): self.assertTrue(True)\n')
        self.write('tools/check-all.sh', '\n'.join('echo "' + s + '"' for s in (
            'board ui tests: 1/1 ok', 'rgb tests: 1/1 ok', 'class cases: 1/1 ok',
            'memory tests: 1/1 ok', 'tidy tests: 1/1 ok', 'doc tests: 1/1 ok',
            'sketch tests: 1/1 ok', 'manifests: OK')) + '\n')
        self.version('4.0.0')
        for name in ('class', 'deck', 'sketch'):
            self.write(f'plugins/viz-os/skills/{name}/SKILL.md', 'fixture skill')
        self.base = self.commit('base')
        remote = Path(self.temp.name) / 'remote.git'
        subprocess.run(['git', 'init', '--bare', str(remote)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.call('remote', 'add', 'origin', str(remote))
        self.call('push', 'origin', 'HEAD:main')
        # A tiny validator executable; no real harness or model is launched.
        executable = Path(self.temp.name) / 'validator'
        executable.write_text('#!/bin/sh\nprintf "valid fixture\\n"\n')
        executable.chmod(0o755)
        p = patch.object(update, 'VALIDATORS', tuple((str(executable), str(n)) for n in range(5)))
        p.start(); self.addCleanup(p.stop)

    def call(self, *argv):
        return subprocess.check_output(['git', *argv], cwd=self.root, stderr=subprocess.DEVNULL, text=True).strip()

    def write(self, rel, text):
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def version(self, version):
        self.write('plugins/viz-os/.claude-plugin/plugin.json', json.dumps({'name': 'viz-os', 'version': version}))
        self.write('plugins/viz-os/CHANGELOG.md', '## ' + version + '\nfixture release\n')

    def commit(self, message):
        self.call('add', '.')
        self.call('commit', '-m', message)
        return self.call('rev-parse', 'HEAD')

    def next_release(self):
        self.version('4.0.1')
        return self.commit('next release')

    def review(self, sha):
        evidence = self.root / 'out/review.txt'
        evidence.parent.mkdir(exist_ok=True)
        evidence.write_text('Independent fixture review')
        spec = self.root / 'out/evidence.json'
        spec.write_text(json.dumps({'candidate': sha, 'base': self.base,
            **{g: str(evidence) for g in update.gates(self.base, sha)}}))
        update.review(sha, self.base, spec)

    def test_check_archive_receipt_reuse_and_environment_change(self):
        self.assertEqual(update.check(self.base), 0)
        log = update.OUT / (self.base + '.log')
        stamp = log.stat().st_mtime_ns
        self.assertEqual(update.check(self.base), 0)
        self.assertEqual(log.stat().st_mtime_ns, stamp)
        self.assertFalse(update.validated(self.base, {'environment': 'fixture-v2'}))
        log.write_text('tampered')
        self.assertFalse(update.validated(self.base, self.environment()))

    def test_untracked_release_input_blocks_but_unrelated_edit_does_not(self):
        self.write('AGENTS.md', 'unrelated work')
        self.assertEqual(update.check(self.base), 0)
        self.write('tools/untracked.py', 'never committed')
        with self.assertRaisesRegex(RuntimeError, 'release inputs'):
            update.check(self.base)

    def test_changed_candidate_cannot_reuse_receipt(self):
        self.assertEqual(update.check(self.base), 0)
        sha = self.next_release()
        self.assertFalse(update.validated(sha, self.environment()))
        with self.assertRaisesRegex(RuntimeError, 'matching successful checks'):
            update.publish(sha, self.base)
        self.assertEqual(update.remote_main(), self.base)

    def test_failed_regression_and_warning_do_not_authorize_push(self):
        self.write('tools/check-all.sh', 'echo "1 warnings"\nexit 1\n')
        sha = self.commit('broken check')
        self.assertEqual(update.check(sha), 1)
        self.assertFalse(update.validated(sha, self.environment()))
        with self.assertRaisesRegex(RuntimeError, 'matching successful checks'):
            update.publish(sha, self.base)

    def test_zero_exit_nonzero_warnings_and_incomplete_output_fail(self):
        self.write('tools/check-all.sh', (self.root / 'tools/check-all.sh').read_text() + 'echo "1 warnings"\n')
        sha = self.commit('warning')
        self.assertEqual(update.check(sha), 1)
        self.write('tools/check-all.sh', 'echo "looks fine"\n')
        sha = self.commit('truncated check')
        self.assertEqual(update.check(sha), 1)

    def test_successful_reviewed_push_and_repeat_are_idempotent(self):
        sha = self.next_release()
        self.assertEqual(update.check(sha), 0)
        self.review(sha)
        self.assertEqual(update.publish(sha, self.base), 0)
        self.assertEqual(update.remote_main(), sha)
        self.assertEqual(update.publish(sha, sha), 0)

    def test_reused_version_is_blocked(self):
        self.write('plugins/viz-os/skills/deck/SKILL.md', 'changed')
        sha = self.commit('no version bump')
        with self.assertRaisesRegex(RuntimeError, 'advanced semantic version'):
            update.publish(sha, self.base)

    def test_remote_race_and_divergent_candidate_block(self):
        sha = self.next_release()
        with patch.object(update, 'fetch_main', return_value='0' * 40):
            with self.assertRaisesRegex(RuntimeError, 'reviewed base'):
                update.publish(sha, self.base)
        self.call('checkout', '--orphan', 'unrelated')
        self.write('tools/other', 'x')
        unrelated = self.commit('unrelated root')
        with self.assertRaisesRegex(RuntimeError, 'diverges'):
            update.publish(unrelated, self.base)

    def test_changed_review_evidence_blocks(self):
        sha = self.next_release()
        self.review(sha)
        update.reviewed(sha, self.base)
        (self.root / 'out/review.txt').write_text('changed after judgment')
        with self.assertRaisesRegex(RuntimeError, 'changed review evidence'):
            update.reviewed(sha, self.base)

    def test_install_requires_exact_published_candidate(self):
        sha = self.next_release()
        with self.assertRaisesRegex(RuntimeError, 'published origin/main'):
            harnesses.install(sha)

    def test_missing_validator_cannot_pass(self):
        with patch.object(update, 'VALIDATORS', (('/does-not-exist/fixture-validator',),)):
            self.assertEqual(update.check(self.base), 1)
            self.assertFalse(update.validated(self.base, self.environment()))

    def test_skill_instruction_change_requires_cold_start_review(self):
        self.version('4.0.1')
        self.write('plugins/viz-os/skills/class/SKILL.md', 'new instruction')
        sha = self.commit('instruction change')
        self.assertIn('cold_start', update.gates(self.base, sha))
        self.write('plugins/viz-os/skills/class/kit/board.js', 'new rendering')
        sha = self.commit('rendering change')
        self.assertTrue({'numbers', 'eyes'}.issubset(update.gates(self.base, sha)))

    def test_prepare_synchronizes_five_manifests_without_touching_source(self):
        for rel in ('.codex-plugin/plugin.json', '.cursor-plugin/plugin.json', 'plugin.json', 'gemini-extension.json'):
            self.write('plugins/viz-os/' + rel, json.dumps({'name': 'viz-os', 'version': '4.0.0'}))
        notes = self.root / 'out/notes.md'
        notes.parent.mkdir(exist_ok=True)
        notes.write_text('Learner-facing release changes.')
        update.prepare('4.0.1', notes)
        for p in (self.root / 'plugins/viz-os').rglob('*.json'):
            self.assertEqual(json.loads(p.read_text())['version'], '4.0.1')
        self.assertIn('## 4.0.1', (self.root / 'plugins/viz-os/CHANGELOG.md').read_text())
        self.assertEqual((self.root / 'plugins/viz-os/skills/class/SKILL.md').read_text(), 'fixture skill')
        with self.assertRaisesRegex(RuntimeError, 'newer'):
            update.prepare('4.0.1', notes)

    def test_linked_clone_does_not_advance_if_remote_changed_past_candidate(self):
        home = Path(self.temp.name) / 'home'
        clone = home / '.local/share/viz-learn'
        clone.parent.mkdir(parents=True)
        remote = Path(self.temp.name) / 'remote.git'
        subprocess.run(['git', 'clone', '--branch', 'main', str(remote), str(clone)], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.next_release()
        self.call('push', 'origin', 'HEAD:main')
        log = self.root / 'out/install.log'
        log.parent.mkdir(exist_ok=True)
        with patch.object(harnesses, 'HOME', home):
            with self.assertRaisesRegex(RuntimeError, 'no merge attempted'):
                harnesses.source_clone(self.base, log)
        actual = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=clone, text=True).strip()
        self.assertEqual(actual, self.base)

    def test_dirty_release_clone_is_preserved(self):
        home = Path(self.temp.name) / 'home'
        clone = home / '.local/share/viz-learn'
        clone.parent.mkdir(parents=True)
        subprocess.run(['git', 'clone', '--branch', 'main', str(Path(self.temp.name) / 'remote.git'), str(clone)],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        (clone / 'user-work.txt').write_text('preserve me')
        with patch.object(harnesses, 'HOME', home):
            with self.assertRaisesRegex(RuntimeError, 'contains edits'):
                harnesses.source_clone(self.base, self.root / 'out/install.log')
        self.assertEqual((clone / 'user-work.txt').read_text(), 'preserve me')


class HarnessTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        p = patch.object(harnesses, 'HOME', self.home)
        p.start(); self.addCleanup(p.stop)
        p = patch.object(update, 'plugin_version', return_value='4.0.0')
        p.start(); self.addCleanup(p.stop)
        p = patch.object(harnesses.shutil, 'which', return_value='/fixture/cli')
        p.start(); self.addCleanup(p.stop)
        self.expected = {'skills/deck/SKILL.md': b'fixture'}

    def package(self, path):
        (path / 'skills/deck').mkdir(parents=True)
        (path / 'skills/deck/SKILL.md').write_bytes(b'fixture')

    def test_audit_includes_grok_and_does_not_inspect_cursor(self):
        def inspect(label, *args):
            self.assertNotEqual(label, 'Cursor')
            return {'target': label, 'state': 'verified'}
        with patch.object(harnesses, 'inspect', side_effect=inspect):
            rows = harnesses.audit('candidate', self.expected)
        self.assertIn('Grok', [r['target'] for r in rows])

    def test_grok_checks_registered_package_and_enabled_setting(self):
        root = self.home / '.grok/installed-plugins/viz-os-fixture'
        self.package(root)
        config = self.home / '.grok/config.toml'
        config.write_text('[plugins]\nenabled = ["viz-os"]\n')
        row = {'name': 'viz-os', 'version': '4.0.0', 'path': str(root), 'marketplace': 'viz-learn'}
        with patch.object(harnesses, 'command', return_value=json.dumps([row])):
            self.assertEqual(harnesses.inspect('Grok', 'candidate', self.expected)['state'], 'verified')
            config.write_text('[plugins]\nenabled = []\n')
            self.assertEqual(harnesses.inspect('Grok', 'candidate', self.expected)['state'], 'disabled')

    def test_absent_codex_not_created_from_matching_cache(self):
        root = self.home / '.codex/plugins/cache/viz-learn/viz-os/4.0.0'
        self.package(root)
        with patch.object(harnesses, 'command', return_value='{"installed": []}'):
            self.assertEqual(harnesses.inspect('Codex', 'candidate', self.expected)['state'], 'absent')

    def test_codex_registration_enablement_and_bytes(self):
        root = self.home / '.codex/plugins/cache/viz-learn/viz-os/4.0.0'
        self.package(root)
        record = {'name': 'viz-os', 'pluginId': 'viz-os@viz-learn', 'version': '4.0.0', 'installed': True, 'enabled': True}
        with patch.object(harnesses, 'command', side_effect=lambda *a: json.dumps({'installed': [record]})):
            self.assertEqual(harnesses.inspect('Codex', 'candidate', self.expected)['state'], 'verified')
            record['enabled'] = False
            self.assertEqual(harnesses.inspect('Codex', 'candidate', self.expected)['state'], 'disabled')
            record['enabled'] = True
            (root / 'skills/deck/extra').write_text('extra')
            self.assertEqual(harnesses.inspect('Codex', 'candidate', self.expected)['state'], 'stale')

    def test_t3_retains_unrelated_shared_skills(self):
        profile = self.home / '.t3/userdata/providers/antigravity/id/antigravity-cli'
        self.package(profile)
        (profile / 'skills/.viz-os-install.json').write_text('{}')
        (profile / 'skills/other').mkdir()
        (profile / 'skills/other/SKILL.md').write_text('do not delete')
        self.assertEqual(harnesses.inspect('T3', 'candidate', self.expected)['state'], 'files verified')

    def test_missing_cli_with_existing_installation_is_blocked(self):
        (self.home / '.codex/plugins').mkdir(parents=True)
        with patch.object(harnesses.shutil, 'which', return_value=None):
            self.assertEqual(harnesses.inspect('Codex', 'candidate', self.expected)['state'], 'blocked')

    def test_disabled_install_is_not_reenabled_or_overwritten(self):
        with patch.object(update, 'remote_main', return_value='sha'), patch.object(update, 'OUT', self.home / 'out'), \
             patch.object(harnesses, 'release_bytes', return_value=self.expected), \
             patch.object(harnesses, 'audit', return_value=[{'target': 'Codex', 'state': 'disabled'}]), \
             patch.object(harnesses, 'apply_target') as apply:
            self.assertEqual(harnesses.install('sha'), 2)
            apply.assert_not_called()

    def test_partial_install_records_failure_and_skips_verified_targets_on_retry(self):
        rows = [{'target': 'Claude', 'state': 'verified'}, {'target': 'Codex', 'state': 'stale'}]
        with patch.object(update, 'remote_main', return_value='sha'), patch.object(update, 'OUT', self.home / 'out'), \
             patch.object(harnesses, 'release_bytes', return_value=self.expected), \
             patch.object(harnesses, 'audit', return_value=rows), \
             patch.object(harnesses, 'apply_target', side_effect=RuntimeError('fixture failure')) as apply:
            self.assertEqual(harnesses.install('sha'), 2)
            self.assertEqual(apply.call_args.args[0], 'Codex')
            receipt = update.load(self.home / 'out/install-sha.json')
            self.assertFalse(receipt['complete'])
            self.assertEqual(receipt['results'][0]['state'], 'verified')
        with patch.object(update, 'remote_main', return_value='sha'), patch.object(update, 'OUT', self.home / 'out'), \
             patch.object(harnesses, 'release_bytes', return_value=self.expected), \
             patch.object(harnesses, 'audit', return_value=rows), \
             patch.object(harnesses, 'inspect', return_value={'target': 'Codex', 'state': 'verified'}), \
             patch.object(harnesses, 'apply_target') as apply:
            self.assertEqual(harnesses.install('sha'), 0)
            self.assertEqual(apply.call_count, 1)


if __name__ == '__main__':
    unittest.main()
