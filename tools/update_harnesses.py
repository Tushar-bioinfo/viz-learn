"""Supported viz-os manager commands and read-only installation verification."""
import json
from pathlib import Path
import re
import shutil
import subprocess

import update as u

HOME = Path.home()
TARGETS = ('Claude', 'Codex', 'Grok', 'Muse', 'Agy', 'Gemini', 'T3')
CLIS = dict(zip(TARGETS, ('claude', 'codex', 'grok', 'muse', 'agy', 'gemini', 'agy')))
LISTS = {'Claude': ['claude', 'plugin', 'list', '--json'],
         'Codex': ['codex', 'plugin', 'list', '--marketplace', 'viz-learn', '--json'],
         'Grok': ['grok', 'plugin', 'list', '--json'],
         'Muse': ['muse', 'plugins', 'inspect', 'viz-os', '--json'],
         'Agy': ['agy', 'plugin', 'list', '--json'],
         'Gemini': ['gemini', 'extensions', 'list']}


def command(argv, log=None):
    p = u.run(argv, timeout=180)
    if log:
        with log.open('a') as f:
            f.write('\n$ ' + ' '.join(map(str, argv)) + '\n' + p.stdout)
    if p.returncode:
        raise RuntimeError('command failed: ' + ' '.join(argv[:3]) + (f'; see {log}' if log else ''))
    return p.stdout


def release_bytes(sha):
    paths = u.git('ls-tree', '-r', '--name-only', sha, '--', 'plugins/viz-os').splitlines()
    return {p.removeprefix('plugins/viz-os/'): subprocess.check_output(
        ['git', 'show', sha + ':' + p], cwd=u.ROOT, timeout=30) for p in paths}


def matches(expected, package):
    skills = {k: v for k, v in expected.items() if k.startswith('skills/')}
    if any(u.compare_skills(skills, package)):
        return False
    return all((package / p).is_file() and not (package / p).is_symlink() and
               (package / p).read_bytes() == value for p, value in expected.items() if p not in skills)


def select(data, field):
    rows = data if isinstance(data, list) else data.get('installed', [])
    return [r for r in rows if r.get(field) in ('viz-os', 'viz-os@viz-learn')]


def inspect(label, sha, expected, log=None):
    """A cache match alone is never reported as an enabled installation."""
    state = {'target': label, 'state': 'absent', 'runtime': 'not tested'}
    version = u.plugin_version(sha)
    if label == 'T3':
        profiles = [p for p in sorted((HOME / '.t3/userdata/providers/antigravity').glob('*/config'))
                    if p.is_dir() and not p.is_symlink()]
        if not profiles:
            return state
        agy_pkg = (HOME / '.gemini/config/plugins/viz-os').resolve()
        disabled = False
        for p in profiles:
            cfg = u.load(p / 'config.json')
            if cfg.get('plugins', {}).get('viz-os', {}).get('enabled') is False:
                disabled = True
            plugins_dir = p / 'plugins'
            if plugins_dir.is_symlink() or (plugins_dir.exists() and not plugins_dir.is_dir()):
                return dict(state, state='blocked', detail='unsafe plugins path')
            link = plugins_dir / 'viz-os'
            if link.exists() or link.is_symlink():
                if not link.is_symlink() or link.resolve() != agy_pkg:
                    return dict(state, state='blocked', detail='unowned viz-os path in T3 profile')
        if disabled:
            return dict(state, state='disabled', detail='preserved; enable explicitly in T3 config.json if wanted')
        ok = (all((p / 'plugins/viz-os').is_symlink() and (p / 'plugins/viz-os').resolve() == agy_pkg for p in profiles)
              and agy_pkg.is_dir() and matches(expected, agy_pkg))
        return dict(state, state='files verified' if ok else 'stale', detail=f'{len(profiles)} profile(s); provider runtime unknown')
    if not shutil.which(CLIS[label]):
        # Existing manager files without a working CLI are a failure, not an absent target.
        folders = {'Claude': '.claude/plugins', 'Codex': '.codex/plugins', 'Grok': '.grok/installed-plugins',
                   'Muse': '.local/share/muse/plugins', 'Agy': '.gemini/config/plugins/viz-os', 'Gemini': '.gemini/extensions/viz-os'}
        return dict(state, state='blocked' if (HOME / folders[label]).exists() else 'absent', detail='CLI unavailable')
    if label == 'Muse' and not u.load(HOME / '.local/share/muse/plugins/installed.json').get('plugins', {}).get('viz-os'):
        return state
    text = command(LISTS[label], log)
    if label == 'Gemini':
        block = re.search(r'^[^\n]*\bviz-os \(([^)]+)\)\n(.*?)(?=^[✓✗]|\Z)', text, re.M | re.S)
        if not block:
            return state
        meta = u.load(HOME / '.gemini/extensions/viz-os/.gemini-extension-install.json')
        if meta.get('type') != 'link' or not meta.get('source'):
            return dict(state, state='manual', detail='extension is not a managed source link')
        package = Path(meta['source']).expanduser()
        enabled = all(x in block[2] for x in ('Enabled (User): true', 'Enabled (Workspace): true'))
        actual_version = block[1]
    else:
        data = json.loads(text)
        if label == 'Muse':
            row = data.get('record')
            if not row:
                return state
            package = Path(row['cache_path'])
            enabled = row.get('enabled') is True and data.get('valid') is True and data.get('active') is True
            actual_version = row.get('version')
        else:
            rows = select(data, 'id' if label == 'Claude' else 'name')
            if label == 'Claude':
                rows = [r for r in rows if r.get('scope') == 'user']
            if len(rows) != 1:
                return dict(state, state='blocked' if rows else 'absent', detail='ambiguous registration' if rows else '')
            row = rows[0]
            actual_version = row.get('version')
            enabled = row.get('enabled') is True
            if label == 'Claude':
                package = Path(row['installPath'])
            elif label == 'Codex':
                if row.get('pluginId') != 'viz-os@viz-learn' or row.get('installed') is not True:
                    return state
                package = HOME / '.codex/plugins/cache/viz-learn/viz-os' / str(actual_version)
            else:
                if label == 'Grok':
                    if row.get('marketplace') != 'viz-learn':
                        return dict(state, state='blocked', detail='viz-os belongs to another marketplace')
                    # Grok's JSON list omits enablement; read only the plugins table.
                    import tomllib
                    config = HOME / '.grok/config.toml'
                    enabled = 'viz-os' in tomllib.loads(config.read_text()).get('plugins', {}).get('enabled', [])
                package = Path(row['path'])
    if not enabled:
        return dict(state, state='disabled', detail='preserved; enable explicitly through the manager if wanted')
    ok = actual_version == version and matches(expected, package)
    return dict(state, state='verified' if ok else 'stale', package=str(package), version=actual_version)


def audit(sha, expected=None, log=None):
    expected = expected or release_bytes(sha)
    results = []
    for label in TARGETS:
        try:
            result = inspect(label, sha, expected, log)
        except (RuntimeError, OSError, ValueError, KeyError, subprocess.TimeoutExpired) as e:
            result = {'target': label, 'state': 'blocked', 'detail': str(e), 'runtime': 'not tested'}
        results.append(result)
        print(label + ': ' + result['state'] + (' | ' + result['detail'] if result.get('detail') else ''))
    print('Fresh-session model loading: not tested. Restart existing sessions after updates.')
    return results


def source_clone(sha, log):
    clone = HOME / '.local/share/viz-learn'
    if not (clone / '.git').exists():
        raise RuntimeError('existing release clone missing; create it explicitly before install')
    u.check_remote(clone)
    if u.run(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=clone).stdout.strip():
        raise RuntimeError('release clone contains edits; preserve them and reconcile before updating')
    branch = u.run(['git', 'symbolic-ref', '--short', 'HEAD'], cwd=clone)
    if branch.returncode or branch.stdout.strip() != 'main':
        raise RuntimeError('release clone must remain on main; no checkout/reset attempted')
    p = u.run(['git', 'fetch', 'origin', 'refs/heads/main'], cwd=clone, timeout=180)
    with log.open('a') as f:
        f.write('\nrelease clone fetch:\n' + p.stdout)
    fetched = u.run(['git', 'rev-parse', 'FETCH_HEAD'], cwd=clone)
    ancestor = u.run(['git', 'merge-base', '--is-ancestor', 'HEAD', sha], cwd=clone)
    if p.returncode or fetched.returncode or fetched.stdout.strip() != sha or ancestor.returncode:
        raise RuntimeError('release clone fetch differs from the candidate or has diverged; no merge attempted')
    p = u.run(['git', 'merge', '--ff-only', sha], cwd=clone, timeout=120)
    actual = u.run(['git', 'rev-parse', 'HEAD'], cwd=clone)
    if p.returncode or actual.returncode or actual.stdout.strip() != sha:
        raise RuntimeError('release clone does not match the exact published candidate')
    return clone


def apply_target(label, clone, log):
    # Only Muse, Agy and T3 read the shared clone; Claude, Codex and Grok run while it is still None.
    if clone is None and label in ('Muse', 'Agy', 'T3'):
        raise RuntimeError('shared release clone not prepared for ' + label)
    clone = clone or Path('/nonexistent-release-clone')
    commands = {
        'Claude': [['claude', 'plugin', 'marketplace', 'update', 'viz-learn'],
                   ['claude', 'plugin', 'update', 'viz-os@viz-learn', '--scope', 'user']],
        'Codex': [['codex', 'plugin', 'marketplace', 'upgrade', 'viz-learn'],
                  ['codex', 'plugin', 'add', 'viz-os@viz-learn', '--json']],
        'Grok': [['grok', 'plugin', 'marketplace', 'update', 'viz-learn'], ['grok', 'plugin', 'update', 'viz-os']],
        # A supported local-source install avoids removing the plugin or its marketplace/data.
        'Muse': [['muse', 'plugins', 'install', str(clone / 'plugins/viz-os'), '--json']],
        'Agy': [['agy', 'plugin', 'install', str(clone / 'plugins/viz-os')]],
        'T3': [['bash', str(clone / 'tools/install_t3_agy.sh')]],
        'Gemini': [],  # The validated existing source link follows the clone.
    }
    for cmd in commands[label]:
        command(cmd, log)


def install(sha):
    if u.remote_main() != sha:
        raise RuntimeError('install candidate must equal the current published origin/main')
    expected = release_bytes(sha)
    u.OUT.mkdir(parents=True, exist_ok=True)
    log = u.OUT / ('install-' + sha + '.log')
    before = audit(sha, expected, log)
    results = []
    clone = None
    for row in before:
        label = row['target']
        try:
            if row['state'] == 'stale':
                if u.remote_main() != sha:
                    raise RuntimeError('remote advanced during installation; re-audit the new release')
                if label in ('Muse', 'Agy', 'Gemini', 'T3') and clone is None:
                    # A linked Gemini extension changes as the clone advances; never advance an unowned link.
                    meta = u.load(HOME / '.gemini/extensions/viz-os/.gemini-extension-install.json')
                    if meta and (meta.get('type') != 'link' or Path(meta.get('source', '')).resolve() !=
                                 (HOME / '.local/share/viz-learn/plugins/viz-os').resolve()):
                        raise RuntimeError('Gemini source differs from the expected shared clone; reconcile manually')
                    clone = source_clone(sha, log)
                if label == 'T3':
                    agy = inspect('Agy', sha, expected, log)
                    if agy['state'] != 'verified':
                        raise RuntimeError('T3 copy requires verified enabled Antigravity source first')
                apply_target(label, clone, log)
                row = inspect(label, sha, expected, log)
                if row['state'] not in ('verified', 'files verified'):
                    raise RuntimeError('manager returned without a verified installation')
        except (RuntimeError, OSError, ValueError, KeyError, subprocess.TimeoutExpired) as e:
            row = dict(row, state='blocked', detail=str(e))
        results.append(row)
        u.save(u.OUT / ('install-' + sha + '.json'), {'candidate': sha, 'results': results,
               'complete': False, 'log': str(log)})
    complete = all(r['state'] in ('verified', 'files verified', 'absent') for r in results)
    if u.remote_main() != sha:
        complete = False
    u.save(u.OUT / ('install-' + sha + '.json'), {'candidate': sha, 'results': results,
           'complete': complete, 'log': str(log), 'runtime': 'not tested'})
    print('Update result: ' + ('installed files verified' if complete else 'incomplete; see individual targets') + ' | log: ' + str(log))
    for row in results:
        print(row['target'] + ': ' + row['state'] + (' | ' + row['detail'] if row.get('detail') else ''))
    return 0 if complete else 2
