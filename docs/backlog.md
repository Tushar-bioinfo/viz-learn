# Backlog

Open problems, most important first. When you fix one, delete it here and add a line to `plugins/viz-os/CHANGELOG.md`.

## From the class skill board spike (2026-10-25)
1. **"+ −0.2" in worked lines.** The deck's `L.work` writes a negative term as "+ −0.2" instead of "− 0.2". Deck behaviour; fixing it changes deck bytes, so it needs its own change and a re-check of all examples.
2. **The lesson lint does not check `col` expressions yet.** A wrong name there shows only in the browser. (Plane marks are linted since U4.) A `col` also cannot read an earlier `col`'s key on the same table ("unknown name" in the browser); the perceptron lesson writes the score's full expression again in its `ŷ` column.
3. **Long term labels stack in two rows** on a narrow worked line.
4. **A row calc writes `x_i`, not `x_1`.** `d_1 = x_i − x̄` for row 0 reads oddly; the row's index should replace `i` in the symbol.
5. **The "In symbols" tag sits low** when the term names under the formula make the row tall (it centres on the whole row, not on the formula).
6. **The check audits a run only at its two ends and at the click stops.** The middle frames (3 to 10 of the gallery's 12) were swept once by hand in U4, all clean, but `check.py` does not do it. A sweep of every frame for a run of 20 or fewer would close this.
7. **A run's length is typed in the YAML (`run: 12`) and nothing ties it to the data.** If `make_data.py` writes 11 frames, `at(w0_trace, 11)` gives nothing: a point then warns "outside the box", but a line just drops out of the picture and only its legend says so. The lint could compare `run` with the length of each list read through `at(…, t)`.
8. **`when:` works on plane marks only.** A chart mark or a worked line cannot yet appear for some frames and not others.
9. **Dots on a category axis sit at the left edge of their band.** The deck's `chart.js` centres bars and lollipops (`sx(x + .5)`) but not `dots` (`sx(x)`). The gallery's problem scene adds 0.5 to x by hand. Deck behaviour; fixing it changes deck bytes.
10. **The symbol ledger matches TeX as text.** A symbol written `d_{1}` in prose and `d_1` under `symbols` is not seen, so its "symbol before number" error is missed. A KaTeX parse of both sides would close it.
11. **R22's "at least one card from an angle the lesson did not take" cannot be linted.** It stays a `lesson.md` rule and an eyes-gate check.
12. **Recall cards do not say which lesson they came from.** With two lessons recalled, the quiz mixes their cards with no label. The deck's quiz has no per-card source line; a small `from:` on a card would need a deck kit change.
13. **A lesson's `home:` key is not checked.** `board.md` sets the convention (`data.json` holds `"home": {name, provenance}` copied from the home file), but no lint ties `home: cells` to that block yet. U8 is its first real use; lint it after.
14. **`home.py` clips negative marker draws to 0.0**, so a few cells read exactly 0.0 (as real cytometry exports often do). If a board looks odd with a bare 0.0, pick another seed rather than change the recipe (a recipe change needs a version bump in `home.py`).
15. **A substituted `sum(list) / n` loses its brackets in a worked line.** The deck's `core.js` gives a summed list the top precedence, so with a slash it reads "4.3 + 4.9 + … + 4.4 / 6". The variance lesson writes `mean(cd3)` instead, which draws a proper fraction. Deck behaviour; fixing it changes deck bytes.
16. **A chart `highlight` on a y axis that does not start at 0 draws its box below the plot,** over the caption. The variance lesson colours the one stick as its own series instead. Deck behaviour.
17. **A board chart in the picture column is short** (about 110px of plot in a 480px column) because the deck chart keeps its aspect from the width. Readable, but a run or what-if chart would teach better taller.
18. **Plane points coloured `by:` a field show one legend entry per value, even when two values share a colour and only one has a label.** The thymocyte tease showed bare "SP8" and "DP" entries; it now colours by `y` (two values). Entries with the same colour and no label could be merged.
19. **The fit zoom never grows back.** When a step stacks a worked line at full width, the deck's fit shrinks the whole scene, and it stays shrunk on later steps even when they would fit. Lessons avoid it with fewer worked lines per scene or shorter ones. Deck behaviour (`fitSlide`).
20. **Log-axis tick labels mix styles**: "1e-2" beside "10⁻⁴" on the PCA part 2 gap chart. Deck `chart.js`.
21. **`{{…}}` inside `$…$` in a `note` is not filled in**; KaTeX then fails to parse it. Put the number outside the maths, or in a worked line.
22. **A worked line shows its inputs with extra digits** (4.4747², 2.7268²). The deck gives inputs up to 2 extra digits so a line adds up by hand (`design.md`); on a board the inputs then look noisier than the answer.
23. **`check.py --all-steps` help promises a photo of every step**, but the check always audits every step and photographs only the last (`deck/scripts/check.py:169`). Fix the help text.
24. **The deck's notation chip (`x_ij` = …) can spill out of a narrow `ops` card on a board.** `notation: false` hides it; the board audit could warn first.
25. **The PCA `verify_data.py` files were written by the same model as `make_data.py`** (plan KTD21 asked for a Grok worker from a prose spec). They use numpy's `eigh` and `cov` against pure-Python power iteration and closed forms, so the code paths are separate, but the author is not. An independent rewrite would close it.

## From the 2026-10-25 class cold start (PCA spine, grok-4.7)
26. **Fixed: six doc gaps the spine worker named.** Step 2 used `learner` without its shape; `~/.viz-os` vs `$VIZOS_HOME` was unstated; "never reuse an example's topic" gave no rule when the user asks for PCA; "just build" did not say the series OK still waits; a missing summary scene was not linted; a series spine did not say one file per lesson. Fixed in `class/SKILL.md`, `board.md`, the README, and a new `no summary scene` lint (case `no-summary`).
27. **The spine's lesson 3 has no `data` scene** ("the table does not change") and builds two formulas. Allowed today; watch whether a built lesson 3 then works the 3-marker numbers without the table on the board.

## From the 2026-10-25 class cold start (z-score lesson, grok-4.7)
28. **Fixed: negative bars were not drawn** (`deck/kit/chart.js`, `bars`). The z-score lesson's last picture showed only c4's CD14 bar; its CD3 (−0.81) and CD19 (−0.58) bars were missing.
29. **Fixed: `at()` in an `expr` assemble failed** with `text {{x}_{3}}: cannot read "}"`. `formTex` in `class/kit/board.js` ran the `{{…}}` reader over TeX the kit made. Case `assemble-at`.
30. **Fixed: an `expr` assemble checked only its left side** against the by-hand rule. Case `assemble-expr-not-by-hand`.
31. **Fixed: a what-if scene could move only numbers.** The z-score slider changed a table and three values, and half the board stayed empty. `lesson.md` now asks for a picture; the lint warns. Case `what-if-no-picture`.
32. **Fixed: small doc mismatches**: `memory.py` usage gave four named gates where `SKILL.md` records `5/5`; the deck's long-lead warning said ≤ 12 but fires past 14.
33. **Open: −0.00 prints as a number.** The worker stored c6's T-cell score as exactly 0 in `make_data.py` to hide "−0.00". The kit's number formatting could print a rounded zero without its sign.
34. **Open (judgement): the z-score lesson's picture scene stacks cells on an arbitrary y axis** (`yy`), and its what-if lead compares a level with a score in different units. Both pass every gate; a reviewer caught them by eye.

## From the 2026-10-26 class cold starts (two-sample t-test; gemini-3.8-flash and grok-4.7, both high)
35. **Open: `mean()` / `var()` of a list whose symbol already has a subscript break KaTeX** ("Double subscript", `\mathrm{cd3}_{\mathrm{t}}_i`). Both models hit it. `deck/kit/core.js:311` strips a trailing `_{…}` only when the braces hold no braces, so `_{\mathrm{t}}` stays and `_i` is added after it. Workarounds the workers used: a plain `symbols: {tex: x_1}`, or one-cell sums.
36. **Open, seen again: a sum over a slash still loses its brackets** (item 15). Grok's variance line read `0.09 + 0.09 + 0 / (3 − 1) = 0.09` and the check passed it; Grok caught it by eye and split the add and the divide. The check (or the lesson lint) should flag a worked line whose drawn arithmetic does not give its answer.
37. **Open: chart marks with expression strings in a list (`span: y: ['m1 - se', 'm1 + se']`) draw `NaN`** instead of being evaluated or flagged by the lint (Gemini, what-if scene). Either evaluate list entries as expressions or lint them.
38. **Doc gaps the workers named:** `board.md` `think:` has no indented example (Gemini put `q:`/`a:` at step level and got "unknown step field"); `board.md` review cards do not say that 7–8 cards switch to the dense 4-column layout while 5–6 cards at 3 columns often shrink; `class/SKILL.md` step 7 shows `--home ~/.viz-os/home/cells.json`, which ignores `$VIZOS_HOME` because the shell expands `~` first; `board.md` controls do not say the contact sheet shows a slider at its start value only.
39. **Judgement (eyes gate):** Gemini's problem board showed each experiment's group means as single dots, so the "same gap, different noise" claim had no spread on screen; its variance board used `ss1` before showing the squares. Grok kept a 2-cell B group (Welch df ≈ 1.96) without saying how shaky a 2-point variance is, and skipped the run beat. Grok alone named circularity (groups labelled by the CD3 gate) and cells-as-samples (pseudoreplication); Gemini's limits named only doublets.
40. **Harness: `muse plugins marketplace update` reports success but keeps the old snapshot** (2.0.0 stayed after 2.1.0 was pushed; `install` then says "already installed from a different source"). Fix used on 2026-10-26: `muse plugins remove viz-os`, `marketplace remove viz-learn`, `marketplace add …`, `install viz-os@viz-learn`.

## From the 2026-10-24 cold-start test (Moran's I, 2.0.0)
1. **Typed numbers are not linted.** A predict slide typed "deviation −3", "average −2" and "(−3) × (−2) = +6" into its `q:` and `why:`. They were right but would go stale if the data changed. The lint should flag a bare number in slide text that is not a `{{…}}` expression or a listed design constant.
2. **No spatial map visual.** Spatial omics decks need spots on a tissue map: equal x/y scale, colour by value, optional neighbour links, two maps side by side. The agent faked it with three tercile series and gene B shifted 13 spots right.
3. **Table `rows: <data name>` passes the lint, then crashes** in the browser (`rowsSrc.map is not a function`). `ops` accepts `rows: <name>`; a table needs `from: <name>`. Lint it, or accept both.
4. **False "one option split at a comma" warning** on a block list when a 1–2-word option is followed by a lowercase option.
5. **A step whose formula is its own name draws a line that says nothing** (`z²ᵢ = zᵢ²`). Skip the "name = formula" line when the two are the same.
6. **Docs gaps** (each cost the agent a fix loop):
   - `SKILL.md` step 2: what to do when "just build" meets the 25-slide "show the beats and wait" rule (the agent cut a slide to stay at 24).
   - `probe.md`: how to choose the anchor for a bridge with no profile and no probe.
   - `spec.md`, Visuals: a chart inside a `compare` card gets about 140px and will not draw.
   - `spec.md`, Matrix steps: `vec` reads only results made earlier on the same slide; a `store:` matrix can be read by a later slide's `from:`.
   - `spec.md`, ops: prompt to pick a worked cell that is not zero (`focus` / `focusCol`).
7. **Not reproduced:** an animation-fit warning ("fits at 97%, not 95%") on a predict slide with a chart. It went away when the chart moved off the slide.
8. **Science prompts for `story.md`** (the deck missed them; a colleague would ask): state the preprocessing the method assumes (for Moran's I, normalised expression, because spot depth alone can look like pattern); show the whole-matrix version used in practice (spots × genes → one value per gene); say whether a test is one- or two-sided.

## Older items
- A light theme: it needs its own series palette, measured the same way on a light plate, and a full check run on all examples.
- Animated transitions between two states of the same chart (morphing marks), not just fades.
- Speaker notes / narration export, and an Obsidian companion note writer.
- Tables do not yet take slider-driven rows (calc steps that follow sliders already recompute).
- A small Python port of the expression language, so the lint can evaluate values (today it checks names and functions only; values are checked in the browser).
- A script that compares `numbers.txt` with `data.json` directly, instead of by eye.
- Phone (portrait) layout is unchecked since 2.0.0. If phones matter again, restore a portrait pass in `check.py`.
