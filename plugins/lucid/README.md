# Lucid: learning decks that explain, not just show

A Claude Code plugin that turns "teach me X" into a slide deck you can follow from the basics to the advanced part, in the proff black-and-orange Liquid Glass style (grey glass on black, orange headlines) that works on a laptop and a phone.

It was built from three problems with long generated lessons:
1. **Style drift.** Long outputs forget the template. In Lucid the model never writes HTML, CSS or SVG. It writes content in `deck.yaml`, and one fixed kit draws every slide, so the look cannot drift.
2. **Numbers without logic.** Tables and results appear with no equation and no reason. In Lucid every symbol in a formula must have a plain meaning, every computed table column shows its formula and works one row in full, and every arithmetic step names its numbers. The linter fails a deck that breaks this.
3. **Bland stories.** Lists of facts with no thread. Lucid writes a spine first (question, answer, ladder of concepts, arc), links every slide to the one before it with a "but" or a "so", bridges each new idea from something you already know, and makes you predict before it reveals.

## Install
```bash
claude plugin marketplace add Tushar-bioinfo/viz-learn
claude plugin install lucid@viz-learn
pip install pyyaml playwright pillow && playwright install chromium   # build + check
```
Then ask for a deck, for example "make me a lucid deck on maximum likelihood", or run `/lucid:deck <topic>`.
Other agent harnesses (Codex, Cursor, Gemini CLI): link `plugins/lucid/skills/deck` into the harness's skills folder.

## What happens when you ask
1. **Probe.** One message with 3–5 lettered questions: your goal, a quick guess about the topic (a pretest), which prerequisites you already have, which worlds the analogies should come from, and the length. You answer in one line (`1b 2c 3ad 4a 5b`), or say "just build".
2. **Spine.** The question, the one-sentence answer, the ladder of concepts from the ground up, the arc (puzzle, ladder, journey, duel or fix), and one beat per slide.
3. **Slides.** Written as content in `deck.yaml`. Numbers come from data and expressions, never typed.
4. **Build and check.** `build.py` lints the story and writes one self-contained HTML file. `check.py` opens it in Chromium on a desktop and a phone screen, steps through every build step and slider end, measures text contrast on the real pixels, and writes contact sheets.
5. **Remember.** What you know and which analogies work for you go into `~/.lucid/learner.yaml`, so the next deck asks less.

## Slide types
`title` · `chapter` · `predict` (guess, then reveal why) · `idea` (claim + points + visual) · `statement` · `equation` (each term named on the formula, run with numbers; said aloud and in code under + more) · `calc` (named arithmetic steps; aggregates show their recipe, e.g. x̄ = (1/n)Σxᵢ = (8+34+…)/6) · `table` (formula columns revealed one by one, with the worked row) · `bridge` (analogy mapping + where it breaks) · `compare` · `quiz` (flip cards) · `recap` (answer, keep, breaks, next) · `map` (how it connects).
Visuals: charts (line, area, bars, histogram, dots, lollipop, step; marks for lines, bands, spans, points, tail areas, arrows; sliders), parts bars, stat, unit grids, flows, code, formulas, images.

## The look
The palette is proff-viz v5 "mono", and the page is plain black: no wallpaper, glow or grain behind the content, and nothing moves between slides, so the eye stays on what you are studying. Cards are grey glass panes with a lit rim (bright at the top left) and a soft sheen; charts and tables sit on slightly darker "plates". Orange (`#ff5a36`) marks only the slide headline and the one thing that matters now, and one card per slide may carry an orange tint: the answer.

Grey carries context. The series colours are proff's blue `#7fb0ff` and teal `#5fdcc4`, plus pink `#cb85ae`; they pass a colour-blind check against each other and against the orange (see `docs/design.md`). Build steps "materialize" from blur instead of fading.

## Visual first
The visual tells the story; words point at it. Each content slide has one visual that proves its title: a chart with labelled marks, a `parts` bar (a whole split into named pieces), a unit grid, a flow, a hero number, or the formula itself with each term named under it. The linter counts the words on every slide (about 40 on an idea slide, at most 2 short points beside a visual) and warns on an idea slide with no visual. Detail that the slide does not need, like the formula said aloud or its code, sits one tap away under "+ more".

## Files
```
plugins/lucid/
  .claude-plugin/plugin.json
  skills/deck/
    SKILL.md            the loop and the rules (read every time)
    probe.md            questions before building
    story.md            spine, arcs, bridges, maths without mystery, review
    spec.md             deck.yaml reference
    profile.example.yaml
    kit/                lucid.css + core.js (expressions, stats) + chart.js + slides.js + deck.js
    scripts/build.py    yaml -> html, with the story lint
    scripts/check.py    desktop + phone browser audit, contrast, contact sheets
    examples/gallery/            one of every slide type (regression test)
    examples/negative-binomial/  a full 22-slide deck (puzzle arc)
  docs/design.md        why it is built this way, sources, backlog
```

## Working on the plugin
```bash
cd plugins/lucid/skills/deck
python3 scripts/build.py examples/gallery/deck.yaml && python3 scripts/check.py examples/gallery/deck.html
python3 scripts/build.py examples/negative-binomial/deck.yaml && python3 scripts/check.py examples/negative-binomial/deck.html
```
Both examples check at 0 warnings on desktop and phone. Offline machines: `--katex-dir DIR` on `build.py` inlines KaTeX; `--vendor DIR` on `check.py` serves CDN files from disk.

Built on the ideas of [proff-viz](https://github.com/Tushar-bioinfo/proff) L4: build from the ground, name every symbol with an example, audit in a real browser.
