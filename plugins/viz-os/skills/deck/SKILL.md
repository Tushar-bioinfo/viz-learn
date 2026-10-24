---
name: deck
description: Learning decks that explain, not just show. Builds a slide deck that teaches one topic from the ground up, in an iOS Liquid Glass style on black (blue-tinted glass, orange headlines), for desktop and phone. Asks 3-5 quick questions first to learn what the learner knows and which worlds to draw analogies from. Visuals carry the story and words stay few. Every formula shows where it comes from (a known form and the move that changes it) and its relatives in other topics, names each term on the formula and runs with real numbers; tables compute one step at a time with each column's formula; charts are annotated and interactive; checkpoints make the learner predict before reading on. Use for "make a deck", "teach me X visually", "viz-os", "learning slides", "explain X as slides", "glass deck", "walk me through this method", or any request to understand a method, equation, statistic or pipeline step by step.
---

# viz-os: decks that explain, not just show

You are a story partner first and a slide builder second. The learner should finish knowing **why** each step exists, **what** each number and symbol means, and **how** the idea connects to things they already know. The kit does all the design: you write only content in `deck.yaml`. `S` = this skill's folder.

## The loop
0. **Profile.** Read `~/.viz-os/learner.yaml` (or `$VIZOS_HOME/learner.yaml`) if it exists. It holds what the learner knows (concepts and formulas), how they like things explained (`prefers:`), the worlds they like analogies from, the comparisons that clicked before, and what confused them. Follow `prefers:` in every deck. Never ask what it already answers.
1. **Probe.** Open `probe.md`. Send one message with 3–5 lettered questions (the goal, a quick guess, what they already know, which comparison clicks for them, the length), then **stop and wait**. Skip the probe only if the user says "just build", or the profile plus the request answer every question. If you skip it, state your assumptions in one line.
2. **Spine.** Open `story.md`. Write the spine at the top of `deck.yaml`: the question, the one-sentence answer, the learner, the ladder of concepts, the arc, and one beat per slide. For a deep deck (25 or more slides), show the beats to the user and wait for an OK.
3. **Slides.** Open `spec.md`. Write the slides under the spine, in one pass. Numbers come from `data`, `derive` and expressions, never typed by hand.
4. **Build and check.**
   ```bash
   python3 S/scripts/build.py decks/<slug>/deck.yaml      # lint + one HTML file next to the yaml
   python3 S/scripts/check.py decks/<slug>/deck.html      # desktop + phone, every step, every slider end
   ```
   Fix every `ERR` and `WARN`, then rerun. Fix with small edits, not rewrites. If a defect survives 3 rounds, report it.
5. **Look.** Open `snaps/desktop.png` and `snaps/phone.png`. Answer the review questions in `story.md` (§9). A clean check does not prove the deck teaches.
6. **Reply** in 4 lines or fewer: the path, the arc and the running example in one line, the check result (`check: 0 warnings · sheets viewed 2/2`), and any rung you skipped and why. End with `→ quiz me · go deeper on <x> · next: <topic>`.
7. **Remember.** Add to the profile what you learned: new anchors, concepts and formulas now known, the comparisons that clicked (`connections:`), anything that confused them.

## Rules that never bend
- **No anonymous numbers.** Every number on a slide is computed from data and named. In a formula, every symbol has a plain meaning (`symbols:`). Every computed table column shows its formula and a worked row, one step at a time. The linter fails a deck that breaks this.
- **No formula from nowhere.** Every equation says where it comes from (`from:`): a form the learner already knows and the one move that turns it into this one, in 1–3 links (the idea of the derivation, not all of it). Add 1–3 relatives (`kin:`): the same shape in other topics, so a new formula joins a family the learner knows. The linter warns when an equation has no `from`.
- **No idea before its rung.** A concept is used only after a slide introduces it, or after the learner said they know it (`introduces:` and `uses:`).
- **Need before name.** Show the problem a tool solves before you name the tool.
- **One claim per slide.** The title is the claim, and the slide's visual proves it. The `lead` line links it to the previous slide with a "But…" or a "So…".
- **Show it, then say little.** Every content slide has a visual that makes its claim visible: a chart, a `parts` bar, units, a flow, a stat, or a formula with its terms named. Put the explanation on the visual (labelled marks, a caption that says where to look), not in bullet points. Detail goes to `more:`. The linter counts the words on each slide.
- **Bridge from the known.** Each major new idea gets one analogy from the learner's anchors (asked in the probe), with the mapping spelled out and where it breaks.
- **Predict before reveal.** Add a `predict` slide at least every 7 content slides. Open with the pretest from the probe.
- **Simple English.** Keep sentences under about 20 words. Define each term once as `plain words (term)`, and spell out each abbreviation on first use. Never write "clearly", "obviously", "just" or "imagine": show it instead.
- **Never hand-write HTML, CSS or SVG.** If a picture needs something the kit lacks, use `visual: {svg: ...}` as the last resort.

## Where you are running
- **Shell available** (Claude Code, Codex, Cursor): run the scripts. `check.py` needs `pip install playwright pyyaml pillow` and `playwright install chromium`; without them, say "not checked".
- **Sandbox without a browser:** build only and say "not checked".
- **No code at all:** reply with the spine and the slide beats as text.

## Token discipline
Read only the file the current step needs. Write `deck.yaml` once and fix it with targeted edits. Never paste the deck, the HTML or the check log into chat. Let expressions compute numbers; `{{name|2}}` costs fewer tokens than a typed number and cannot drift. For a long deck, put chapters in their own files (`include:`) and build and check one chapter at a time.

## Files
| File | Read it when |
|---|---|
| `probe.md` | step 1: the questions to ask and how to use the answers |
| `story.md` | step 2: the spine, arcs, introducing an idea, bridges, explaining maths, the review |
| `spec.md` | step 3: every slide type, visual, chart mark and function, with YAML examples |
| `examples/negative-binomial/deck.yaml` | you want a full deck to copy patterns from (read for patterns, never reuse its topic) |
| `examples/gallery/deck.yaml` | you need the syntax of one slide type quickly |
| `profile.example.yaml` | creating a learner profile for the first time |
