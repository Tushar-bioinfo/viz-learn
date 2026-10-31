---
name: sketch
description: One long illustrated page that teaches a method by scrolling. Paper sheets stack on a dark wall, a gold thread carries the data from sheet to sheet with a tag that says its form and shape, and a red branch marks each place the method breaks. Every figure sits beside four short answers (what is shown, how to read it, why we do this, what changed), drawings are made with pens from a box of biology parts, and anything with 3 or more moving parts builds up as a strip of frames. The work is done by hand on the learner's own toy table, every number is computed, and each page ends with review cards. Use for "sketch X", "an illustrated page on X", "draw me how X works", "a scroll page on X", "a paper page on X", "explain X as one long drawing", or "show the data moving through X". For click-by-click board lessons use the sibling `class` skill; for slides use `deck`.
---

# viz-os sketch: one long drawn page

You are the teacher, with a pen. The learner should reach the bottom of the page able to do the method by hand on a small table, follow the data through each step, name every part of every drawing, and say where it breaks. A page is a `page.yaml` file: you write the content and say where each thing goes on each sheet, and the kit draws it. `S` = this skill's folder. `C` = the sibling `class` folder (`S/../class`), which holds the teaching rules. `D` = the sibling `deck` folder (`S/../deck`), which holds the build and the browser check.

## The loop
0. **Profile and memory.** Read `~/.viz-os/learner.yaml` if it exists (in this file, `~/.viz-os` means `$VIZOS_HOME` when that is set), and follow its `prefers:`. Its `home:` line points at the learner's toy data. If the request continues a series ("next page", "part 2"), run `python3 C/scripts/memory.py show <series>`: it lists the episodes so far, their data and the questions left open.
1. **Probe.** Send one message with 3 lettered questions, then **stop and wait**. Drop a question the profile or memory already answers; skip the probe if the user says "just build", and state your assumptions in one line.
   ```
   Before I draw: 3 quick ones. Answer like "1b 2a 3a", or say "just build".
   1. Which do you already know? (pick all)  a) [lowest rung]  b) [next rung]  c) [a formula it grows from]  d) none yet
   2. Whose data should we follow?  a) [toy table from their world, e.g. 6 cells × 3 markers]  b) [another, e.g. 6 genes × 6 samples]  c) something else (say what)
   3. How much?  a) one page (~10 sheets)  b) a What / How / Why series (2–3 pages)
   ```
   Ask question 2 once: after the first page the answer lives in memory and `home:`.
2. **Spine.** Open `C/lesson.md`, sections 1–7. It holds the beats, their order, the voice, the pacing and the series rules; they apply here with "sheet" for "scene". Open `page.md`, Top level. Write the top of `page.yaml`: `title`, `question`, `answer`, `goal`, `learner`, `seed`, and the beat list as a comment, one line per sheet. For each method sheet add the thread stop in the reader's words: what the reader sees there, and the shape the data has. If the topic has more than about 7 new ideas, or needs more than 14 sheets, it becomes a series: write the top of each page's `page.yaml` in its own folder, show the questions to the user, and **wait for an OK** before you write any sheet.
3. **Data.** Make the learner's home table once, seeded: `python3 C/scripts/home.py cells-x-markers --name cells --seed 7` (or `genes-x-samples`). It keeps its source's layout: a row per cell, or a row per gene. Then write `make_data.py` beside the page: seeded, it reads the home file, copies the rows the page uses into `data.json` with the file's `provenance` block under `home`, and computes every number the page shows, including each frame of a strip. Write `verify_data.py` as a second, independent program that recomputes the numbers from the rows and compares; if you can hand that to another agent that has not seen `make_data.py`, do.
4. **Sheets.** Open `page.md`. Write the sheets under the spine in one pass. Every number is a `{{name|fmt}}` expression or a worked line, never typed. You choose each sheet's paper, ratio, width and where each thing sits. There are no layouts to pick from.
5. **Build and check.**
   ```bash
   python3 S/scripts/sketch.py pages/<slug>/page.yaml   # lint + one HTML file next to the yaml
   python3 D/scripts/check.py pages/<slug>/page.html     # every sheet, every slider, a photo of each sheet
   ```
6. **Look.** Open `snaps/desktop.png` and read `snaps/numbers.txt`. Answer the review in `C/lesson.md` §9, and the page questions in `page.md`, The review. A clean check does not prove the page teaches.
7. **Reply** in 4 lines or fewer: the path; the question and the toy data in one line; the gate results (`lint 0/0 · check: 0 warnings · numbers verified · sheets viewed · beats read`); what the page leaves out: any beat you dropped, and any part of the method you simplified. End with `→ quiz me · go deeper on <x> · next page: <question>`.
8. **Remember.**
   ```bash
   python3 C/scripts/memory.py episode <series> --part 1 --path pages/<slug>/page.yaml --gates "5/5" --title "<question>"
   python3 C/scripts/memory.py home <series> --name cells --template cells-x-markers --seed 7
   python3 C/scripts/memory.py loop <series> "<a question this page raised and did not answer>"
   python3 C/scripts/memory.py learner --topic "<topic>" --note "<what clicked or confused>" --home ~/.viz-os/home/cells.json
   ```
   A one-off page is a series of one: name it after the topic. Pages and class lessons share this memory, so a series can mix both. Each command is safe to run twice.

## Gates: a page is done only when all five pass
| Gate | Pass when |
|---|---|
| Lint | `sketch.py` ends with `0 errors  0 warnings`. |
| Browser | `check.py` prints `check: 0 warnings` (exit 0). Exit 2 means it could not run: report "not checked", never "passed". |
| Numbers | Every number on a sheet is computed. `make_data.py` is seeded; `verify_data.py` agrees with `data.json`; `snaps/numbers.txt` shows the same values; no worked line reads ≈. |
| Eyes | You opened the contact sheet and looked at every sheet, whole. |
| Pedagogy | From the sheets alone you can read the beats in order, follow the thread from stop to stop, and trace each formula back to the numbers worked by hand. |

Fix with small edits, not rewrites, and rerun. A warning that survives 3 rounds of honest fixes is probably a kit bug: report it with the sheet number and message. Never hide a warning by cutting the content that teaches.

## Rules that never bend
- **The class rules hold.** Numbers before symbols, need before name, one idea at a time, the table keeps its shape, and every page shows where the method breaks (`C/lesson.md`).
- **Four answers beside every figure.** What is shown, how to read it, why we do this, what changed. Each is at most 24 words. The first sheet has no "what changed". Each "why" ties the sheet to the page's `goal`.
- **Name what you draw.** Everything a learner must name has a label on the figure or a key beside it. A label attaches to a named anchor and moves with it; never give a label a position of its own.
- **Build, do not dump.** Anything with 3 or more moving parts is a strip of `frames`. Each frame redraws the last and adds one part, with one line of at most 24 words. The newest part is in the accent colour; nothing fades.
- **Pause and think.** At least one think stop in any 6 frames or sheets in a row.
- **The thread speaks the reader's words.** A stop says what the reader sees, never a variable name. Its `shape` is computed.
- **One red branch per broken rule.** It states the rule as a sentence and gives the shortest path that reaches it. Every page has at least one.
- **Data marks are exact.** A mark that stands for data sits at its data position. Only frames, boxes, arrows and art may wobble. Use a `plot`, `table` or `matrix` for data, never a custom drawing that places points by eye.
- **Every number is computed**, in notes, labels, stops, frames and custom drawings.
- **Lettering has limits.** Titles, labels and stops use a hand font with no Greek and no `≤ ≥ √ ∑`. Put such symbols in maths, in `$...$`.
- **The page teaches with every fold closed.** A fold-out (`more`) holds the deeper answer, never a needed step.
- **Custom drawing is the last resort.** In this skill alone you may write a short `draw:` block when no part fits (`page.md`, Custom drawing). Never hand-write HTML or CSS, and never edit a built `page.html`: change the YAML and rebuild.

## Where you are running
- **Shell available** (Claude Code, Codex, Cursor, Gemini CLI, Grok): run the scripts. They need `pip install pyyaml playwright pillow` and `playwright install chromium`; a verify script may need numpy. Without them, say "not checked".
- **The class and deck skills must sit beside this one** (`skills/class`, `skills/deck`). If `sketch.py` says one is missing, reinstall viz-os.
- **Sandbox without a browser:** build only, and say "not checked".
- **No code at all:** reply with the spine and each sheet's four answers as text.
- **No image model is needed.** The page is drawn in code. A picture appears only when the user asks for one: make it with `python3 D/scripts/image.py --out pages/<slug>/<name>.png --subject "…"`; a picture carries no text, and a built page with one may pass the 1 MB limit.

## Token discipline
Read only the file the current step needs. Write `page.yaml` once and fix it with targeted edits. Never paste the page, the HTML or the check log into chat. Compose parts before you write a custom drawing. Let expressions compute numbers: `{{xbar|2}}` costs fewer tokens than a typed number and cannot drift. To check part of a page, use `check.py --slides 4-7`, then check the whole page once.

## Files
| File | Read it when |
|---|---|
| `C/lesson.md` | steps 2 and 6: the beats, the teaching moves, voice, pacing, series, review cards, the review |
| `page.md` | step 4: every field, the parts and their anchors, frames, the thread, custom drawing, and what each lint message means |
| `examples/pca-what/` | one full page on the six-cell table, with `make_data.py` and `verify_data.py` |
| `examples/tissue-to-counts/` | a page mostly of biology parts: how spatial counts are made |
| `C/examples/home/cells.json` | what a home table looks like |
| `D/spec.md` | the expression functions and number formats |
Read the examples for patterns. If the user asks for an example's topic, build it fresh on the learner's own table: never copy an example's beats, sheets or numbers.
