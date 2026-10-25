# Release

Only when the user asks for a release, a commit or a push.

## Steps
1. `tools/check-all.sh` passes (see `testing.md`). For a change to the skill files, a cold-start test has been run and judged.
2. Bump the version in **every** manifest (semantic versioning: major = a deck written for the old version may break):
   `plugins/viz-os/.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `plugin.json`, `gemini-extension.json`, and a new `## X.Y.Z (date)` heading in `plugins/viz-os/CHANGELOG.md`.
3. `tools/check_manifests.py` prints `OK`.
4. Commit with a message that says what changed for the learner and what was verified, with counts from actual output. Push to `main`: every harness installs from the default branch.
5. Update the installs (below) and check that each lists `viz-os` at the new version.

## Installing and updating on each harness
| Harness | Install | Update |
|---|---|---|
| Claude Code | `claude plugin marketplace add Tushar-bioinfo/viz-learn` then `claude plugin install viz-os@viz-learn` | `claude plugin marketplace update viz-learn` then `claude plugin update viz-os@viz-learn` |
| Codex | `codex plugin marketplace add Tushar-bioinfo/viz-learn` then `codex plugin add viz-os@viz-learn` | `codex plugin marketplace upgrade viz-learn` then add again |
| Grok Build | `grok plugin marketplace add Tushar-bioinfo/viz-learn` then `grok plugin install viz-os` | `grok plugin marketplace update` then `grok plugin update viz-os` |
| Muse Code | `muse plugins marketplace add viz-learn https://github.com/Tushar-bioinfo/viz-learn` then `muse plugins install viz-os@viz-learn` | `muse plugins marketplace update viz-learn` then install again |
| Cursor | `cursor-agent plugin marketplace add https://github.com/Tushar-bioinfo/viz-learn`, then `/plugins` in Cursor Agent and install viz-os (no headless install yet) | `cursor-agent plugin marketplace update viz-learn` |
| Antigravity CLI | from a clone: `agy plugin install <clone>/plugins/viz-os` | `git pull` in the clone, then install again |
| Gemini CLI | from a clone: `gemini extensions link <clone>/plugins/viz-os` (or `install`, which copies; it asks you to trust the folder) | `git pull` in the clone (a link follows the files) |
Start a new agent session after installing so the skill loads. Every harness also needs Python 3 with `pyyaml`, `playwright` + Chromium and `pillow` to build and check decks.

## Adding a harness
Add its manifest under `plugins/viz-os/` (or its marketplace at the repo root), list it in `tools/check_manifests.py`, the packaging table in `architecture.md`, the table above and the README, then run its own validator (`grok plugin validate`, `muse plugins validate`, `agy plugin validate`, `gemini extensions validate` exist today) and a real install.
