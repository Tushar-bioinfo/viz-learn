# To-do: draw the maths, don't describe it

The working list for the "draw math objects" improvement. **One change per session.** When the user says "work on our to-do list" (or similar), pick the first change below whose status is not `done`, and follow "How we work".

Branch: `feat/draw-math-objects`. Target look: `~/.viz-os/reference/old-vs-new/` (OLD = what the plugin made, NEW = what the user approved; its README names the problem each pair fixes). Sample lesson the work started from: `mx-1-what` in the user's scratch workspace (`~/Library/Application Support/Claude/scratch-workspaces/…/lessons/mx-1-what/`); copy it to `out/` before building, never edit it in place.

## Why
A learner lost the thread of a matrix lesson: matrices were described in words but never drawn, colour changes were named but not shown, sliders were never explained, and legends were cluttered. Goal: every lesson shows maths objects visually **by default, on any topic, in fewer YAML tokens**, enforced by lints rather than prose.

## How we work (the user's rules)
1. **Explain first, in plain words and pictures.** Before finalizing any visual or conceptual change, show the user what the learner will see (mock-up or screenshot), the YAML an author writes, its token cost and what the lint says. The user does not read diffs: show before/after pictures of real figures or boards (2–3 examples is enough). Wait for approval.
2. **Implement by delegation** (agent-delegate skill): Opus 5.5 medium implements (`--to claude --model opus --effort medium`); Grok 4.7 high reviews the diff (`--to grok --model grok-4.7 --effort high --role reviewer`; it runs unsandboxed, so check `git status` after it); Terra 6.1 xhigh researches (`--to codex --model gpt-6.1-terra --effort xhigh`, slug not yet tested). If a run's status is not success or its model differs, report `error_message` and `.model` verbatim and stop.
3. After each change: run `tools/check-all.sh` yourself and compare with the previous counts; send Grok's findings back to Opus; show the user before/after; get approval; then commit (and push only when the user says so).
4. **Token efficiency:** a run of the plugin pays for every line in `SKILL.md`, `board.md`, `lesson.md`. Budget for the whole effort: `board.md` ≤ +60 lines, `lesson.md` ≤ +10, `SKILL.md` ≤ +3. New rules go into lints (messages in `lint.md`, read only after an error), not prose. "adv" guidance lives in its own file.
5. Leave the user's own uncommitted edits in `docs/backlog.md` and `docs/release.md` alone. No installs, version bumps or publishing without asking. Never edit the installed plugin cache.
6. When a change is done, set its status here, add one line under "Decisions" for anything someone could undo by mistake, and commit this file with the change.

## Changes
| # | Change | Status |
|---|---|---|
| 1 | Kit bug fixes: legend kept marks with `name`+`label`; `{{…}}` inside `$…$`; a bracket matrix counts as one term; hex colours everywhere (incl. `==#cc6600:text==`) | **done** |
| 1b | Figure key: short legend at top (≤2 words, ≤5 entries); on-plot names ≤2 words, 18 px, beside the middle of arrows/segments, clear of shapes; long text in `says:` → pop-up on hover/tap/Tab; pause-pop-ups button above the step rail; lints for long labels, too many entries, unexplained names, unknown mark keys (unquoted commas) | **done** |
| 2 | Matrices and vectors as board items from `data.json` (below); names in formulas move to pop-up cards (user's "Yours" card look) | **done** |
| 3 | Worked product: `add: {product: {m: X, v: p5, way: rows|cols}}`, up to 4×4, matrix × matrix too; one board step per line; optional tip-to-tail plane mark. **Ask the user:** auto-generated lines vs. author picks which lines to show | todo |
| 4 | Show the real effect: `swatch` item/mark in true colour from numbers, before → after; point to `units` for counts; fact-check lint (colour name must match computed colour: equal red + green, no blue = yellow); `lesson.md`: "show the change, don't name it" | todo |
| 5 | Controls explain themselves: every slider/run has a plain `label` (≤6 words) and a live readout (e.g. `\mat{Xs}` with `derive`); lint warns when nothing on the scene reads the control; one `fmt` per matrix (no mixed 1 / 1.00) | todo |
| 6 | Legends: mostly done in 1b. Remaining: same 2-word / 5-entry lint for **deck** chart legends | todo |
| 7 | Figure defaults: lint every plane/chart axis has a `label`; vector tip label with its numbers by default (`tip: false` hides); `ghost: true` = faint dashed "before", solid "after"; lint hint to use `plane` when both axes share a unit | todo |
| 8 | Layout while scrolling: first **reproduce** the non-sticking figure and clipped equations in real Chrome (in-app browser, widths 1000–1300 in 20 px steps, 90/110 % zoom) and Safari (WebKit install needs the user's OK); headless Chromium did not show it. Then: too-wide side equation scales down (floor ~75 %), then breaks at `=`, only then moves the figure above; never clip; check adds 1280×800 and 1000×800 passes. Known: pca-3's long dot-product line touches the step column's right edge. See `old-vs-new/6-empty-space-and-clipping.png` | todo |
| 9 | Story guidance (≤10 lines in `lesson.md`): one concrete example before any general rule; no invented shorthand without a plain definition; each step's line says what just happened. Lint where checkable | todo |
| 10 | Advanced visuals, triggered by "adv": Terra researches options and token cost; prototype 2–3 on one scene (the leak dial) for the user to pick: smooth motion between run frames, a grid bending from I to X, an animated dot product, image-model pictures/clips/GIFs. Only what the user picks ships, in `class/adv.md` | todo |
| 11 | Prove it's general: rebuild `mx-1-what` (copy in `out/`) and `variance` with the new items; all gates pass; look at every board; report before/after of 3 boards, token counts, old lessons the new lints break, what was not tested. **Ask the user** whether `mx-1-what` becomes a shipped example | todo |

## Change 2 spec (approved direction, look locked)
- Declared once in `symbols`, with optional per-column / per-row colours:
  `X: {tex: X, says: the scanner's mixing rule, kind: matrix, cols: [s3, s2]}`, `p5: {tex: '\vec{x}', says: the orange pixel, kind: vector, rows: [s3, s2]}`.
- Drawn from data: `add: {matrix: X}`, `add: {vec: p5}`, `add: {vec: p5, row: true}`. A TeX shorthand `\mat{X}` / `\mat{X|2}` works inside any `eqn`, `assemble`, note or `$…$`, expands in the shared KaTeX path (deck and sketch get it too) and stays live under sliders. Colours are applied automatically (no hand-written `\htmlClass`).
- Lint "show before using": a `kind: matrix|vector` symbol must be drawn in brackets with its numbers before a teacher line or formula uses it (extends the `Ledger` in `class/scripts/lesson_lint.py`).
- **Locked bracket look** (user picked variant "D, 2 px tighter"): `\left[\mkern-1mu\begin{array}{r…r} … \end{array}<SLOT>\mkern-1mu\right]`, where `<SLOT>` = `\hphantom{-}` only when the object holds a negative number. Numbers right-aligned; one decimal format per object (1 shows as 1.0). `.board .st` gap 12 → 18 px. Do not use `bmatrix*[r]` or `@{}`. (1 mu ≈ 2 CSS px; glyph-to-bracket gap 18 → 16 px.) Preview builds: `out/preview/c2c/` (local, git-ignored).
- **Open question for the user:** optional per-cell labels (`labels: id`)?
- Files: `deck/kit/core.js` / `slides.js` (macro, colours), `class/kit/board.js` (items), `class/scripts/lesson.py` (BOARD fields), `lesson_lint.py`, `board.md`, `lint.md`, a board-gallery scene, cases in `tools/class-cases/`.

## Decisions (do not undo by mistake)
- Legend = short tags at the top; explanations live in `says:` pop-ups, not under the plot (user disliked a key below the figure).
- Pop-up text is 14 px (user's pick in change 2; it was 11 px in 1b), below the page's 15 px floor; recorded in `plugins/viz-os/docs/design.md`.
- Pause button pauses hover only; tap, click and Tab still open a pop-up.
- Change 2: one step gap of 18 px everywhere on a board (`.board .st`, and a stacked figure's line via `margin-bottom: -10px`); `check_board_ui.py` tests 18. An `ops` card is capped so it, the line above it and its buttons fit the window with the scene head in view (it was 2 px over at 1280 × 720 after the gap change).
- Change 2: a row vector is drawn as `<tex> = [ … ]` with no ⊤, as the spec says; `\mat{}` colours ship in `vizos.css` (`.kc-*`), so decks get them; sketch is not tested.
- Change 2 review: a matrix or vector counts as drawn only as `name = [numbers]` (an item, or `X = \mat{X}` inside maths, an `lhs` counts); bare brackets or `\mat` outside `$…$` show numbers but do not license the name. A kind: matrix|vector symbol may not share its TeX. The board's colouring skips `\mkern` sizes.
- Change 2 round 3: no dotted underline on pop-up targets; a target lifts (brighter, a glow in its colour) and the rest of its formula fades (dim). One card look for every pop-up on a board.
- Change 2 round 3: the pop-up card is 50% see-through (rgba(11,12,14,.5)); the user kept it knowing numbers behind show through.
- Change 2 round 3: names in formulas live in pop-ups only (option F): no names under symbols or brackets, no key row; a teacher line still names a plane mark's name (lint).
- Change 2 round 4: every symbol that opens a card has a `short` of ≤ 2 words (error); `says` that adds no words beyond `short` warns. The glow colour is a plain rgba worked out in board.js (a filter with nested var()/color-mix computes to no shadow); keyboard focus also gets an orange ring. An open card follows its term through any redraw by the term's kind and its place among terms of that kind.
