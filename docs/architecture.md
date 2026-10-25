# Architecture

## The pipeline
```
learner.yaml ─┐                         (~/.viz-os or $VIZOS_HOME; read at step 0, updated at step 8)
user request ─┴─> agent follows SKILL.md
                  │ probe.md   3–4 questions, then wait (skipped on "just build")
                  │ story.md   spine at the top of deck.yaml: question, answer, ladder, arc, beats
                  │ make_data.py ──> data.json  (seeded)      verify_data.py recomputes independently
                  │ spec.md    slides under the spine, numbers only as {{name|fmt}}
                  v
             deck.yaml ──build.py──> lint (ERR/WARN lines) ──> deck.html (kit inlined, one file)
                                                                   │
                                                            check.py (Chromium, 1440 × 900)
                                                                   v
                                         WARN lines · snaps/desktop.png · desktop-NN.png · numbers.txt
```
The agent never writes HTML, CSS or SVG, so the look cannot drift and output stays small (a 30-slide deck is about 3,900 words of YAML).

## Which file controls what
| Concern | File | Notes |
|---|---|---|
| What the agent must do, the gates | `skills/deck/SKILL.md` | read every time; keep it short (about 1,500 words) |
| The questions before building | `probe.md` | answers map to entry rung, pretest, anchors, comparisons |
| Story: spine, arcs, bridges, maths without mystery, real-method facts, review questions | `story.md` | §9 is the "eyes" review; §11 is facts from code with the version |
| Every slide type, field, visual, chart mark, function, number format, limit | `spec.md` | the contract between YAML and kit; update it with any kit change |
| Allowed fields per slide type, all lint rules, text budgets | `scripts/build.py` | `FIELDS`, `COMMON`, `lint()`, `lint_equation`, `lint_ops`, `lint_dist`, `lint_visual` |
| The expression language (derive, tables, calc, ops, `{{text}}`, chart functions), stats, `L.tex` recipes | `kit/core.js` | the formula shown is the formula computed; the lint checks names and functions, values are checked in the browser |
| Charts, marks, log axes, sliders | `kit/chart.js` | series colour order lives here |
| Slide renderers (`T.equation`, `T.table`, `T.calc`, …), term labels, notation chips | `kit/slides.js` | |
| Matrix steps (`rows`, `cols`, `map`, `dot`, `sort`, `vec`) | `kit/ops.js` | lights the row or column, names the shape change; warns when numbers fall below 18px |
| Navigation, fit-to-card zoom, the audit the check reads | `kit/deck.js` | `fitSlide`, `L.refit`, `L.audit` |
| Look: tokens, plates, type, the two stages | `kit/vizos.css` | colours measured in `design.md`; only the 1600 × 900 stage is checked |
| Browser audit, contrast on pixels, contact sheet, numbers.txt | `scripts/check.py` | exit 0 clean, 1 warnings, 2 could not run |

## Adding something
- **A new slide type or visual:** renderer in `kit/slides.js` (or `chart.js`/`ops.js`), allowed fields and lint in `build.py`, reference in `spec.md`, one example slide in `examples/gallery/deck.yaml`, then `tools/check-all.sh`.
- **A new rule for the deck-building agent:** a lint check in `build.py` if it can be checked; otherwise one line in the skill file that owns that step (see the table above). Never both in two skill files.
- **A new example:** `examples/<slug>/` with `deck.yaml`, `make_data.py` → `data.json`, and `verify_data.py` ending in `ALL OK`. Add the slug to `tools/check-all.sh` and the Files table in `SKILL.md`.

## Packaging for each agent harness
The plugin root is `plugins/viz-os/`. Each harness reads its own manifest; all must agree (`tools/check_manifests.py`).
| Harness | Plugin manifest | Marketplace (repo root) |
|---|---|---|
| Claude Code | `.claude-plugin/plugin.json` | `.claude-plugin/marketplace.json` |
| Codex | `.codex-plugin/plugin.json` (`skills: ./skills/`) | `.agents/plugins/marketplace.json` |
| Cursor | `.cursor-plugin/plugin.json` | `.cursor-plugin/marketplace.json` |
| Grok Build | reads `.claude-plugin/plugin.json` | `.grok-plugin/marketplace.json` |
| Muse Code | reads `.claude-plugin/plugin.json` | reads `.claude-plugin/marketplace.json` |
| Antigravity CLI (`agy`) | `plugin.json` at the plugin root | none: install from a local clone |
| Gemini CLI | `gemini-extension.json` | none: link from a local clone |
The skill itself is harness-neutral: `SKILL.md` calls its own folder `S` and runs `python3 S/scripts/…`, so no harness variable is needed.
