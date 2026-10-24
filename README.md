# viz-learn

Home of **viz-os**, a Claude Code plugin that turns "teach me X" into a visual learning deck you can follow from the basics up, in an iOS Liquid Glass style on black, for laptop and phone.

Before it builds, it asks what you know and which comparisons click for you. Then it tells the story mostly with visuals. Every formula shows where it comes from and what it is related to, tables are worked one step at a time, and every deck is checked in a real browser on desktop and phone.

## Install
```bash
claude plugin marketplace add Tushar-bioinfo/viz-learn
claude plugin install viz-os@viz-learn
pip install pyyaml playwright pillow && playwright install chromium   # to build and check decks
```
Then ask for a deck, or run `/viz-os:deck <topic>`.

## What is here
- `.claude-plugin/marketplace.json`: the marketplace entry.
- `plugins/viz-os/`: the plugin. Read its [README](plugins/viz-os/README.md) and [CHANGELOG](plugins/viz-os/CHANGELOG.md).
  - `skills/deck/`: the skill (rules, probe, story guide, deck reference), the kit that draws every slide, the build and check scripts, and two example decks.
  - `docs/design.md`: why it is built this way, with sources.
