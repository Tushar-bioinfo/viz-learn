# viz-learn

Home of **viz-os**, an agent plugin (Claude Code, Codex, Cursor, Grok, Muse, Antigravity, Gemini) that turns "teach me X" into a visual learning deck you can follow from the basics up, in a flat dark look (square blocks, thick grey borders, one orange), for a laptop or desktop screen.

Before it builds, it asks what you know and which comparisons click for you. Then it tells the story mostly with visuals. Every formula shows where it comes from and what it is related to. Matrix steps show which rows or columns are computed and how the shape changes. Every working step says what it does and why. Every number is computed from data and checked, and every deck is checked in a real browser on a desktop screen.

## Install
Pick your agent. Every one also needs Python 3 for building and checking decks:
```bash
pip install pyyaml playwright pillow && playwright install chromium
```

| Agent | Install |
|---|---|
| Claude Code | `claude plugin marketplace add Tushar-bioinfo/viz-learn` then `claude plugin install viz-os@viz-learn` |
| Codex | `codex plugin marketplace add Tushar-bioinfo/viz-learn` then `codex plugin add viz-os@viz-learn` |
| Grok Build | `grok plugin marketplace add Tushar-bioinfo/viz-learn` then `grok plugin install viz-os` |
| Muse Code | `muse plugins marketplace add viz-learn https://github.com/Tushar-bioinfo/viz-learn` then `muse plugins install viz-os@viz-learn` |
| Cursor | `cursor-agent plugin marketplace add https://github.com/Tushar-bioinfo/viz-learn`, then install viz-os from the marketplace |
| Antigravity CLI | `git clone https://github.com/Tushar-bioinfo/viz-learn` then `agy plugin install viz-learn/plugins/viz-os` |
| Gemini CLI | `git clone https://github.com/Tushar-bioinfo/viz-learn` then `gemini extensions link viz-learn/plugins/viz-os` |
| Anything else | point the agent at `plugins/viz-os/skills/deck/SKILL.md`; the skill needs only its own folder |

Start a new session, then ask for a deck ("make me a viz-os deck on maximum likelihood"), or run `/viz-os:deck <topic>` in Claude Code.

## What is here
- Marketplaces for each agent: `.claude-plugin/`, `.agents/plugins/` (Codex), `.cursor-plugin/`, `.grok-plugin/`.
- `plugins/viz-os/`: the plugin. Read its [README](plugins/viz-os/README.md) and [CHANGELOG](plugins/viz-os/CHANGELOG.md).
  - `skills/deck/`: the skill (rules, probe, story guide, deck reference), the kit that draws every slide, the build and check scripts, and three example decks (one of them about a real method, MAGeCK's RRA).
  - `docs/design.md`: why it is built this way, with sources.
- `AGENTS.md` (also `CLAUDE.md`, `GEMINI.md`): start-up notes for any agent working on the plugin.
- `docs/`: architecture, testing (including the cold-start test), backlog and release notes for plugin builders. Not shipped.
- `tools/check-all.sh`: rebuild and check every example; `tools/check_manifests.py`: keep the manifests in sync.
