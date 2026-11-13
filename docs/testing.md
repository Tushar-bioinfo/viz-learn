# Testing

Read only the applicable section: §0 docs, §1 quick, §1b full, §1c seam, §2 cold start, §3 validators, §4 setup. Live plan-specific test instructions take precedence for that task.

## 0. Workshop docs only
Run `PYTHONDONTWRITEBYTECODE=1 python3 tools/check_docs.py`, check edited links/paths and compare `git status --short` with the starting state. No example rebuild or browser run is needed when only workshop notes change. Do not run release/update commands for a documentation check.

## 1. The quick check (every change, by the implementer, the reviewers and me)
Build and browser-check two lessons of different types, plus the class cases the change added or touched:
```bash
for l in board-gallery pca-2-how; do d=plugins/viz-os/skills/class/examples/$l; python3 plugins/viz-os/skills/class/scripts/lesson.py $d/lesson.yaml | tail -1; python3 plugins/viz-os/skills/deck/scripts/check.py $d/lesson.html --out out/check/class-$l | grep '^check:'; done
python3 tools/check_class.py <case names the change added or touched>
```
`board-gallery` holds every board item; `pca-2-how` is a real taught lesson with a plane and sliders. Passing: both builds `0 errors  0 warnings`, both checks `check: 0 warnings`, every named case `ok`. It does not cover decks, sketch pages or the other lessons, so name that as not checked.

## 1b. The full regression run (once before the commit of a change that edits `skills/deck/` or `skills/sketch/`, and before a release)
```bash
tools/check-all.sh
```
It takes about 10 minutes. It rebuilds every deck, lesson and page example in place, checks each in Chromium (output in `out/check/<example>/`), runs every `verify_data.py`, and checks the manifests. Passing means every build reports `0 errors  0 warnings`, each browser check reports `check: 0 warnings`, every verify script ends `ALL OK`, all test counts have equal passed/total values, and manifests agree. Report the counts from the actual run; do not copy old results.
It also runs `tools/check_board_ui.py` (acts like a learner on the built lessons: Next and Back, think stops, sliders, scrolling, sizes at several windows), `tools/check_class.py` (the lint cases in `tools/class-cases/`), `tools/check_memory.py` (series memory and home data in a throwaway home), `tools/check_tidy.py` (the clean-up, on a copy of an example, in a throwaway home), `tools/check_docs.py` (`board.md` and `page.md` name what the code knows; no shipped file names a folder that does not ship; every path in a `SKILL.md` exists; every description fits 1024 characters), `tools/check_sketch.py` (the page cases in `tools/sketch-cases/`, then recall, turned anchors, a bare copy and a missing sibling) and `tools/check_palette.py` (each paper's inks, and the thread's edge on paper and wall); each prints only its failures and its count.
Anything else is a regression. A check exit of 2 means it could not run: report "not checked", never "passed". Each check takes about 20–30 s.
After a visual change, open `out/check/<example>/desktop.png` (the contact sheet) and the per-slide `desktop-NN.png` shots. Rebuilt `deck.html` files in `examples/` are tracked: commit them with the kit change that produced them. `lesson.html` and `page.html` are not tracked.

## 1c. The deck seam stays byte-identical (after any change to `deck/` or `class/` scripts or kit)
The class and sketch skills reach the deck through `build()`'s `ext` argument. With no `ext`, a deck must build exactly as before, and a lesson must too when only sketch changed. Build each deck and class example with a base commit's code and with the changed code; `cmp` must print nothing:
```bash
git worktree add out/base <base commit>
mkdir -p out/ident
for d in gallery negative-binomial mageck-rra; do
  python3 out/base/plugins/viz-os/skills/deck/scripts/build.py plugins/viz-os/skills/deck/examples/$d/deck.yaml -o out/ident/$d.base.html --quiet
  python3 plugins/viz-os/skills/deck/scripts/build.py plugins/viz-os/skills/deck/examples/$d/deck.yaml -o out/ident/$d.new.html --quiet
  cmp out/ident/$d.base.html out/ident/$d.new.html
done
for y in plugins/viz-os/skills/class/examples/*/lesson.yaml; do
  d=$(basename $(dirname $y))
  python3 out/base/plugins/viz-os/skills/class/scripts/lesson.py out/base/$y -o out/ident/$d.base.html --quiet
  python3 plugins/viz-os/skills/class/scripts/lesson.py $y -o out/ident/$d.new.html --quiet
  cmp out/ident/$d.base.html out/ident/$d.new.html
done
git worktree remove out/base
```
The built page inlines the kit, so a change to a `kit/` file also changes the bytes: run the sequence with the base's kit too (a base worktree carries both), or expect a diff and check it is only the kit change.

## 2. The cold-start test (after a change to the skill files, or before a release)
The real measure: a fresh agent with only the plugin builds a deck on a new topic, and you judge it.
1. Make an empty workspace with a copy of `plugins/viz-os/` in it and an empty learner folder for `$VIZOS_HOME`.
2. Give a fresh agent the prompt below (pick a topic none of the examples covers). On the maintainer's machine the `agent-delegate` skill does this: `delegate.py --to <cli> --role worker --workspace <ws> --timeout 3600` with the prompt on standard input. Run it on more than one harness when the change is about portability.
3. Judge it yourself, never from the agent's report alone:
   - **Lint:** rebuild its `deck.yaml` with the repo's scripts; expect `0 errors  0 warnings`.
   - **Browser:** run `check.py` on it; expect `check: 0 warnings`, exit 0.
   - **Numbers:** write your own recompute of the method, apart from the agent's code, and compare every number in `snaps/numbers.txt`. Search `deck.yaml` for numbers typed into text instead of `{{…}}` (the lint does not catch these yet).
   - **Eyes:** open the contact sheet and answer `story.md` §9 yourself. Then ask the science question a colleague would ask: what preprocessing, assumptions and test direction does the deck leave out?
4. Turn what it hit into `docs/backlog.md` items: kit bugs, docs that were unclear, missing visuals.

For the class skill, start the agent at `./plugins/viz-os/skills/class/SKILL.md`, put the lesson in `./lessons/<slug>/`, and judge five gates: the four above plus pedagogy (`lesson.md`'s review).

For the sketch skill, make the workspace **outside this repo** and copy only what ships: no `snaps/`, `__pycache__/`, `.DS_Store` or `page.html`. Start the agent at `./plugins/viz-os/skills/sketch/SKILL.md`, and put the page in `./pages/<slug>/`. In the prompt below, change the deck wording to match, and ask for step 8 too: "give the reply SKILL.md step 7 asks for, and run step 8". Judge the same five gates, and also: read every sheet with `lesson.md` §9 and `page.md`, The review; read every stop down the page; measure YAML size (guide 30 KB), `draw:` blocks (at most 3, at most 20% of the YAML) and built size (at most 1 MB); check `series/<name>.yaml` in `$VIZOS_HOME` lists the episode. A wrong sentence passes every gate, so read the sheets against `numbers.txt`. Check each biology claim against a source you actually read, and name any you cannot support.

A cold start tests the skill's text and scripts, not the harness's plugin loader, because the prompt names `SKILL.md` by path. The agent-delegate workers run with no sandbox on the maintainer's machine, because Codex's sandboxes kill Chromium at launch. So "stay in the workspace" is a request, not a wall: look through the run's output for reads outside it.

Prompt template:
```
This is a cold-start test of a plugin. Act as the plugin's agent for a real user.
The plugin is in ./plugins/viz-os/. Use only its files: start at ./plugins/viz-os/skills/deck/SKILL.md and follow it.
Do not use any other deck, slide or teaching skill or plugin, and do not look at files outside this workspace.

The user's request: "<request, ending with: Just build: no questions.>"
What you know about the user: <one line>. No learner profile exists yet.

Test rules:
- Work only inside this workspace. Put the deck in ./decks/<slug>/.
- The learner profile folder is $VIZOS_HOME = <path>. Never read or write ~/.viz-os.
- Do not edit anything under ./plugins/. If you think the kit has a bug, report it; do not patch it.
- Do not install anything. python3 with numpy, scipy, pyyaml, playwright (with Chromium) and pillow is available.
- Run every gate SKILL.md asks for, and fix the deck until they pass or until SKILL.md says to stop.
At the end, give the reply SKILL.md step 7 asks for. Then add three short lists:
1. Every warning or error you hit, and what you changed to fix it.
2. Anything in the plugin's docs that was unclear, missing or wrong, with the file and section.
3. Anything you think is a kit bug, with the slide number and the message.
```

## 3. Harness validators (after adding a skill or changing a manifest, and before a release)
These read the folder and install nothing. Each must exit 0.

| Harness | Command |
|---|---|
| Antigravity | `agy plugin validate plugins/viz-os` |
| Claude Code | `claude plugin validate plugins/viz-os` |
| Grok Build | `grok plugin validate plugins/viz-os` |
| Muse Code | `muse plugins validate plugins/viz-os` |
| Gemini CLI | `gemini extensions validate plugins/viz-os` |
Codex and Cursor have no validator: their loader stays **not tested** until a real install after a release.

## 4. Setup
Python 3 with `pyyaml`, `playwright` (then `playwright install chromium`) and `pillow`; `numpy` and `scipy` for the verify scripts. Built decks load Inter and JetBrains Mono from Google Fonts and KaTeX 0.16.11 from cdnjs (`build.py --katex-dir`, `check.py --vendor` for offline machines).

Historical cold starts and their caveats: [testing-before-cleanup.md, Past results](archive/testing-before-cleanup.md#past-results). These are past observations, not a current pass.
