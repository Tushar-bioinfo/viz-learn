# viz-os: learning decks that explain, not just show

A Claude Code plugin that turns "teach me X" into a slide deck you can follow from the basics to the advanced part, in an iOS Liquid Glass style on black (blue-tinted glass, orange headlines) that works on a laptop and a phone. Version 1.0.0; see [CHANGELOG.md](CHANGELOG.md).

It was built from three problems with long generated lessons:
1. **Style drift.** Long outputs forget the template. In viz-os the model never writes HTML, CSS or SVG. It writes content in `deck.yaml`, and one fixed kit draws every slide, so the look cannot drift.
2. **Numbers without logic.** Tables and results appear with no equation and no reason, and formulas appear out of nowhere. In viz-os every formula first shows where it comes from (a form you already know and the one move that changes it) and its relatives in other topics; every symbol has a plain meaning written on the formula; tables are worked one step at a time, with each column's formula; and every arithmetic step names its numbers. The linter enforces this.
3. **Bland stories.** Lists of facts with no thread. viz-os writes a spine first (question, answer, ladder of concepts, arc), links every slide to the one before it with a "but" or a "so", bridges each new idea from something you already know, and makes you predict before it reveals.

## Install
```bash
claude plugin marketplace add Tushar-bioinfo/viz-learn
claude plugin install viz-os@viz-learn
pip install pyyaml playwright pillow && playwright install chromium   # build + check
```
Then ask for a deck, for example "make me a viz-os deck on maximum likelihood", or run `/viz-os:deck <topic>`.
Other agent harnesses (Codex, Cursor, Gemini CLI): link `plugins/viz-os/skills/deck` into the harness's skills folder.

## What happens when you ask
1. **Probe.** One message with 3–5 lettered questions: your goal, a quick guess about the topic (a pretest), what you already know (prerequisites, and formulas the new ones can grow from), which comparison makes the core idea click for you (real candidate analogies from your world), and the length. You answer in one line (`1b 2c 3ad 4a 5b`), or say "just build". Your picks decide the analogies, where each formula is shown coming from, and its relatives.
2. **Spine.** The question, the one-sentence answer, the ladder of concepts from the ground up, the arc (puzzle, ladder, journey, duel or fix), and one beat per slide.
3. **Slides.** Written as content in `deck.yaml`. Numbers come from data and expressions, never typed.
4. **Build and check.** `build.py` lints the story and writes one self-contained HTML file. `check.py` opens it in Chromium on a desktop and a phone screen, steps through every build step and slider end, measures text contrast on the real pixels, and writes contact sheets.
5. **Remember.** What you know, how you like things explained, and which comparisons clicked go into `~/.viz-os/learner.yaml`, so the next deck asks less.

## Slide types
`title` · `chapter` · `predict` (guess, then reveal why) · `idea` (claim + points + visual) · `statement` · `equation` (where it comes from and its relatives beside it; each term named on the formula, run with numbers; said aloud and in code under + more) · `calc` (named arithmetic steps; aggregates show their recipe, e.g. x̄ = (1/n)Σxᵢ = (8+34+…)/6) · `table` (one step at a time: the given columns, then a column, row or single number per step, with the cells each formula reads underlined in the formula's colours; tap any number for its working) · `bridge` (analogy mapping + where it breaks) · `compare` · `quiz` (flip cards) · `recap` (answer, keep, breaks, next) · `map` (how it connects).
Visuals: charts (line, area, bars, histogram, dots, lollipop, step; marks for lines, bands, spans, points, tail areas, arrows; sliders), parts bars, stat, unit grids, flows, code, formulas, images.

## The look
The page is plain black: no wallpaper, glow or grain behind the content, and nothing moves between slides, so the eye stays on what you are studying. The panes are glass the way the iOS 26 home-screen icons are: a body tinted cool blue that is brightest at the top and lifts again at the bottom, a thin rim that catches the light at the top left and bottom right, and a soft glow just inside the edge. Marks on the glass are frosted like the icons' glyphs: bars lit at the top, glass beads for dots, frosted white for the parts that are context. `theme: {glass: clear}` gives neutral smoke glass instead. Orange (`#ff5a36`) marks only the slide headline and the one thing that matters now; the answer card is lit orange at the rim.

Grey and frosted white carry context. The series colours sit near the iOS system colours: blue `#4699fe`, mint `#13c097` and magenta `#c85eb4`; they pass a colour-blind check against each other and against the orange (see `docs/design.md`). Headlines are compact (46px on a 1600px stage) so the visual gets the room. Build steps "materialize" from blur instead of fading.

## Visual first
The visual tells the story; words point at it. Each content slide has one visual that proves its title: a chart with labelled marks, a `parts` bar (a whole split into named pieces), a unit grid, a flow, a hero number, or the formula itself with each term named under it. The linter counts the words on every slide (about 40 on an idea slide, at most 2 short points beside a visual) and warns on an idea slide with no visual. Detail that the slide does not need, like the formula said aloud or its code, sits one tap away under "+ more".

## Files
```
plugins/viz-os/
  .claude-plugin/plugin.json
  skills/deck/
    SKILL.md            the loop and the rules (read every time)
    probe.md            questions before building
    story.md            spine, arcs, bridges, maths without mystery, review
    spec.md             deck.yaml reference
    profile.example.yaml
    kit/                vizos.css + core.js (expressions, stats) + chart.js + slides.js + deck.js
    scripts/build.py    yaml -> html, with the story lint
    scripts/check.py    desktop + phone browser audit, contrast, contact sheets
    examples/gallery/            one of every slide type and mode (regression test)
    examples/negative-binomial/  a full 22-slide deck (puzzle arc)
  docs/design.md        why it is built this way, sources, backlog
  CHANGELOG.md
```

## Working on the plugin
```bash
cd plugins/viz-os/skills/deck
python3 scripts/build.py examples/gallery/deck.yaml && python3 scripts/check.py examples/gallery/deck.html
python3 scripts/build.py examples/negative-binomial/deck.yaml && python3 scripts/check.py examples/negative-binomial/deck.html
```
Both examples check at 0 warnings on desktop and phone. Offline machines: `--katex-dir DIR` on `build.py` inlines KaTeX; `--vendor DIR` on `check.py` serves CDN files from disk.

Built on the ideas of [proff-viz](https://github.com/Tushar-bioinfo/proff) L4: build from the ground, name every symbol with an example, audit in a real browser.
