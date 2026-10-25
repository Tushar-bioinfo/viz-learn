# Changelog

## 2.0.0 (2026-10-24)

The goal of this version: another agent, given only the plugin, can build a deck of this quality. Every rule it needs is in `SKILL.md`, `story.md` and `spec.md`, and the gates catch what the rules miss.

**Look**
- The proff-viz 5.0.0 look replaces the glass. The page is near-black, with content on dark square plates, thick grey borders and hard offset shadows. Headlines are in Inter and tags in JetBrains Mono, and one orange marks the answer and what matters now.
- `theme:` is retired. The linter warns when a deck still sets it.
- Series colours: blue `#7fb0ff`, mint `#5fdcc4`, magenta `#c274aa`. The third colour was violet `#c89cf2`, which a red-green colour-blind reader could barely tell from the blue (colour difference ΔE00 2.4 protan, 3.8 deutan). Magenta keeps it at 16.6 and 16.0. Method and all pairs: `docs/design.md`.

**Explaining**
- `ops` slides for matrix steps. Row-wise, column-wise and whole-matrix steps light the row or column being computed, name the shape change (9 × 6 → 9 × 1) and work one row in numbers.
- `dist` visual: a named distribution with its parameters in plain words and its mean and variance with their formulas. It can also show a tail area and a slider on the parameter that is the lesson.
- Every step says what and why: `why:` on working slides, `say:` and `why:` on `calc` lines and `ops` steps, `says:` on computed table columns. The linter warns when one is missing.
- `hook:` on an equation: the one line worth keeping.
- Chapters carry the data's shape (`shape:`), and the chapter slide shows the shape coming in and going out. `chips: false` hides the chapter pipe on the title slide.
- Notation chips: the first slide that uses a symbol such as Σ, a hat, `x_ij` or Φ says what it means. `notation: false` turns them off.
- Charts: log axes, tick lists, and function curves (`fn`) as series and as marks.
- Pictures are made only when the user asks (`scripts/image.py`). They carry no text: the kit draws the labels on them.
- The probe asks 3–4 questions; it asks about length only when the request does not say.
- `story.md` §11: facts about a real method come from its code or paper, with the version read. Where the code and the paper differ, the deck follows the code and says so.
- New example `examples/mageck-rra/`: MAGeCK's robust rank aggregation (RRA) in 30 slides and 4 chapters, with seeded data (`make_data.py`) and an independent recompute (`verify_data.py`). It follows the MAGeCK 0.5.9.5 code.

**Numbers**
- A worked line must add up by hand. A line's `fmt` now rounds only its result. The numbers going in get up to 2 extra digits until the shown result follows from them; if that is not enough, the line reads ≈ and the check warns. Before, 2.648 was rounded to 3 and "3 × 418^1.22 = 4,291" was off by about 10%, and "30,229 − 418 = 29,812" did not add up.
- Number formats are listed in one table in `spec.md` (auto, decimals, significant digits, integers, percent, scientific).

**Check**
- Desktop only. The user did not need phone checks, so the phone pass, `--only` and the lint warnings about columns that "will not read on a phone" are gone. The kit keeps its portrait layout for phones, but nothing checks it.
- "After the answer": every predict answer is opened and the slide is audited again.
- A live pass with animations on. It caught a fit measured while slides were still animating in, which shrank every phone slide to 70% for real viewers while the old check (animations off) saw full size.
- `snaps/numbers.txt` lists every number each slide shows, to compare with the data and the recompute.
- The ≈ warning above.

**Fixes**
- The 70% phone shrink above.
- The fit no longer depends on whether a predict slide's answer is open when it is measured. A fit started for a slide you have already left is dropped.
- A `calc` line too long for one row stacks its parts at the = signs, so no "= result" is left alone at the edge.
- A negative number inside a function gets one pair of brackets: Φ(−4.23), not Φ((−4.23)).
- The linter flags maths typed straight into prose (a bare `^` or `\sigma`): it belongs in `$…$`.

## 1.0.0 (2026-10-24)

First version under the name viz-os (it was developed as "Lucid").

**Look**
- Glass modelled on the iOS 26 home-screen icons, on a plain black page: a cool blue tint that is brightest at the top and lifts again at the bottom, a rim lit at the top left and bottom right, and a soft glow inside the edge. `theme: {glass: clear}` gives neutral smoke glass.
- Frosted chart marks: bars lit at the top with a highlight line, glass beads for dots and lit units, frosted white for context pieces in `parts` bars.
- Series colours near the iOS system blue, mint and magenta, validated against each other and the orange accent for colour-blind readers.
- Smaller headlines (46px on the 1600px stage) and a narrower text column, so charts get more of the slide.

**Explaining**
- No formula from nowhere: an equation shows where it comes from (`from:`, a known form and the move that changes it, in 1–3 links) and its relatives in other topics (`kin:`). The linter warns when `from` is missing.
- Tables one step at a time: the given columns first, then a column, row or single number per step (`build: cols | rows | cells`). The cells a formula reads are underlined in the formula's colours, and any computed number can be tapped for its working.
- Term labels go above the formula for numerators and powers, slide sideways before dropping a row, and never cross each other's leaders.
- The probe asks which formulas the learner knows (footholds for `from:`) and which concrete comparison clicks for them (the main bridge). The learner profile records preferences (`prefers:`) and comparisons that clicked (`connections:`). The linter warns when a bridge comes from outside the learner's anchors.

**Fixes**
- Slides are measured again once the formula fonts have loaded.
- Working lines in tables and equations stay on one line and shrink to fit instead of wrapping.

**Renamed**
- Plugin `lucid` → `viz-os` (`/viz-os:deck`), profile `~/.lucid/` → `~/.viz-os/`, environment variables `LUCID_*` → `VIZOS_*`, kit stylesheet `lucid.css` → `vizos.css`, page global `Lucid` → `VizOS`.
