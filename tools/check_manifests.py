#!/usr/bin/env python3
"""Check that every agent's manifest for viz-os agrees: valid JSON, same name and version, sources that exist.

Usage: tools/check_manifests.py      (run from anywhere; exit 0 = all agree, 1 = a problem is printed)
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLUGIN = ROOT / "plugins/viz-os"
NAME = "viz-os"
MANIFESTS = [  # plugin manifests, one per agent family
    ".claude-plugin/plugin.json",    # Claude Code; Grok Build and Muse read it too
    ".codex-plugin/plugin.json",     # Codex
    ".cursor-plugin/plugin.json",    # Cursor
    "plugin.json",                   # Antigravity CLI (agy)
    "gemini-extension.json",         # Gemini CLI
]
MARKETS = [".claude-plugin/marketplace.json", ".agents/plugins/marketplace.json",
           ".cursor-plugin/marketplace.json", ".grok-plugin/marketplace.json"]

problems, versions = [], {}
for rel in MANIFESTS:
    p = PLUGIN / rel
    try:
        d = json.loads(p.read_text())
    except Exception as e:
        problems.append(f"{p.relative_to(ROOT)}: {e}"); continue
    if d.get("name") != NAME:
        problems.append(f"{p.relative_to(ROOT)}: name is {d.get('name')!r}, not {NAME!r}")
    versions[rel] = d.get("version")
for rel in MARKETS:
    p = ROOT / rel
    try:
        d = json.loads(p.read_text())
    except Exception as e:
        problems.append(f"{rel}: {e}"); continue
    entry = next((x for x in d.get("plugins", []) if x.get("name") == NAME), None)
    if not entry:
        problems.append(f"{rel}: no plugin named {NAME}"); continue
    src = entry.get("source")
    path = src.get("path") if isinstance(src, dict) else src
    if not path or (ROOT / path).resolve() != PLUGIN.resolve():
        problems.append(f"{rel}: source {src!r} does not point at plugins/viz-os")
log = (PLUGIN / "CHANGELOG.md").read_text()
m = re.search(r"^## (\d+\.\d+\.\d+)", log, re.M)
versions["CHANGELOG.md"] = m.group(1) if m else None
if len(set(versions.values())) != 1:
    problems.append("versions differ: " + ", ".join(f"{k} {v}" for k, v in versions.items()))
for skill in ("deck", "class"):
    if not (PLUGIN / f"skills/{skill}/SKILL.md").exists():
        problems.append(f"plugins/viz-os/skills/{skill}/SKILL.md is missing")

for line in problems:
    print("ERR", line)
print(f"manifests: {len(MANIFESTS)} plugin + {len(MARKETS)} marketplace files · version {versions.get('.claude-plugin/plugin.json')} · "
      + ("OK" if not problems else f"{len(problems)} problems"))
sys.exit(1 if problems else 0)
