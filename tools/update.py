#!/usr/bin/env python3
"""Check, publish and update viz-os. Bare invocation only inspects local state."""
import argparse
import hashlib
import fcntl
import json
import os
from pathlib import Path
import platform
import importlib.metadata
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'out/update'
INPUTS = ('plugins/viz-os', 'tools', '.claude-plugin', '.agents/plugins',
          '.cursor-plugin', '.grok-plugin')
VALIDATORS = (('agy', 'plugin', 'validate'), ('claude', 'plugin', 'validate'),
              ('grok', 'plugin', 'validate'), ('muse', 'plugins', 'validate'),
              ('gemini', 'extensions', 'validate'))
REMOTE = 'https://github.com/Tushar-bioinfo/viz-learn.git'
SCHEMA = 2


def run(args, cwd=None, timeout=30):
    return subprocess.run(args, cwd=ROOT if cwd is None else cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          stdin=subprocess.DEVNULL, text=True, timeout=timeout, check=False)


def git(*args):
    p = run(['git', *args])
    if p.returncode:
        raise RuntimeError('git ' + args[0] + ' failed: ' + p.stdout.strip())
    return p.stdout.strip()


def candidate(ref):
    return git('rev-parse', '--verify', '--end-of-options', ref + '^{commit}')


def dirty_inputs():
    return git('status', '--porcelain=v1', '--untracked-files=all', '--', *INPUTS)


def clean_candidate(sha):
    if dirty_inputs() or git('diff', sha, '--', *INPUTS):
        raise RuntimeError('release inputs differ from the committed candidate; commit intended inputs first')


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(data, indent=2) + '\n')
    os.replace(tmp, path)


def load(path):
    return json.loads(path.read_text()) if path.is_file() else {}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check_remote(cwd=None):
    allowed = {REMOTE, REMOTE.removesuffix('.git'), 'git@github.com:Tushar-bioinfo/viz-learn.git'}
    for options in ([], ['--push']):
        p = run(['git', 'remote', 'get-url', '--all', *options, 'origin'], cwd=cwd)
        if p.returncode or p.stdout.strip() not in allowed:
            raise RuntimeError('origin must be the single expected Tushar-bioinfo/viz-learn remote')


def remote_main(cwd=None):
    check_remote(cwd)
    p = run(['git', 'ls-remote', '--exit-code', 'origin', 'refs/heads/main'], cwd=cwd, timeout=120)
    if p.returncode or not re.fullmatch(r'[0-9a-f]{40}\s+refs/heads/main\s*', p.stdout):
        raise RuntimeError('cannot establish origin/main; no publication or installation attempted')
    return p.stdout.split()[0]


def fetch_main():
    before = remote_main()
    p = run(['git', 'fetch', 'origin', 'refs/heads/main:refs/remotes/origin/main'], timeout=180)
    if p.returncode:
        raise RuntimeError('fetch failed; no publication attempted')
    if candidate('origin/main') != before or remote_main() != before:
        raise RuntimeError('origin/main moved during fetch; inspect the new release range and retry')
    return before


def plugin_version(sha):
    return json.loads(git('show', sha + ':plugins/viz-os/.claude-plugin/plugin.json'))['version']


def prepare(version, notes):
    """The agent chooses semantic version and writes the notes; the script synchronizes metadata."""
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise RuntimeError('--version must be a semantic version such as 4.0.1')
    paths = [ROOT / 'plugins/viz-os' / p for p in (
        '.claude-plugin/plugin.json', '.codex-plugin/plugin.json', '.cursor-plugin/plugin.json',
        'plugin.json', 'gemini-extension.json')]
    manifests = [load(p) for p in paths]
    versions = {m.get('version') for m in manifests}
    if len(versions) != 1 or any(m.get('name') != 'viz-os' for m in manifests):
        raise RuntimeError('existing manifests disagree; reconcile before preparing the release')
    old = next(iter(versions))
    if tuple(map(int, version.split('.'))) <= tuple(map(int, old.split('.'))):
        raise RuntimeError('choose a version newer than the current manifests')
    text = Path(notes).read_text().strip()
    if not text or re.search(r'^## ', text, re.M):
        raise RuntimeError('notes must contain release text without a version heading')
    from datetime import date
    log = ROOT / 'plugins/viz-os/CHANGELOG.md'
    content = log.read_text()
    heading = re.search(r'^## ', content, re.M)
    if not heading:
        raise RuntimeError('CHANGELOG.md has no release heading')
    originals = {p: p.read_bytes() for p in [*paths, log]}
    try:
        for path, manifest in zip(paths, manifests):
            manifest['version'] = version
            save(path, manifest)
        log.write_text(content[:heading.start()] + f'## {version} ({date.today().isoformat()})\n\n' +
                       text + '\n\n' + content[heading.start():])
    except OSError:
        for path, original in originals.items():
            path.write_bytes(original)
        raise
    print('prepared:', version, '| five manifests and changelog; inspect and commit intended paths')


def changed_paths(base, sha):
    return git('diff', '--name-only', base, sha).splitlines()


def gates(base, sha):
    paths = changed_paths(base, sha)
    needed = {'implementation', 'release_notes'}
    if any(p.startswith('plugins/viz-os/skills/') and p.endswith('.md') for p in paths):
        needed.add('cold_start')
    if any('/kit/' in p or '/examples/' in p for p in paths):
        needed.add('eyes')
    if any(p.startswith('plugins/viz-os/skills/') and not p.endswith('.md') for p in paths):
        needed.add('numbers')
    return sorted(needed)


def review(sha, base, evidence):
    data = load(Path(evidence))
    if data.get('candidate') != sha or data.get('base') != base:
        raise RuntimeError('review evidence must identify the exact candidate and base commits')
    files = {}
    for gate in gates(base, sha):
        path = Path(data.get(gate, '')).expanduser().resolve()
        if not path.is_file() or not path.stat().st_size:
            raise RuntimeError('review evidence missing for ' + gate)
        files[gate] = {'path': str(path), 'sha256': digest(path)}
    save(OUT / (sha + '.review.json'), {'schema': SCHEMA, 'candidate': sha, 'base': base, 'gates': files})
    print('review recorded:', ', '.join(files))


def reviewed(sha, base):
    receipt = load(OUT / (sha + '.review.json'))
    if receipt.get('schema') != SCHEMA or receipt.get('candidate') != sha or receipt.get('base') != base:
        raise RuntimeError('candidate-bound implementation/release review is required; run review')
    for gate in gates(base, sha):
        entry = receipt.get('gates', {}).get(gate, {})
        path = Path(entry.get('path', ''))
        if not path.is_file() or digest(path) != entry.get('sha256'):
            raise RuntimeError('missing or changed review evidence: ' + gate)


def transient(path):
    return any(p in ('__pycache__', 'snaps', '.DS_Store') or p.endswith(('.pyc', '.pyo'))
               for p in path.parts)


def compare_skills(expected, package, names=None):
    actual = {}
    folder = package / 'skills'
    if folder.exists():
        for p in folder.rglob('*'):
            rel = p.relative_to(package)
            if names and rel.parts[1] not in names:
                continue
            if transient(rel) or (str(rel) not in expected and p.name in ("lesson.html", "page.html") and "examples" in rel.parts):
                continue
            if p.is_symlink():
                actual[str(rel)] = None
            elif p.is_file():
                actual[str(rel)] = p.read_bytes()
    return (sorted(set(expected) - set(actual)),
            sorted(set(actual) - set(expected)),
            sorted(k for k in expected.keys() & actual.keys() if expected[k] != actual[k]))


def status(ref, refresh=False):
    if refresh:
        fetch_main()
    sha = candidate(ref)
    print('candidate:', sha)
    try:
        base = candidate('refs/remotes/origin/main')
        print('origin/main:', base)
        print('candidate commits:')
        print(git('log', '--oneline', base + '..' + sha) or '  none')
    except RuntimeError:
        print('origin/main: unknown (fetch needed)')
    print('release inputs:', 'dirty; commit or remove untracked input before checks' if dirty_inputs() else 'clean')
    import update_harnesses
    update_harnesses.audit(sha)


def environment():
    result = {'python': sys.version, 'platform': platform.platform(), 'runner': digest(Path(__file__))}
    for name in ('numpy', 'scipy', 'PyYAML', 'Pillow', 'playwright'):
        try:
            result[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            result[name] = None
    for name in ('git', *(v[0] for v in VALIDATORS)):
        path = shutil.which(name)
        info = Path(path).resolve().stat() if path else None
        p = run([path, '--version']) if path else None
        result[name] = {'path': str(Path(path).resolve()) if path else None,
                        'size': info.st_size if info else None, 'mtime': info.st_mtime_ns if info else None,
                        'version': p.stdout.strip() if p and p.returncode == 0 else None}
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            browser = Path(pw.chromium.executable_path)
            stat = browser.stat()
            result['chromium'] = [str(browser), stat.st_size, stat.st_mtime_ns]
    except (ImportError, OSError):
        result['chromium'] = None
    return result


def validated(sha, env):
    receipt = load(OUT / (sha + '.json'))
    names = ['updater', 'regression', *(v[0] for v in VALIDATORS)]
    if (receipt.get('schema') != SCHEMA or receipt.get('candidate') != sha or
            receipt.get('environment') != env or not receipt.get('success') or
            receipt.get('checks') != [{'name': name, 'exit': 0} for name in names]):
        return False
    log = Path(receipt.get('log', ''))
    return log.is_file() and digest(log) == receipt.get('log_sha256')


def check(ref):
    sha = candidate(ref)
    clean_candidate(sha)
    OUT.mkdir(parents=True, exist_ok=True)
    receipt_path = OUT / (sha + '.json')
    log = OUT / (sha + '.log')
    env_before = environment()
    if validated(sha, env_before):
        print('checks: reused identical candidate and environment | log:', log)
        return 0
    result = {'schema': SCHEMA, 'candidate': sha, 'environment': env_before, 'success': False,
              'log': str(log), 'checks': []}
    save(receipt_path, result)
    try:
        with tempfile.TemporaryDirectory(prefix='viz-update-') as tmp, log.open('w') as output:
            archive = Path(tmp) / 'source.tar'
            p = subprocess.run(['git', 'archive', '--format=tar', '-o', str(archive), sha], cwd=ROOT, timeout=60)
            if p.returncode:
                raise RuntimeError('git archive failed')
            source = OUT / sha / 'source'
            if source.exists():
                shutil.rmtree(source)
            source.mkdir(parents=True)
            with tarfile.open(archive) as tar:
                tar.extractall(source, filter='data')
            commands = [('updater', [sys.executable, '-m', 'unittest', 'discover', '-s', 'tools', '-p', 'test_update.py'], 180),
                        ('regression', ['bash', 'tools/check-all.sh'], 3600)]
            commands += [(v[0], [*v, 'plugins/viz-os'], 180) for v in VALIDATORS]
            for name, command, timeout in commands:
                output.write('\n$ ' + ' '.join(command) + '\n'); output.flush()
                try:
                    p = subprocess.run(command, cwd=source, stdout=output, stderr=subprocess.STDOUT, timeout=timeout)
                    code = p.returncode
                except (subprocess.TimeoutExpired, FileNotFoundError) as e:
                    output.write(str(e) + '\n'); code = -1
                output.flush()
                result['checks'].append({'name': name, 'exit': code})
                if code:
                    break
            text = log.read_text(errors='replace')
            regression = text.split('$ ' + ' '.join([*VALIDATORS[0], 'plugins/viz-os']))[0]
            warnings = re.search(r'\b(?:[1-9]\d*\s+(?:warnings?|errors?)|(?:warnings?|errors?)\s*[:=]\s*[1-9]\d*)\b', regression, re.I)
            # A zero exit from an empty/truncated runner is not a regression pass.
            complete = all(marker in regression for marker in ('board ui tests:', 'rgb tests:', 'class cases:',
                           'memory tests:', 'tidy tests:', 'doc tests:', 'sketch tests:', 'manifests:'))
            complete = complete and bool(re.search(r'Ran [1-9]\d* tests? in ', regression))
            generated = [p for p in git('ls-tree', '-r', '--name-only', sha, '--', 'plugins/viz-os').splitlines() if p.endswith('.html')]
            rebuilt_match = all((source / p).read_bytes() == subprocess.check_output(['git', 'show', sha + ':' + p], cwd=ROOT, timeout=30) for p in generated)
            result['success'] = (len(result['checks']) == len(commands) and
                                 all(x['exit'] == 0 for x in result['checks']) and not warnings and complete and rebuilt_match and
                                 environment() == env_before and not dirty_inputs() and candidate(ref) == sha)
            result['notes'] = 'Native validator warnings remain in the log for release review. Teaching quality and runtime loading require separate judgment.'
    finally:
        result['log_sha256'] = digest(log) if log.is_file() else None
        save(receipt_path, result)
    print('checks:', 'passed' if result['success'] else 'failed or incomplete', '| log:', log, '| receipt:', receipt_path)
    return 0 if result['success'] else 1


def publish(ref, base):
    sha = candidate(ref)
    base = candidate(base)
    clean_candidate(sha)
    actual = fetch_main()
    if actual != base:
        raise RuntimeError('origin/main differs from the reviewed base; inspect the new commit range')
    if sha == base:
        print('publish: already on origin/main; use install')
        return 0
    if run(['git', 'merge-base', '--is-ancestor', base, sha]).returncode:
        raise RuntimeError('candidate diverges from origin/main; no push attempted')
    plugin_changed = git('diff', base, sha, '--', 'plugins/viz-os')
    if plugin_changed:
        old, new = plugin_version(base), plugin_version(sha)
        if not re.fullmatch(r'\d+\.\d+\.\d+', new) or tuple(map(int, new.split('.'))) <= tuple(map(int, old.split('.'))):
            raise RuntimeError('changed plugin requires an advanced semantic version and release notes')
    if not validated(sha, environment()):
        raise RuntimeError('matching successful checks required; run check for this candidate')
    reviewed(sha, base)
    if remote_main() != base:
        raise RuntimeError('origin/main moved after review; no push attempted')
    p = run(['git', 'push', '--porcelain', 'origin', sha + ':refs/heads/main'], timeout=180)
    if p.returncode:
        raise RuntimeError('fast-forward push failed; inspect remote state before retrying')
    if remote_main() != sha:
        raise RuntimeError('remote changed after push; publication state needs inspection')
    print('published:', sha, '| version:', plugin_version(sha))
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', nargs='?', default='status', choices=('status', 'prepare', 'check', 'review', 'publish', 'install'))
    parser.add_argument('--candidate', default='HEAD', help='committed candidate (default: HEAD)')
    parser.add_argument('--refresh', action='store_true', help='fetch origin/main for status')
    parser.add_argument('--base', help='reviewed origin/main commit, required for review/publish')
    parser.add_argument('--evidence', help='JSON mapping required review gates to evidence files')
    parser.add_argument('--version', help='agent-selected semantic version for prepare')
    parser.add_argument('--notes', help='plain release notes file for prepare')
    args = parser.parse_args()
    try:
        if args.action == 'status':
            status(args.candidate, args.refresh); return 0
        OUT.mkdir(parents=True, exist_ok=True)
        lock_path = Path.home() / '.cache/viz-os-update/update.lock'
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        with lock_path.open('w') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise RuntimeError('another update is running')
            if args.action == 'prepare':
                if not args.version or not args.notes:
                    raise RuntimeError('prepare requires --version and --notes')
                prepare(args.version, args.notes)
                return 0
            if args.action == 'check':
                return check(args.candidate)
            if args.action == 'review':
                if not args.base or not args.evidence:
                    raise RuntimeError('review requires --base and --evidence')
                review(candidate(args.candidate), candidate(args.base), args.evidence)
                return 0
            if args.action == 'publish':
                if not args.base:
                    raise RuntimeError('publish requires --base: the exact reviewed commit range')
                return publish(args.candidate, args.base)
            import update_harnesses
            return update_harnesses.install(candidate(args.candidate))
    except (RuntimeError, OSError, ValueError, subprocess.TimeoutExpired) as e:
        print('update:', e, file=sys.stderr); return 1


if __name__ == '__main__':
    sys.modules.setdefault('update', sys.modules[__name__])
    sys.exit(main())
