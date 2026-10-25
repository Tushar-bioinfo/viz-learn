# Backlog

Open problems, most important first. When you fix one, delete it here and add a line to `plugins/viz-os/CHANGELOG.md`.

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
