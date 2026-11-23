#!/usr/bin/env bash
# Link the installed Antigravity viz-os plugin into each T3 Antigravity config/plugins directory.
set -eu
python3 - "$HOME" <<'PY'
from pathlib import Path
import sys

home = Path(sys.argv[1])
src = home / '.gemini/config/plugins/viz-os'
if not (src / 'plugin.json').is_file():
    sys.exit(f'Missing installed plugin manifest: {src / "plugin.json"}')
for name in ('class', 'deck', 'sketch'):
    if not (src / 'skills' / name / 'SKILL.md').is_file():
        sys.exit(f'Missing installed skill: {src / "skills" / name / "SKILL.md"}')

src_resolved = src.resolve()
profiles = home / '.t3/userdata/providers/antigravity'
count = 0
for profile in sorted(profiles.glob('*')):
    if not profile.is_dir():
        continue
    cfg = profile / 'config'
    if not cfg.is_dir() or cfg.is_symlink():
        raise SystemExit(f'Unsafe or missing profile directory: {cfg}')
    plugins_dir = cfg / 'plugins'
    if plugins_dir.is_symlink() or (plugins_dir.exists() and not plugins_dir.is_dir()):
        raise SystemExit(f'Unsafe plugins path: {plugins_dir}')
    target = plugins_dir / 'viz-os'
    if target.is_symlink():
        if target.resolve() == src_resolved:
            count += 1
            continue
        raise SystemExit(f'Refusing to overwrite unowned plugin link: {target}')
    if target.exists():
        raise SystemExit(f'Refusing to overwrite unowned plugin path: {target}')
    plugins_dir.mkdir(exist_ok=True)
    target.symlink_to(src)
    count += 1

if not count:
    sys.exit('No T3 Antigravity profiles found; nothing installed')
print(f'viz-os plugin linked into {count} T3 Antigravity profile(s)')
PY
