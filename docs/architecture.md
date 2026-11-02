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

## The class skill
`skills/class/` makes board lessons with the deck's kit; it adds a slide type, not a second renderer.
```
lesson.yaml ──lesson.py──> deck build.py (ext: board fields, lesson lint, board.js + board.css) ──> lesson.html
                                                                                                    │
                                                                         deck check.py, unchanged ──┘
```
| Concern | File | Notes |
|---|---|---|
| The lesson loop, the five gates | `skills/class/SKILL.md` | reaches the deck as its sibling folder `D` |
| Beats, teaching moves, voice, pacing, series, review | `lesson.md` | pedagogy has one home |
| Every board field, item, plane mark, control | `board.md` | `tools/check_docs.py` fails if a field `board.js` reads is missing here |
| What each lesson lint and check message means | `lint.md` | read only after a build error, so a good run does not pay for it |
| Lesson rules (beats, think stops, symbol before number, typed numbers, no quiz or `recall:`) | `scripts/lesson_lint.py` | run through `build.py`'s lint hook; `lint_cards` and `lint_recall` stay for sketch |
| Build glue: runs and toggles become sliders, the page runtime takes `deck.js`'s place | `scripts/lesson.py` | `prepare()`, `adopt()`; never writes to the viz-os home. `recall()` stays here for sketch |
| The scrolling page: reading line, keys, scene rail, the page's audit | `kit/lesson.js` | answers to the same `VizOS` API as `deck.js`, so `check.py` walks it |
| The board: layout, worked lines, plane, controls, highlights, Next and Back, its audit | `kit/board.js`, `kit/board.css` | reuses the deck's chart, table, ops, compare, stat renderers |
| Clean-up after a lesson: working files to the attic and back | `scripts/tidy.py` | writes only to `attic/` in the viz-os home; tested by `tools/check_tidy.py` |
| Series memory, seeded home tables | `scripts/memory.py`, `scripts/home.py` | `$VIZOS_HOME` or `~/.viz-os` |
| The deck seam | `deck/scripts/build.py` (`ext`) | with no `ext` the deck builds exactly as before |

**Adding a board item or mark:** draw it in `board.js`, add its fields to the `BOARD` field table in `lesson.py`, document it in `board.md` (`check_docs.py` checks this), add a scene to `examples/board-gallery/lesson.yaml`, then `tools/check-all.sh`. A lesson rule goes in `lesson_lint.py` with a case in `tools/class-cases/`.

## The sketch skill
`skills/sketch/` makes one long drawn page. It wraps class and deck the way class wraps deck: same expression engine, same typed-number lint, same browser check, with `deck.js` swapped for `page.js`.
```
page.yaml ──sketch.py──> deck build.py (ext: sheet fields, page lint, recall from class, sketch kit) ──> page.html
                                                                                                         │
                                                       deck check.py, with the tall-page branch ─────────┘
```
| Concern | File | Notes |
|---|---|---|
| The page loop, the five gates | `skills/sketch/SKILL.md` | reaches class as `C` and deck as `D` |
| Beats, teaching moves, voice, pacing, series, review | `skills/class/lesson.md` | **one home for two skills**: an edit there changes pages too |
| Every sheet field, figure item, part, anchor, lint and check message | `page.md` | `tools/check_docs.py` fails if a field, part, state or anchor is missing here |
| Page rules (four answers, thread, frames, parts, custom drawing) | `scripts/page_lint.py` | run through `build.py`'s lint hook; takes its numbers from `lesson_lint.py` |
| Build glue: sheets as slides, recall from a page or a lesson, the font | `scripts/sketch.py` | a private copy of `build.py` with `deck.js` out and `page.js` in |
| Paper grain, pens | `kit/paper.js`, `kit/pens.js` | ported, MIT; `kit/NOTICE` ships |
| The thread, tags, branches | `kit/marks.js` | one seed gives the same pixels |
| The box of parts, custom drawing | `kit/parts.js` | a part draws in a -1..1 box, so size, rotation and anchors stay right |
| Tables, plots, worked lines, formulas | `kit/figures.js` | data marks use exact pens |
| The wall, thread joins, frames, the audit | `kit/page.js` | answers `check.py` as `deck.js` does |
| Inks per paper | `kit/sketch.css` | `tools/check_palette.py` measures them; a colour change is a visual change |
| The deck seam | `deck/scripts/check.py` | a tall-page branch and a size warning, both off for decks and lessons |

**Adding a part:** draw it in `parts.js`, publish its anchors with `G.pub`, add it and its states to `PARTS` in `page_lint.py`, add a row to `page.md`'s table, add it to `tools/sketch-cases/parts-gallery.yaml`, then `tools/check-all.sh`.
**Adding a figure item:** draw it in `figures.js`, add it to `FIGS` in `page_lint.py`, document it in `page.md`, add a case in `tools/sketch-cases/`.
**Adding a page rule:** a lint check in `page_lint.py`, a row in `page.md`'s lint table, and a bad case with `# expect:` in `tools/sketch-cases/`. A rule that is about teaching, not about paper, goes in `lesson.md` and `lesson_lint.py`, so class gets it too.

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
The skills are harness-neutral: a `SKILL.md` calls its own folder `S` and runs `python3 S/scripts/…`, so no harness variable is needed. Each harness finds every folder under `skills/` by itself, so a new skill needs no new manifest.
