# Class lessons as a scrolling page: the plan

Branch `feat/class-scroll-board`, cut from `feat/sketch-skill` (viz-os 2.2.0). Baseline before any change: `tools/check-all.sh` exit 0.
The user reviews after each stage, so a stage ends with something they can look at, and later stages may change.

## What the user asked for
1. The lesson scrolls down. A Next button stays only where it shows a visual change or is otherwise useful. Think of how the CampusX board fills up: one continuous page, written things stay, tables and diagrams sit side by side at whatever size they need, and the teacher scrolls back to earlier work.
2. The look stays: flat dark plates, thick grey borders, one orange. This is not sketch's paper look.
3. Remove the quiz cards at the start and end. Keep the one-line questions in the middle (think stops).
4. **Figures, tables and images never take an odd shape to fit a layout.**
5. Good font sizes for equations, big enough plots and tables, solid and robust interactivity.
6. After the HTML is made, a clean-up that keeps one or two important files and clears the rest.
7. Work on git, in steps that can be undone, with regular looks at how it renders.

## Ground rules for every stage
- Commit at each named checkpoint on `feat/class-scroll-board`, ending the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push, never bump the version, never open a PR, never trigger reviews.
- Work only in this worktree. The main checkout has someone's uncommitted work: leave it alone.
- **Do not edit anything under `plugins/viz-os/skills/deck/`.** Decks must build byte-identical (`docs/testing.md` §1b). If you think a deck change is needed, stop and say why in your report.
- Sketch reuses class code and text. Do not break it (see "What sketch needs").
- Never hand-edit a built `lesson.html`. Every number is computed. Skill files never point at `docs/` or the repo root. Test output goes in `out/`.
- Report counts only from real output. "Not checked" is an acceptable report; a guess is not.
- No new dependencies, no installs.

## The page design (decided)

### Reading
A lesson is one long page, a scene after a scene. A scene is a head (beat chip, title, lead), then its steps in order. **Written things stay.** Nothing is hidden behind a click except a think answer, and that keeps its space so the page never jumps. Term colours stay on all the time; nothing turns grey when it is past.

A reading line sits at 45% of the window's height. As a step passes it: that step is lit (`now`), the table's next derived column fills in, and the row in use and the cells it reads are lit in their term colours. Hovering a step does the same for the moment. Losing this loses no content: a scene that has been passed shows full. **Scrolling never changes a figure.**

### Where things go
- **Steps before the first figure** flow in a single column.
- **Figure block**: a figure item (`plane`, `chart`, `image`, `stat`, `units`) starts a block holding it and the steps after it, until the next figure or a wide item. Figure on the left and sticky, its lines on the right. Text is never behind a stepper. They sit side by side only when the figure gets at least 520 px and the text at least 460 px; otherwise the figure goes above its lines and is not sticky.
- **Wide items** (`assemble`, `compare`, `ops`, `dist`, `parts`, `flow`) run the full page width and end the current block and the table pairing.
- **Table scenes**: left column is the sticky table at its natural width, with any `side: true` notes and params under it; right column is the flow above. If the table is wider than 56% of the page, it goes on top at full width and is not sticky.
- `next` lines between an `assemble`'s two rows: the numbers row, then the next step's say and think, then the symbols row, all in one plate. The next step's added items come after the plate.
- Anything sticky that is taller than the window minus 48 px stops being sticky, or its foot could never be reached.
- **Think stop**: inline tag, the one-line question, a Show answer button. The answer and everything that step adds keep their space with `visibility: hidden` until opened. This includes a figure, a table column and a stage stop: a think step never spoils itself.
- **Controls** sit under the figure they drive: the first figure whose spec mentions the control's name, otherwise the scene's last figure, otherwise at the end of the flow. `step_at` no longer does anything.

### Next and Back
A figure gets Back, dots and Next only when it really changes. Its stops are the clicks where something new comes in: plane mark `step`, chart series or mark `step`, image label `step`, a run's frames (`frame:` or `stops`), an ops step. One state means no buttons.
- It starts at its first stop. Print and the contact sheet show its last.
- The lines that belong to the current stop are highlighted. Clicking a line in the block goes to its stop.
- Reaching a think step's stop opens that think stop.
- A run also has its scrubber and play button; scrubbing moves the highlighted line. Play stops when the scene leaves the reading line, or when the learner scrubs.
- ← → step the stage nearest the reading line, otherwise jump a scene. They do nothing while focus is in an input.
- `build` on `flow` and `parts` is unused in the examples: show those complete.

### Sizes: every figure owns its shape
The layout gives a figure a width and a height limit, never a box to fill.

| Thing | Shape comes from | Rule |
|---|---|---|
| Page | | `--page-w: min(1320px, 100vw - 64px)` |
| Height limit | | `figH = min(640, innerHeight - 170)`, so a figure and its buttons fit on a laptop screen |
| `plane` | its axis ranges, one scale on both axes | `u = min((roomW - 80) / xspan, (roomH - 74) / yspan)`, `W = u * xspan + 80`, `H = u * yspan + 74` |
| `chart`, `dist` | `ratio` on the item or chart (for example `2:1`), default 3:2 | definite height on `.chart`; the plate's padding is added on top, not taken from the plot |
| `image` | the image's own ratio | `max-height: figH; width: auto; height: auto`. Sized again on `load` |
| `units` | 3:2 | |
| `parts` | | height 286, or `74 + 96 * rows`; at most 1040 wide |
| `flow` | | height about 196, with smaller fonts than a deck's |
| `ops` | | a definite height so it fits its font in the box |

Font sizes, in real pixels (nothing is scaled any more): h1 34, lead 21, eyebrow 14, say 20–21, calc math 29, line math 30, assemble math 32, table td 21, th 16, note 20, params 24/21/17, plane tick 16, axis title 18, plane label 17.

### Audits (fail the browser check)
Add to the board's audit: chart width/height outside 1–2.2; any figure under 340 × 220 px; math under 26 px; table cells under 20 px. Keep: missing mark targets, `≈` lines, plane issues, the visuals' and ops' audits, data clashes, a formula wider than its box. Drop the zone overflow, pinned-table-moved and zoom audits: they described a fixed stage.

## Traps found while planning
- **Class names**: the deck already uses `.flow` and `.pair`. Use `.lines` for the running column and `.bpair` for the table pairing. The draft's `h('div', 'flow')` is wrong for this reason.
- **`[data-step]` is hidden by default** in `vizos.css`, and `lesson.js` does not reveal it the way `deck.js` did. `T.recap` puts `data-step` on its boxes and has no `show`, so recap would be blank. For a slide with no `show`, mark every `[data-step]` `.shown` when drawing. Render `r.more` (recap's Go next list) on the page: its old home, the Details sheet, is gone.
- **`.enter`** animates under `.slide.on`, and on a page only one scene is `.on`. Make sure a scene that is not `.on` is fully visible.
- `html, body { height: 100%; overflow: hidden }` and `body { user-select: none }` must be overridden under `html.ls-page`, or there is no scroll and no text selection. `position: sticky` needs every ancestor to have `overflow: visible`.
- `.slide` is a fixed stage in the deck; on the page it is static flow at `--page-w`. `.s-title .display` is 84 px and needs a page size.
- Any other deck slide type allowed between scenes (`table`, `idea`, …) expects a tall box: give it a definite height and show all its steps.
- The check sets the window taller for its photo. Redraw only when the width changes, so `figH` does not jump.
- `names()` must run synchronously and clear its old labels; there is no scale to divide by any more.
- Image size is unknown until it decodes: re-place on `load`.
- A slider redraws many times a frame: `ctx.refresh` is throttled by rAF and leaves the slider itself alone.

## What sketch needs (do not break)
`sketch.py` imports `lesson.deck_build`, `lesson.prepare` and `lesson.recall`. `page_lint.py` imports `BEATS, CARDS, LINE_WORDS, SCENES, THINK_GAP, as_list, lint_cards, lint_controls, lint_order, lint_recall, lint_typed` from `lesson_lint.py`. So:
- `adopt()` goes in `lesson.py` and is called in `lesson.build()` only. **Do not put it in `deck_build()`**: sketch calls that and has its own runtime.
- `lesson.recall`, `lint_cards`, `lint_recall` stay. Class just stops calling them.
- `lint_controls` stays as it is.
- Sketch reads `C/lesson.md` §1–7 and §9, and a page still ends in review cards and may still use `recall:`. `tools/sketch-cases/recall/first-lesson/` keeps its quiz: `recall` reads old lessons as before.

## Stage 1: the scrolling page (visual; user reviews after it)
Files: `class/kit/lesson.js` (written, committed, unused so far), `class/kit/board.js`, `class/kit/board.css`, `class/scripts/lesson.py`, plus small updates the checks force.

1. `lesson.py`: add `adopt(B)` (swap `deck.js` for `kit/lesson.js` in `B.KIT_JS`) and call it in `build()`. `ext["js"]` files go before the last kit file, so `board.js` stays ahead of the runtime.
2. `board.js`: rewrite `L.types.board` to the design above. Keep the helpers (`md`, `sv`, `list`, `col`, `beatLabel`, `symOf`, `shortOf`, `subFmt`, `tint`, `names`, `niceStep`, `halfBox`, `clipLine`, `plane`, `formTex`, `termColor`, `termNames`, `drawAsm`, `drawLines`, `drawParams`, `work`, `store`, `clash`, the controls). `board.js` must return `R = { node, steps, layout(), repaint(), spy(y), show(k), reset(), hover(k), stages: [{ node, move(dir) }], audit() }`, as `lesson.js` expects. `show(k)` puts everything at click k, opens thinks with `at <= k`, and moves stages to the last stop `<= k`.
3. `board.css`: rewrite for the page. Same palette, plates and borders. Add `#lsbar`, `#lsrail`, focus outlines on buttons, and print rules. Phone falls back to stacked.
4. `tools/check_board_ui.py` (new, wired into `tools/check-all.sh`, prints `board ui tests: N/N ok`): a Playwright test on built examples that **acts like a learner**. Next changes what a figure shows and Back undoes it; Show answer opens without moving anything below it; a slider changes a number on the page; a run's scrubber moves the highlighted line; scrolling sets `now` and fills a table column but leaves a figure's state alone; no horizontal page scroll at 1280, 1440 and 1920 wide; every plane has equal units; every chart and image keeps its ratio across those widths.
5. Update `tools/class-cases/capacity-overflow.yaml`, whose audit no longer exists, and any board field the docs test asks for (`ratio` in `board.md`). No other skill-text work in this stage.

**Checkpoints**: commit when `board-gallery` builds and checks clean, then again when all six examples do.

**Done when**: `tools/check-all.sh` exits 0, with every example and sketch at 0 warnings and `board ui tests` passing; `git diff --stat feat/sketch-skill -- plugins/viz-os/skills/deck` is empty. Quiz slides still exist at this stage and may look plain: stage 2 removes them.

**Report**: the commits; counts from the real run; paths to the contact sheets for `board-gallery`, `variance` and `pca-1-what`; anything you changed from this plan and why; what you are unsure of.

## Stage 2: quiz removal, clean-up, words (after the user has seen stage 1)
1. **Lint**: in a class lesson `type: quiz` and `recall:` are errors with a plain message (delete it; keep questions as `think` stops). `next` is the last scene. `make_lint` drops `lint_cards` and `lint_recall`. Replace the "must fit the stage" wording.
2. `lesson.py`: remove the `recall()` call from `ext`'s `prep`.
3. **Examples**: delete every `quiz` slide and `recall:` line. A series continues through memory, `lead`, the `next` scene, and a think stop near the start that reaches back to the last lesson, using only that lesson's data. Remove `step_at`.
4. **Cases**: delete `recall*`, `recall/`, `card-*`, `review-8-cards`, `quiz-comma`, `shape-no-cards`. Strip quiz slides from the rest. Add `no-quiz.yaml` and `no-recall.yaml`. Update `shape-after-next.yaml`.
5. **`C/scripts/tidy.py lessons/<slug>`**, the last loop step after Remember. Keeps `lesson.html` and `lesson.yaml`. Moves only known working files (`snaps/`, the yaml's `data_file`, `make_data.py`, `verify_data.py`, images the yaml references, `__pycache__`) to `$VIZOS_HOME/attic/<slug>-<date>/`, so nothing is lost. `--restore` brings them back, `--dry-run` prints the moves, `--keep name` spares a file. It refuses unless `lesson.html` exists, is non-empty, is newer than the yaml, and has its data inlined. It refuses inside the plugin's `skills/` folder, because the examples are regression tests. Unknown files are left alone and listed. `lesson.py`'s missing-data message names `--restore`. Test it in `tools/check_tidy.py`, wired into `check-all.sh`.
6. **Skill text, in plain words**: `class/SKILL.md` (description, heading, the loop with Tidy, reply line, the rules "one line per step" and how think works), `board.md` (replace "The zones" with how a scene is laid out, `ratio`, controls without `step_at`, remove Series recall and Review cards, update lint messages), `lesson.md` (§1 shape, §6 pacing wording, §7 series without recall for lessons but keeping what sketch needs, §9 review questions true for both skills). Move §8 Review cards into `sketch/page.md`, since only sketch uses it now, renumber, and fix sketch's section references. Update sketch's `page.md` and `SKILL.md`: a lesson made now has no cards, so a page can recall a page, or an older lesson that still ends in cards.
7. **Records**: `plugins/viz-os/docs/design.md` (why a scrolling page, why figures own their shape, why no cards, why the attic), `docs/architecture.md`, `docs/testing.md`, `docs/backlog.md`, and an Unreleased entry in `plugins/viz-os/CHANGELOG.md`. Check `README.md` and the manifests' description text for the old words. Delete this plan file. `docs/backlog.md` may need a small merge later with uncommitted work in the main checkout; say so in the report.

**Done when**: `tools/check-all.sh` exits 0; no `type: quiz` in `class/examples`; `grep` finds no "review card" or "click by click" left in class skill text; the deck diff is still empty.

Not in scope: a cold-start test (it needs other agents, so it is the user's call), a version bump, tidying sketch pages.
