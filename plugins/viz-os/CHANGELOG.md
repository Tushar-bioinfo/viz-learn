# Changelog

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
