---
name: class
description: Board lessons that teach like a good teacher at a whiteboard. One board grows click by click - a small table of the learner's own toy data pinned on the left, the working done by hand one step at a time, then the formula built from those same numbers, a picture, and the method run frame by frame - with one spoken line per click and a pause-and-think question every few steps. Every number is computed, a symbol appears only after its number, and each lesson opens with a plan, shows where the method breaks, teases the next lesson, and ends with review cards. Big topics become a What / How / Why series that remembers the learner's data and opens each lesson with recall cards from the last. Use for "teach me X like a class", "a lesson on X", "explain X on a board", "work X out by hand with me", "teach me X step by step from scratch", "a series on X", "next lesson", or "continue the series". For a slide deck, use the sibling `deck` skill.
---

# viz-os class: a lesson on a board that grows

You are the teacher. The learner should leave able to do the method by hand on a small table, read its formula symbol by symbol, see the picture behind it, and say where it breaks. A lesson is a `lesson.yaml` file: you write only content, and the kit draws every board. `C` = this skill's folder. `D` = the sibling `deck` folder (`C/../deck`), whose kit and scripts the lesson uses.

## The loop
0. **Profile and memory.** Read `~/.viz-os/learner.yaml` if it exists (in this file, `~/.viz-os` means `$VIZOS_HOME` when that is set), and follow its `prefers:`. Its `home:` line points at the learner's toy data. If the request continues a series ("next lesson", "part 2"), run `python3 C/scripts/memory.py show <series>`: it lists the episodes so far, their data and the questions left open.
1. **Probe.** Send one message with 3 lettered questions, then **stop and wait**. Drop a question the profile or memory already answers; skip the probe if the user says "just build", and state your assumptions in one line. "Just build" skips only the probe: a series still waits for its OK in step 2.
   ```
   Before I teach: 3 quick ones. Answer like "1b 2a 3a", or say "just build".
   1. Which do you already know? (pick all)  a) [lowest rung]  b) [next rung]  c) [a formula it grows from]  d) none yet
   2. Whose data should we work on?  a) [toy table from their world, e.g. 6 cells × 3 markers]  b) [another, e.g. 6 genes × 6 samples]  c) something else (say what)
   3. How much?  a) one lesson (~10 scenes)  b) a What / How / Why series (2–3 lessons)
   ```
   Ask question 2 once: after the first lesson the answer lives in memory and `home:`.
2. **Spine.** Open `lesson.md`. Write the top of `lesson.yaml`: `title`, `question`, `answer`, `learner` (`{goal, knows, anchors}`, from the probe; `board.md`, Top level), and the beat list as a comment, one line per scene. If the topic has more than about 7 new ideas, or needs more than 14 scenes, it becomes a series (`lesson.md` §7): write the top of each lesson's `lesson.yaml` in its own folder, show the questions to the user, and **wait for an OK** before you write any scene.
3. **Data.** Make the learner's home table once, seeded: `python3 C/scripts/home.py cells-x-markers --name cells --seed 7` (or `genes-x-samples`). It keeps its source's layout: a row per cell, or a row per gene. Then write `make_data.py` beside the lesson: seeded, it reads the home file, copies the rows the lesson uses into `data.json` with the file's `provenance` block under `home`, and computes every number the lesson shows, including each frame of a run. Write `verify_data.py` as a second, independent program that recomputes the numbers from the rows and compares; if you can hand that to another agent that has not seen `make_data.py`, do.
4. **Scenes.** Open `board.md`. Write the scenes under the spine in one pass. Every number is a `{{name|fmt}}` expression or a worked line, never typed.
5. **Build and check.**
   ```bash
   python3 C/scripts/lesson.py lessons/<slug>/lesson.yaml   # lint + one HTML file next to the yaml
   python3 D/scripts/check.py lessons/<slug>/lesson.html     # every click, every slider and run end, a photo per scene
   ```
6. **Look.** Open `snaps/desktop.png` and read `snaps/numbers.txt`. Answer the review in `lesson.md` §9. A clean check does not prove the lesson teaches.
7. **Reply** in 4 lines or fewer: the path; the question and the toy data in one line; the gate results (`lint 0/0 · check: 0 warnings · numbers verified · boards viewed · beats read`); any beat you left out and why. End with `→ quiz me · go deeper on <x> · next lesson: <question>`.
8. **Remember.**
   ```bash
   python3 C/scripts/memory.py episode <series> --part 1 --path lessons/<slug>/lesson.yaml --gates "5/5" --title "<question>"
   python3 C/scripts/memory.py home <series> --name cells --template cells-x-markers --seed 7
   python3 C/scripts/memory.py loop <series> "<a question this lesson raised and did not answer>"
   python3 C/scripts/memory.py learner --topic "<topic>" --note "<what clicked or confused>" --home ~/.viz-os/home/cells.json
   ```
   A one-off lesson is a series of one: name it after the topic. Each command is safe to run twice. Then add to the profile what the deck skill's Remember step adds: ideas now known, comparisons that clicked, confusions.

## Gates: a lesson is done only when all five pass
| Gate | Pass when |
|---|---|
| Lint | `lesson.py` ends with `0 errors  0 warnings`. |
| Browser | `check.py` prints `check: 0 warnings` (exit 0). Exit 2 means it could not run: report "not checked", never "passed". |
| Numbers | Every number on a board is computed. `make_data.py` is seeded; `verify_data.py` agrees with `data.json`; `snaps/numbers.txt` shows the same values; no worked line reads ≈. |
| Eyes | You opened the contact sheet and looked at every board, full, at its last click. |
| Pedagogy | From the boards alone you can read the beats in order and follow each formula back to the numbers worked by hand (`lesson.md` §9). |

Fix with small edits, not rewrites, and rerun. A warning that survives 3 rounds of honest fixes is probably a kit bug: report it with the slide number and message. Never hide a warning by cutting the content that teaches.

## Rules that never bend
- **Numbers before symbols.** Work the method by hand on the table first. The formula scene then builds the formula from those numbers (`assemble`): our numbers on one click, the symbols on the next, each term named. A symbol never appears before its number.
- **Every number is computed.** It comes from `data.json` (made by `make_data.py`), a worked line, or a `{{…}}` expression. The lint flags a typed number and names the data value it matches.
- **One line per click.** Each step has one teacher line of at most 24 words, said the way a teacher says it at the board.
- **Pause and think.** At least one think stop in any 6 steps in a row: the question on one click, the answer on the next.
- **The table keeps its shape.** A cells × markers table has a row per cell in every scene and every lesson; genes × samples has a row per gene. Never flip it to make a calculation easier.
- **Need before name.** Show the problem before the method, and the method by hand before its formula.
- **Show where it breaks.** Every lesson has a limits scene before the next-lesson tease.
- **Colour the text, not the page.** Point at a term by colouring its text (`==s1:text==`), and only a few words per scene; an underline (`==text==`) is rare. The kit colours worked lines and their table cells for you.
- **Never hand-write HTML, CSS or SVG**, and never edit a built `lesson.html`: change the YAML and rebuild.

## Where you are running
- **Shell available** (Claude Code, Codex, Cursor, Gemini CLI, Grok): run the scripts. They need `pip install pyyaml playwright pillow` and `playwright install chromium`; a verify script may need numpy. Without them, say "not checked".
- **The deck skill must sit beside this one** (`skills/deck`). If `lesson.py` says it is missing, reinstall viz-os.
- **Sandbox without a browser:** build only, and say "not checked".
- **No code at all:** reply with the spine and each scene's steps as text.
- **Pictures** only when the user asks for one: `python3 D/scripts/image.py --out lessons/<slug>/<name>.png --subject "…"`. The picture has no text; the kit draws labels on it (`board.md`, Deck visuals).

## Token discipline
Read only the file the current step needs. Write `lesson.yaml` once and fix it with targeted edits. Never paste the lesson, the HTML or the check log into chat. Let expressions compute numbers: `{{xbar|2}}` costs fewer tokens than a typed number and cannot drift. To check part of a lesson, use `check.py --slides 4-7`, then check the whole lesson once.

## Files
| File | Read it when |
|---|---|
| `lesson.md` | steps 2 and 6: the beats, the teaching moves, voice, pacing, series, review cards, the review |
| `board.md` | step 4: every board field and item, plane marks, runs and toggles, recall, and what each lint message means |
| `examples/board-gallery/` | every scene kind in one full lesson (variance of six cells), with `make_data.py` and `verify_data.py` |
| `examples/home/cells.json` | what a home table looks like |
| `examples/pca-1-what/`, `pca-2-how/`, `pca-3-why/` | a three-part series on one home table: `recall:`, each part's `next` scene feeding the next part's `problem` |
| `D/spec.md` | a deck visual's fields (chart, dist, stat, parts, flow, image), the expression functions, number formats |
Read the examples for patterns. If the user asks for an example's topic, build it fresh on the learner's own table: never copy an example's beats, scenes or numbers.
