---
name: class
description: Board lessons on one long scrolling page. The method worked by hand on the learner's own toy table, then its formula, its picture and where it breaks. Big topics become a What / How / Why series. Use for "teach me X like a class", "a lesson on X", "explain X on a board", "work X out by hand with me", "teach me X step by step from scratch", "a series on X", "next lesson", or "continue the series". For a slide deck, use the sibling `deck` skill.
---

# viz-os class: a lesson on one page that scrolls

You are the teacher. The learner should leave able to do the method by hand on a small table, read its formula symbol by symbol, see the picture behind it, and say where it breaks. A lesson is a `lesson.yaml` file: you write only content, and the kit draws every board. `C` = this skill's folder. `D` = the sibling `deck` folder (`C/../deck`), whose kit and scripts the lesson uses.

## The loop
0. **Profile and memory.** Read `~/.viz-os/learner.yaml` if it exists (in this file, `~/.viz-os` means `$VIZOS_HOME` when that is set), and follow its `prefers:`. Its `home:` line points at the learner's toy data. If the request continues a series ("next lesson", "part 2"), run `python3 C/scripts/memory.py show <series>`: it lists the episodes so far, their data and the questions left open.
1. **Probe.** Send one message with 4 lettered questions, then **stop and wait**. Drop a question the profile or memory already answers; skip the probe if the user says "just build", and state your assumptions in one line. "Just build" skips the probe and the adv storyboard's wait (`adv.md` §7): a series still waits for its OK in step 2.
   ```
   Before I teach: 4 quick ones. Answer like "1b 2a 3a 4a", or say "just build".
   1. Which do you already know? (pick all)  a) [lowest rung]  b) [next rung]  c) [a formula it grows from]  d) none yet
   2. Whose data should we work on?  a) [toy table from their world, e.g. 6 cells × 3 markers]  b) [another, e.g. 6 genes × 6 samples]  c) something else (say what)
   3. How much?  a) one lesson (~10 scenes)  b) a What / How / Why series (2–3 lessons)
   4. How much reading?  a) short lines, one breath each (default)  b) full: several sentences a line, more context and reasons
   ```
   Ask question 2 once: after the first lesson the answer lives in memory and `home:`. Ask question 4 only when the profile has no `voice:`. Store the answer with `memory.py learner --voice short|full` (step 8). Write the voice into `learner.voice`. When the user asks for the other voice for one lesson, set it in that lesson only.
   If the user says "adv", read `adv.md` first: it adds probe question 5 and, in step 2, a picture plan with a storyboard to approve.
2. **Spine.** Open `lesson.md`. Write the top of `lesson.yaml`: `title`, `question`, `answer`, `learner` (`{goal, knows, anchors, voice}`, from the probe and the profile; `board.md`, Top level), and the beat list as a comment, one line per scene. If the topic is big enough for a series (`lesson.md` §7), write the top of each lesson's `lesson.yaml` in its own folder, show the questions to the user, and **wait for an OK** before you write any scene.
3. **Data.** Make the learner's home table once, seeded: `python3 C/scripts/home.py cells-x-markers --name cells --seed 7` (or `genes-x-samples`). It keeps its source's layout: a row per cell, or a row per gene. Then write `make_data.py` beside the lesson: seeded, it reads the home file, copies the rows the lesson uses into `data.json` with the file's `provenance` block under `home`, and computes every number the lesson shows, including each frame of a run. Write `verify_data.py` as a second, independent program that recomputes the numbers from the rows and compares; if you can hand that to another agent that has not seen `make_data.py`, do.
4. **Scenes.** Open `board.md`. Write the scenes under the spine in one pass. Every number is a `{{name|fmt}}` expression or a worked line, never typed.
5. **Build and check.**
   ```bash
   python3 C/scripts/lesson.py lessons/<slug>/lesson.yaml   # lint + one HTML file next to the yaml
   python3 D/scripts/check.py lessons/<slug>/lesson.html     # every step, every slider and run end, a photo per scene
   ```
6. **Look.** Open `snaps/desktop.png` and read `snaps/numbers.txt`. Answer the review in `lesson.md` §8. A clean check does not prove the lesson teaches.
7. **Reply** in 4 lines or fewer: the path; the question and the toy data in one line; the gate results (`lint 0/0 · check: 0 warnings · numbers verified · boards viewed · beats read`); any beat you left out and why. End with `→ go deeper on <x> · next lesson: <question>`.
8. **Remember.**
   ```bash
   python3 C/scripts/memory.py episode <series> --part 1 --path lessons/<slug>/lesson.yaml --gates "5/5" --title "<question>"
   python3 C/scripts/memory.py home <series> --name cells --template cells-x-markers --seed 7
   python3 C/scripts/memory.py loop <series> "<a question this lesson raised and did not answer>"
   python3 C/scripts/memory.py learner --topic "<topic>" --note "<what clicked or confused>" --home ~/.viz-os/home/cells.json
   ```
   A one-off lesson is a series of one: name it after the topic. Each command is safe to run twice. Then add to the profile what the deck skill's Remember step adds: ideas now known, comparisons that clicked, confusions.
9. **Tidy.** Run this last, once all the gates pass.
   ```bash
   python3 C/scripts/tidy.py lessons/<slug>             # --dry-run prints the moves; --keep <name> spares a file
   ```
   It leaves only `lesson.html` in view: it packs `lesson.yaml`, the data, the scripts and images into the hidden `.lesson/` beside it, and deletes `snaps/`. It refuses unless `lesson.html` is built, up to date and holds its data. To change a tidied lesson, or to read its `data.json` from a later lesson, first run `tidy.py lessons/<slug> --restore`.

## Gates: a lesson is done only when all five pass
| Gate | Pass when |
|---|---|
| Lint | `lesson.py` ends with `0 errors  0 warnings`. |
| Browser | `check.py` prints `check: 0 warnings` (exit 0). Exit 2 means it could not run: report "not checked", never "passed". |
| Numbers | Every number on a board is computed. `make_data.py` is seeded; `verify_data.py` agrees with `data.json`; `snaps/numbers.txt` shows the same values; no worked line reads ≈. |
| Eyes | You opened the contact sheet and looked at every scene, full, at its last step. |
| Pedagogy | From the boards alone you can read the beats in order and follow each formula back to the numbers worked by hand (`lesson.md` §8). |

Fix with small edits, not rewrites, and rerun. A warning that survives 3 rounds of honest fixes is probably a kit bug: report it with the slide number and message. Never hide a warning by cutting the content that teaches.

## Rules that never bend
- **Numbers before symbols.** Work the method by hand on the table first. The formula scene then builds the formula from those numbers (`assemble`): our numbers, then the symbols under them, each term named.
- **Every number is computed.** It comes from `data.json` (made by `make_data.py`), a worked line, or a `{{…}}` expression. The lint flags a typed number and names the data value it matches.
- **One line per step.** Each step has one teacher line, said the way a teacher says it at the board.
- **Pause and think.** At least one think stop in any 6 steps in a row. It shows its question with a Show answer button. The answer takes no room until pressed. On a figure with Next, the first press asks and the second answers.
- **The table keeps its shape.** A cells × markers table has a row per cell in every scene and every lesson; genes × samples has a row per gene. Never flip it to make a calculation easier.
- **Need before name.** Show the problem before the method, and the method by hand before its formula.
- **Show where it breaks.** Every lesson has a limits scene before the next-lesson tease.
- **Colour the text, not the page** (`board.md`, Highlights in text).
- **Never hand-write HTML, CSS or SVG**, and never edit a built `lesson.html`: change the YAML and rebuild.

## Where you are running
- **Shell available** (Claude Code, Codex, Cursor, Gemini CLI, Grok): run the scripts. They need `pip install pyyaml playwright pillow` and `playwright install chromium`; a verify script may need numpy. Without them, say "not checked".
- **The deck skill must sit beside this one** (`skills/deck`). If `lesson.py` says it is missing, reinstall viz-os.
- **Sandbox without a browser:** build only, and say "not checked".
- **No code at all:** reply with the spine and each scene's steps as text.
- **Pictures** only when the user asks for one: `python3 D/scripts/image.py --out lessons/<slug>/<name>.png --subject "…"`. The picture has no text; the kit draws labels on it (`board.md`, Deck visuals).

## Token discipline
All you read stays in your context, and every later call pays for it again. A lesson takes 50 to 100 calls, so a page read at the start is paid 50 times or more. Read less, and read it once.
- **Keep the brief on disk.** When you make the lesson's folder (step 2), save the user's request, with any story or outline they pasted, to `lessons/<slug>/brief.md`. After a context reset, read that file again. Never search the chat history.
- **Read by section.** `python3 C/scripts/docs.py <file>` lists a file's headings and their sizes. `python3 C/scripts/docs.py <file> <heading words>` prints one section. Read `lesson.md` whole. In `board.md`, read every section except Items whole, and under Items read only the items you draw. In `adv.md`, read §1–8, then only the sections for the figures you draw. In `D/spec.md`, read only the section you need (Expressions, Numbers, or one visual). To learn from an example, grep it for the item (`grep -n -A12 "plane:" C/examples/board-gallery/lesson.yaml`). Do not read a whole example lesson.
- **One file per read.** Use your file-read tool. Never `cat` two skill files, or a file over 25 KB, in one shell command. A long output is cut off and saved to a file, so you pay for it twice.
- **Limits come from the lint.** `python3 C/scripts/lesson.py --limits` prints every word limit and count limit. Do not read the scripts or the kit to find a rule. If a message is unclear, grep `lint.md` for its words.
- **Write once, edit small.** Write `lesson.yaml` and `make_data.py` once. Fix them with edits that change only the lines at fault. Never rewrite a scene or a file through a script. Never re-read your own `lesson.yaml` whole: grep for the scene you need.
- **Check in parts.** Check the scenes you changed with `check.py --slides 4-7`. Check the whole lesson once, at the end.
- **Look at every scene, once per change.** In the first review round, open the contact sheet, then each scene's still (`snaps/desktop-NN.png`). After a fix, open only the stills of the scenes you changed. Never reopen a still that has not changed. Some faults show only when you look, so do not skip this to save tokens.
- Let expressions compute numbers: `{{xbar|2}}` costs fewer tokens than a typed number, and it cannot drift. Never paste the lesson, the HTML or the check log into chat.
- **One lesson per chat in a series.** After the Remember step, end your reply with: "Start the next lesson in a new chat with: next lesson." `memory.py show` gives the new chat what it needs.

## Files
| File | Read it when |
|---|---|
| `lesson.md` | steps 2 and 6, whole: the beats, the teaching moves, voice, pacing, series, the review |
| `board.md` | step 4: how a scene is laid out, steps, controls, YAML gotchas; under Items, only the items you draw (`docs.py board.md <item>`) |
| `adv.md` | only when the user says "adv": §1–8 (the probe's depth question, the picture plan, the idea table, the storyboard), then one figure's section when you draw it |
| `lint.md` | after a build error, by grep for the message's words: what each lint and check message means, and its fix |
| `examples/board-gallery/` | every plain board item in one full lesson (variance of six cells; adv figures: `adv.md`), with `make_data.py` and `verify_data.py` |
| `examples/home/cells.json` | what a home table looks like |
| `examples/pca-1-what/`, `pca-2-how/`, `pca-3-why/` | a three-part series on one home table: each part's `next` scene feeding the next part's `problem`, and a think stop that reaches back |
| `D/spec.md` | by section (`docs.py ../deck/spec.md expressions`): a deck visual's fields (chart, dist, stat, parts, flow, image), the expression functions, number formats |
Read the examples for patterns. If the user asks for an example's topic, build it fresh on the learner's own table: never copy an example's beats, scenes or numbers.
For one long illustrated page the learner scrolls, use the sibling `sketch` skill (`C/../sketch`).
