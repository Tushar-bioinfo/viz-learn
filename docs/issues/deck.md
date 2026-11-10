# Deck and shared issues

Open deck renderer, expression engine and browser-check issues, including shared behaviour used by class and sketch. Source labels and numbers refer to [the original backlog](../archive/backlog-before-cleanup.md); they are not new issue numbers. Status is carried forward, not retested by this cleanup.

## Board spike (2026-10-25)
- Board 1: **"+ −0.2" in worked lines.** The deck's `L.work` writes a negative term as "+ −0.2" instead of "− 0.2". Deck behaviour; fixing it changes deck bytes, so it needs its own change and a re-check of all examples.
- Board 3: **Long term labels stack in two rows** on a narrow worked line.
- Board 5: **The "In symbols" tag sits low** when the term names under the formula make the row tall (it centres on the whole row, not on the formula).
- Board 9: **Dots on a category axis sit at the left edge of their band.** The deck's `chart.js` centres bars and lollipops (`sx(x + .5)`) but not `dots` (`sx(x)`). The gallery's problem scene adds 0.5 to x by hand. Deck behaviour; fixing it changes deck bytes.
- Board 12: **Recall cards do not say which lesson they came from.** With two lessons recalled, the quiz mixes their cards with no label. The deck's quiz has no per-card source line; a small `from:` on a card would need a deck kit change.
- Board 15: **A substituted `sum(list) / n` loses its brackets in a worked line.** The deck's `core.js` gives a summed list the top precedence, so with a slash it reads "4.3 + 4.9 + … + 4.4 / 6". The variance lesson writes `mean(cd3)` instead, which draws a proper fraction. Deck behaviour; fixing it changes deck bytes.
- Board 16: **A chart `highlight` on a y axis that does not start at 0 draws its box below the plot,** over the caption. The variance lesson colours the one stick as its own series instead. Deck behaviour.
- Board 20: **Log-axis tick labels mix styles**: "1e-2" beside "10⁻⁴" on the PCA part 2 gap chart. Deck `chart.js`.
- Board 23: **`check.py --all-steps` help promises a photo of every step**, but the check always audits every step and photographs only the last (`deck/scripts/check.py:169`). Fix the help text.

## Two-sample t-test cold starts (2026-10-26)
- t-test 35: **Open: a plain subscript is still dropped from a mean's symbol.** The double-subscript crash is fixed (a braced label such as `cd3_t` now draws `cd3_{t,i}` and `\bar{cd3}_t`), but a symbol given as `x_1` or `x_T` still loses its subscript, so `mean()` of two groups typed `x_1` and `x_2` both read `\frac{1}{n}\sum_i x_i`. The old rule (strip one trailing `_x`) exists so `x_i` does not become `x_i_i`; keeping a label that is not `i`, `j` or `k` would close it, but changes deck bytes.
- t-test 36: **Open, seen again: a sum over a slash still loses its brackets** (item 15). Grok's variance line read `0.09 + 0.09 + 0 / (3 − 1) = 0.09` and the check passed it; Grok caught it by eye and split the add and the divide. The check (or the lesson lint) should flag a worked line whose drawn arithmetic does not give its answer.
- t-test 37: **Open: chart marks with expression strings in a list (`span: y: ['m1 - se', 'm1 + se']`) draw `NaN`** instead of being evaluated or flagged by the lint (Gemini, what-if scene). Either evaluate list entries as expressions or lint them.

## Moran cold start (2026-10-24)
- Moran 1: **Typed numbers are not linted.** A predict slide typed "deviation −3", "average −2" and "(−3) × (−2) = +6" into its `q:` and `why:`. They were right but would go stale if the data changed. The lint should flag a bare number in slide text that is not a `{{…}}` expression or a listed design constant.
- Moran 2: **No spatial map visual.** Spatial omics decks need spots on a tissue map: equal x/y scale, colour by value, optional neighbour links, two maps side by side. (Sketch's `spots` part draws a spot grid as art, not a data map, so this stays open.) The agent faked it with three tercile series and gene B shifted 13 spots right.
- Moran 3: **Table `rows: <data name>` passes the lint, then crashes** in the browser (`rowsSrc.map is not a function`). `ops` accepts `rows: <name>`; a table needs `from: <name>`. Lint it, or accept both.
- Moran 4: **False "one option split at a comma" warning** on a block list when a 1–2-word option is followed by a lowercase option.
- Moran 5: **A step whose formula is its own name draws a line that says nothing** (`z²ᵢ = zᵢ²`). Skip the "name = formula" line when the two are the same.
- Moran 6: **Docs gaps** (each cost the agent a fix loop):
   - `SKILL.md` step 2: what to do when "just build" meets the 25-slide "show the beats and wait" rule (the agent cut a slide to stay at 24).
   - `probe.md`: how to choose the anchor for a bridge with no profile and no probe.
   - `spec.md`, Visuals: a chart inside a `compare` card gets about 140px and will not draw.
   - `spec.md`, Matrix steps: `vec` reads only results made earlier on the same slide; a `store:` matrix can be read by a later slide's `from:`.
   - `spec.md`, ops: prompt to pick a worked cell that is not zero (`focus` / `focusCol`).
- Moran 8: **Science prompts for `story.md`** (the deck missed them; a colleague would ask): state the preprocessing the method assumes (for Moran's I, normalised expression, because spot depth alone can look like pattern); show the whole-matrix version used in practice (spots × genes → one value per gene); say whether a test is one- or two-sided.

## Sketch packaging (2026-10-31)
- Sketch 44: **The deck's `vizos.css` names `docs/design.md` in a comment** (line 20). It is the one shipped path outside attributions, and `tools/check_docs.py` lets it through by name. Rewording it changes every deck's bytes, so do it with the next kit change.
- Sketch 51: **`numbers.txt` drops digits that stand alone in a formula** (exponents, denominators). `deck/scripts/check.py` skips them, so the numbers gate reads less than the page shows. Run A's sheets 8 and 9. Needs the user's OK.

## Scrolling page (2026-11-01)
- Scroll 67: **The deck's four-across quiz has lost its test.** `tools/class-cases/review-8-cards.yaml` was the only case with 7 or 8 cards on a build, and a class lesson can no longer carry a quiz. Add a deck example or a deck case with 8 cards.
- Scroll 81: **Open: deck sliders keep their long labels and "s =" readouts.** Change 5 is class only; `deck/kit/slides.js` `controls()` is untouched so deck builds stay byte-identical.
- Scroll 86: **Open: the chart's own data pop-up on a category axis answers only near a category's left edge.** `bindTip` in `deck/kit/chart.js` measures distance to `sx(x)`, the band's left edge, so pointing at a centred dot (x + 0.5) shows nothing. A deck quirk, left alone so deck pixels stay the same; `tools/check_board_ui.py` walks left from the dot to find it.

## Longer-term ideas (original Older items)
- A light theme: it needs its own series palette, measured the same way on a light plate, and a full check run on all examples. (Sketch's papers are light sheets on a dark wall, with their own measured inks; decks and lessons have no light theme.)
- Animated transitions between two states of the same chart (morphing marks), not just fades.
- Speaker notes / narration export, and an Obsidian companion note writer.
- Tables do not yet take slider-driven rows (calc steps that follow sliders already recompute).
- A small Python port of the expression language, so the lint can evaluate values (today it checks names and functions only; values are checked in the browser).
- A script that compares `numbers.txt` with `data.json` directly, instead of by eye.
- Phone (portrait) layout is unchecked since 2.0.0. If phones matter again, restore a portrait pass in `check.py`.
