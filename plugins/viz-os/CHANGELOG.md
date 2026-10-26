# Changelog

## 2.1.1 (2026-10-26)

- Fixed: `mean()`, `var()`, `sum()` and `sd()` of a list whose name carries a label (`cd3_t`) crashed KaTeX with "Double subscript". The symbol now keeps the label beside the index, `cd3_{t,i}`, and the mean reads `\bar{cd3}_t`, so two groups stay apart on the page. Both 2026-10-26 cold starts hit it. Test case `mean-labelled-list`. No working deck changes: only symbols that used to fail take the new path.

## 2.1.0 (2026-10-26)

Adds the `class` skill: board lessons, series memory and recall, and a three-part PCA series. Deck output is unchanged.

**Class lesson lint (U5)**
- `class/scripts/lesson_lint.py` holds every lesson rule. New: the lesson's beat order and size, a think stop at least every 6 steps, a `lead` on each scene after the plan, at most 24 words per teacher line, no symbol before its number, formulas built from numbers worked by hand, typed numbers (with the data name they match), review cards that read only `data.json`, and three deck failures as errors (`rows:` given a data name, a line whose formula is its own name, a worked name read in a later scene).
- `tools/check_class.py` runs the class test cases (`clean`, `builds`, `not:` or a message to find); `check-all.sh` calls it.

**Class memory, home data and recall (U6)**
- `class/scripts/memory.py` keeps series memory in `<viz-os home>/series/<name>.yaml` (episodes, home data, open loops) and adds history lines and a `home:` pointer to `learner.yaml`. Every write is idempotent.
- `class/scripts/home.py` writes seeded toy tables (cells × markers, genes × samples) in their source layout, and `--check` proves a file regenerates byte for byte. Fixture: `class/examples/home/cells.json`.
- `recall:` in a lesson opens it, right after the title, with a quiz of up to 5 of the earlier lessons' review cards, showing the numbers those lessons showed. A missing path, a card that reads a name its lesson's data lacks, or a later `episode:` with no `recall:` is flagged.
- `tools/check_memory.py` tests memory and home data in a throwaway home; `check-all.sh` calls it. `check_class.py` can now match text in the page as the browser drew it.

**Class skill documents (U7)**
- `class/SKILL.md`: the loop (profile and memory, a 3-question probe, spine, home data, scenes, build, check, look, reply, remember), the five gates, the rules that never bend, where it runs, token discipline.
- `class/lesson.md`: the beats and their order, numbers before symbols, the 19 teaching moves with when to use each, voice, pacing (with the source course's time share as a soft guide), series, review cards, and the eyes and pedagogy review.
- `class/board.md`: every top-level key, scene field, step field, item, plane mark and control, with an example each; series, recall and home; every lesson lint message with its fix; YAML gotchas.
- `tools/check_docs.py` fails when `board.md` leaves out a field `board.js` reads, or a beat, step field, item, plane mark or top-level key the lint knows, or when a class skill file points at `docs/`; `check-all.sh` calls it.

**Variance lesson (U8)**
- `class/examples/variance/`: the first full lesson, 13 board scenes on six T cells from the home table `cells` (now 12 cells): two donors with the same mean, raindrops on patios, the mean and distances by hand, squares as real squares, the formula built from those numbers, a run that tests n − 1 over 5,000 samples, a what-if with a slider and a doublet toggle, limits, and an SD tease. `make_data.py` is seeded; `verify_data.py` recomputes every number with numpy.
- The lint now names a field a `calc`, `col`, `eqn`, `assemble` or `params` does not take. A comma inside an unquoted `{ }` value used to split it silently into a second key and cut the line short. Test case `item-field-comma`.
- The board's overflow check measures without the 8px rise of items still to come; a picture that fills its column no longer reads as overflow before it appears.

**Perceptron-trick lesson (U9)**
- `class/examples/perceptron-trick/`: 14 board scenes on eight cells (four T, four B) from the home table `cells`, in the order of the source video's 16 teaching segments: a bad first line, which side is T by hand, a what-if with three weight sliders, the trick by hand on c5 (a full step, then η = 0.1), the score as a formula with x₀ = 1, a run of 12 updates with a stop on the one plus case, the two rules as one, the weights as a slope and a crossing, limits (it stops at the first line that works; one mislabelled cell keeps it going for 1,000 epochs), and a thymocyte tease that no single line can split. `verify_data.py` checks every update with numpy and separability with a linear program (scipy).

**PCA series (U10)**
- `class/examples/pca-1-what/`, `pca-2-how/`, `pca-3-why/`: a three-part series on six cells of the home table `cells`, each opening with recall cards from the parts before. Part 1: shadows on a tilted line, the spread at every angle, PC1 as the line where the shadows spread most. Part 2: covariance by hand, the spread along any arrow from three numbers, the covariance matrix C, PC1 as the arrow C only stretches, and the repeats that find it. Part 3: any arrow split into PC parts, its spread as a²λ₁ + b²λ₂, CD14 as a third marker, the 3 × 3 C, scores, what keeping one PC loses, and how many to keep.
- `board.md` documents `notation: false` on an `ops` item.

**Wiring (U11)**
- `tools/check_manifests.py` also requires `skills/class/SKILL.md`.
- Built `lesson.html` files in `class/examples/` are not tracked (`.gitignore`); `tools/check-all.sh` rebuilds them.
- The plugin README, `docs/architecture.md` and `docs/testing.md` cover the class skill, and `docs/testing.md` keeps the byte-identical sequence for later `build.py` changes.

**Cold-start fixes (U12)**
- Two cold starts on Grok Build (grok-4.7): a PCA spine and a z-score lesson. Both passed; their notes led to these fixes.
- New lesson lints: a lesson with no `summary` scene, a `what-if` scene with no picture for its change to move, and an `assemble` written as `expr` whose symbols were never worked by hand (before, only its left side was checked). Cases `no-summary`, `what-if-no-picture`, `assemble-expr-not-by-hand`.
- Board kit: an `assemble` or worked-line formula that reads `at(list, i)` no longer fails with "cannot read" (only the author's own `tex` is read for `{{…}}` now). Case `assemble-at`.
- Deck charts: a `bars` series draws negative values below zero; before, they were not drawn.
- Docs: `learner`'s shape at the spine step; `~/.viz-os` means `$VIZOS_HOME` when it is set; "just build" skips only the probe, and a series still waits for its OK; one `lesson.yaml` per series lesson at the spine; an example's topic is built fresh, never copied. `memory.py`'s usage shows `--gates "5/5"`; the deck's long-lead warning gives the real limit.

**Deck fixes found while building the class skill**
- The lint accepts an image's `alt`, which `spec.md` documents and the kit reads.
- A list aggregate over a symbol that already has a subscript writes `x_i`, not `x_i_i`.
- A quiz with 7 or 8 cards goes four across with smaller type instead of shrinking the slide below 80%.
- The lint stops an expression with unmatched brackets. In a `{...}` or `[...]` YAML line an unquoted `at(xs, t)` splits at the comma; it used to fail only in the browser.
- The browser check skips a control with no range (a lint error already) instead of crashing.

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

**Install**
- One repository, every agent: manifests for Claude Code, Codex, Cursor, Grok Build, Muse Code, Antigravity CLI and Gemini CLI, all at the same version (`tools/check_manifests.py`). Install lines are in the repository README.
- Start-up notes for agents working on the plugin: `AGENTS.md` (also `CLAUDE.md`, `GEMINI.md`) and `docs/` (architecture, testing with the cold-start test, backlog, release), plus `tools/check-all.sh`.

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
