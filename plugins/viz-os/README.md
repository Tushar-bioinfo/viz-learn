# viz-os: learning decks that explain, not just show

An agent plugin (Claude Code, Codex, Cursor, Grok, Muse, Antigravity, Gemini) that turns "teach me X" into a slide deck you can follow from the basics to the advanced part. It is made for a laptop or desktop screen, in the flat dark look of proff-viz (square blocks, thick grey borders, one orange). Version 2.0.0; see [CHANGELOG.md](CHANGELOG.md).

It was built from four problems with long generated lessons:
1. **Style drift.** Long outputs forget the template. In viz-os the model never writes HTML, CSS or SVG. It writes content in `deck.yaml`, and one fixed kit draws every slide, so the look cannot drift.
2. **Numbers without logic.** Tables and results appear with no equation and no reason, and formulas appear out of nowhere. In viz-os every formula shows where it comes from and its relatives in other topics. Every symbol has a plain meaning on the formula, and every working step says what it does and why. Every worked line must add up by hand. The linter and the browser check enforce this.
3. **Matrices with no direction.** You cannot see which rows or columns a step reads, or how the data changes shape. An `ops` slide lights the row or column being computed, names the shape change (9 × 6 → 9 × 1), and works one row in numbers. A chart then shows the result.
4. **Bland stories.** Lists of facts with no thread. viz-os writes a spine first (question, answer, ladder of concepts, arc). It links every slide to the one before with a "but" or a "so", bridges each new idea from something you know, and makes you predict before it reveals.

## Install
```bash
claude plugin marketplace add Tushar-bioinfo/viz-learn
claude plugin install viz-os@viz-learn
pip install pyyaml playwright pillow && playwright install chromium   # build + check
```
Then ask for a deck, for example "make me a viz-os deck on maximum likelihood", or run `/viz-os:deck <topic>`.
Codex, Cursor, Grok Build, Muse Code, Antigravity CLI and Gemini CLI each have their own manifest here; the install line for each is in the [repository README](../../README.md). The skill is written so any agent can follow it from its own folder alone.

## What happens when you ask
1. **Probe.** One message with 3–4 lettered questions: your goal, a quick guess about the topic (a pretest), what you already know (including formulas the new ones can grow from), and which comparison makes the core idea click. You answer in one line (`1b 2c 3ad 4a`), or say "just build".
2. **Spine.** The question, the one-sentence answer, the ladder of concepts from the ground up, the arc (puzzle, ladder, journey, duel or fix), and one beat per slide.
3. **Facts and data.** For a real method, the agent reads its code or paper and notes the version. A seeded script makes the deck's numbers (`make_data.py` → `data.json`), and independent code recomputes them (`verify_data.py`).
4. **Slides.** Content in `deck.yaml`. Every number on a slide is an expression over the data (`{{name|fmt}}`), never typed.
5. **Build and check.** `build.py` lints the story and writes one self-contained HTML file. `check.py` opens it in Chromium on a desktop screen (1440 × 900). It visits every build step, slider end and opened answer, measures text contrast on the real pixels, and writes a contact sheet plus `numbers.txt`, every number each slide shows. The kit also has a portrait layout for phones, which is not checked.
6. **Look.** The agent opens the contact sheet and answers a short review. A clean check does not prove the deck teaches.
7. **Remember.** What you know, how you like things explained and which comparisons clicked go into `~/.viz-os/learner.yaml`, so the next deck asks less.

A deck is done only when four gates pass: lint (0 errors, 0 warnings), browser check (0 warnings on a desktop screen), numbers (seeded, recomputed independently, and no worked line that fails to add up) and eyes (contact sheet opened and reviewed).

## Slide types
`title` · `chapter` (shows the data's shape coming in and going out) · `predict` (guess, then reveal why) · `idea` (claim + visual) · `statement` · `equation` (where it comes from and its relatives beside it; each term named on the formula and run with numbers; said aloud and in code under "+ more") · `calc` (named arithmetic steps, each with what and why) · `ops` (matrix steps: row-wise, column-wise or whole-matrix, with the shape change) · `table` (one column, row or number per step; tap any number for its working) · `bridge` (analogy mapping + where it breaks) · `compare` · `quiz` (flip cards) · `recap` · `map` (how it connects).

Visuals: charts (line, area, bars, histogram, dots, lollipop, step; marks for reference lines, bands, spans, points, tail areas, arrows, curves; log axes; sliders), `dist` (a named distribution with its parameters in plain words, its mean and variance, and a slider), `parts` bars, stat, unit grids, flows with the data's shape at each stage, code, formulas, and images with labels drawn by the kit. New notation gets a small chip that says what it means the first time it appears.

## The look
Flat and square, after proff-viz 5.0.0: a near-black page (`#0b0c0e`), content on dark plates (`#171819`) with thick grey borders and hard offset shadows, heavy Inter headlines and JetBrains Mono tags. Nothing is glass and nothing glows. Orange (`#ff5a36`) marks only the answer and the one thing that matters now.

Series colours: blue `#7fb0ff`, mint `#5fdcc4` and magenta `#c274aa`. Measured in a simulation of colour blindness (CIEDE2000 colour difference after the Machado 2009 simulation at full severity), every pair of these and the orange stays at least 15.9 apart for red-green colour blindness and 10.7 for blue-yellow. Every series colour has at least 5.4:1 contrast on the plate. The weakest pair is mint against the grey used for reference lines (6.8–7.7 for red-green colour blindness); reference lines are also dashed, so they do not rely on colour alone. Details in [docs/design.md](docs/design.md).

## Files
```
plugins/viz-os/
  .claude-plugin/plugin.json   manifests: Claude Code (also read by Grok and Muse)
  .codex-plugin/plugin.json    Codex
  .cursor-plugin/plugin.json   Cursor
  plugin.json                  Antigravity CLI
  gemini-extension.json        Gemini CLI
  skills/deck/
    SKILL.md            the loop, the gates and the rules (read every time)
    probe.md            questions before building
    story.md            spine, arcs, bridges, maths without mystery, real-method facts, review
    spec.md             deck.yaml reference: every field, visual, chart mark, function and number format
    profile.example.yaml
    kit/                vizos.css + core.js (expressions, stats) + chart.js + slides.js + ops.js (matrix steps) + deck.js
    scripts/build.py    yaml -> html, with the story lint
    scripts/check.py    desktop browser audit, contrast, contact sheet, numbers.txt
    scripts/image.py    optional picture, only when the user asks (Codex CLI, or --print for the prompt)
    examples/mageck-rra/         a real method: 30 slides in 4 chapters, matrices worked row by row;
                                 make_data.py writes data.json, verify_data.py recomputes it independently
    examples/negative-binomial/  a puzzle-arc deck: distributions, sliders, from: and kin:
    examples/gallery/            one of every slide type (regression test)
  docs/design.md        why it is built this way, with sources
  CHANGELOG.md
```

## Working on the plugin
Start with the repository's `AGENTS.md`. `tools/check-all.sh` rebuilds and checks every example; each build should end with `0 errors  0 warnings`, each check with `check: 0 warnings`, and `verify_data.py` with `ALL OK`. Offline machines: `--katex-dir DIR` on `build.py` inlines KaTeX; `--vendor DIR` on `check.py` serves CDN files from disk. The fonts come from Google Fonts.

Built on the ideas of [proff-viz](https://github.com/Tushar-bioinfo/proff) L4: build from the ground, name every symbol with an example, audit in a real browser.
