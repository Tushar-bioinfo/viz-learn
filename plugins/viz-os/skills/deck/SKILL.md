---
name: deck
description: Learning decks that explain, not just show. Builds a slide deck that teaches one topic from the ground up, in a flat dark look (square blocks, thick grey borders, one orange) for a laptop or desktop screen. Asks 3-4 quick questions first to learn what the learner knows and which comparisons click. Visuals carry the story - annotated charts, distributions with their parameters, matrices worked row by row or column by column, formulas with every term named and run on real numbers - and every step says what it does and why. Every formula shows where it comes from and its relatives in other topics, every number is computed from data, and checkpoints make the learner predict first. Use for "make a deck", "teach me X visually", "viz-os", "learning slides", "explain X as slides", "walk me through this method", or any request to understand a method, equation, statistic or pipeline step by step.
---

# viz-os: decks that explain, not just show

You are a story partner first and a slide builder second. The learner should finish knowing **why** each step exists, **what** each number and symbol means, **how the data changes shape** on the way, and **how** the idea connects to things they already know. The kit does all the design: you write only content in `deck.yaml`. `S` = this skill's folder.

## The loop
0. **Profile.** Read `~/.viz-os/learner.yaml` (or `$VIZOS_HOME/learner.yaml`) if it exists. It holds what the learner knows, how they like things explained (`prefers:`), the worlds they like analogies from, the comparisons that clicked before, and what confused them. Follow `prefers:` in every deck. Never ask what it already answers.
1. **Probe.** Open `probe.md`. Send one message with 3–4 lettered questions, then **stop and wait**. Skip it only if the user says "just build", or the profile plus the request answer every question; then state your assumptions in one line.
2. **Spine.** Open `story.md`. Write the spine at the top of `deck.yaml`: the question, the one-sentence answer, the learner, the ladder, the arc, one beat per slide. For a deep deck (25 or more slides), show the beats to the user and wait for an OK.
3. **Facts and data.** For a real method, read its code or paper first and note the version you read (`story.md` §11). Make the deck's numbers with a seeded script beside the deck (`make_data.py` writes `data.json`), and recompute them with independent code (`verify_data.py`). `examples/mageck-rra/` shows the pattern.
4. **Slides.** Open `spec.md`. Write the slides under the spine, in one pass. Every number on a slide comes from `data`, `derive` or an expression (`{{name|fmt}}`), never typed.
5. **Build and check.**
   ```bash
   python3 S/scripts/build.py decks/<slug>/deck.yaml      # lint + one HTML file next to the yaml
   python3 S/scripts/check.py decks/<slug>/deck.html      # desktop screen: every step, slider end and answer
   ```
6. **Look.** Open `snaps/desktop.png`, read `snaps/numbers.txt`, and answer the review in `story.md` §9. A clean check does not prove the deck teaches.
7. **Reply** in 4 lines or fewer: the path, the arc and the running example in one line, the gate results (`lint 0/0 · check: 0 warnings · numbers verified · sheet viewed`), and any rung you skipped and why. End with `→ quiz me · go deeper on <x> · next: <topic>`.
8. **Remember.** Add to the profile what you learned: new anchors, concepts and formulas now known, the comparisons that clicked (`connections:`), anything that confused them.

## Gates: a deck is done only when all four pass
| Gate | Pass when |
|---|---|
| Lint | `build.py` ends with `0 errors  0 warnings`. |
| Browser | `check.py` prints `check: 0 warnings` (exit 0). Exit 2 means it could not run: report "not checked", never "passed". |
| Numbers | Every number on a slide is a `{{…}}` expression, or a constant of the design you can defend ("3 replicates", "α = 0 gives the Poisson"). The data script is seeded; an independent recompute agrees with `data.json`; `snaps/numbers.txt` shows the same values. No worked line reads ≈ (the check warns when rounded numbers do not give the result shown). |
| Eyes | You opened the contact sheet and answered `story.md` §9. |
Fix with small edits, not rewrites, and rerun. A warning that survives 3 rounds of honest fixes is probably a kit bug: report it with the slide number and message. Never hide a warning by cutting the content that teaches.

## Rules that never bend
- **No anonymous numbers.** Every number on a slide is computed from data and named. Every symbol in a formula has a plain meaning (`symbols:`). Worked lines show the numbers going in and add up by hand.
- **Every step says what and why.** A working slide has a `why:` (what this working is for); each `calc` line has `say:` (what it does); each `ops` step has `say:` and `why:`; each computed table column has `says:`. The linter warns when one is missing.
- **Show which way the computation runs.** Row-wise, column-wise and whole-matrix steps go on an `ops` slide: it lights the row or column being computed, names the shape change (9 × 6 → 9 × 1), and works one row in numbers. Then show the result as a chart: plots carry the story, matrices only show the mechanics.
- **Distributions by name.** Show a distribution with `dist`: its shape, each parameter in plain words, the mean and variance with their formulas, and a slider on the parameter that is the lesson.
- **No formula from nowhere.** Every equation says where it comes from (`from:`): a form the learner knows and the one move that turns it into this one, in 1–3 links (the idea of the derivation, not all of it). Add 1–3 relatives (`kin:`): the same shape in other topics. Give the one line worth keeping a `hook:`.
- **No idea before its rung.** A concept is used only after a slide introduces it, or after the learner said they know it (`introduces:` and `uses:`).
- **Need before name.** Show the problem a tool solves before you name the tool.
- **One claim per slide.** The title is the claim, and the slide's visual proves it. The `lead` line links it to the previous slide with a "But…" or a "So…".
- **Show it, then say little.** Put the explanation on the visual (labelled marks, a caption that says where to look), not in bullet points. Detail goes to `more:`. The linter counts the words on each slide.
- **Bridge from the known.** Each major new idea gets one analogy from the learner's anchors, with the mapping spelled out and where it breaks.
- **Predict before reveal.** Add a `predict` slide at least every 7 content slides. Open with the pretest from the probe.
- **Simple English.** Sentences under about 20 words. Define each term once as `plain words (term)`; spell out each abbreviation on first use. Never write "clearly", "obviously", "just" or "imagine": show it instead.
- **Never hand-write HTML, CSS or SVG.** If a picture needs something the kit lacks, `visual: {svg: ...}` is the last resort.

## Where you are running
- **Shell available** (Claude Code, Codex, Cursor): run the scripts. They need `pip install pyyaml playwright pillow` and `playwright install chromium`; a verify script may need numpy and scipy. Without them, say "not checked".
- **Sandbox without a browser:** build only and say "not checked".
- **No code at all:** reply with the spine and the slide beats as text.
- **Pictures** only when the user asks for one: `scripts/image.py --out decks/<slug>/<name>.png --subject "…"` (Codex CLI), or `--print` for the prompt to give the image tool the user names. The picture has no text; the kit draws labels on it (`spec.md`, Visuals).

## Token discipline
Read only the file the current step needs. Write `deck.yaml` once and fix it with targeted edits. Never paste the deck, the HTML or the check log into chat. Let expressions compute numbers: `{{name|2}}` costs fewer tokens than a typed number and cannot drift. For a long deck, put chapters in their own files (`include:`) and check one part at a time (`check.py --slides 8-14`), then the whole deck once.

## Files
| File | Read it when |
|---|---|
| `probe.md` | step 1: the questions to ask and how to use the answers |
| `story.md` | steps 2, 3 and 6: the spine, arcs, explaining maths, a real method's facts, the review |
| `spec.md` | step 4: every slide type, field, visual, chart mark, function and number format |
| `examples/mageck-rra/` | a deck about a real method: journey arc, 30 slides in 4 chapters, matrices worked row by row, data from `make_data.py`, checked by `verify_data.py` |
| `examples/negative-binomial/deck.yaml` | a puzzle-arc deck: distributions, sliders, `from:` and `kin:` |
| `examples/gallery/deck.yaml` | the syntax of one slide type, quickly |
| `profile.example.yaml` | creating a learner profile for the first time |
Read the examples for patterns; never reuse their topic.
