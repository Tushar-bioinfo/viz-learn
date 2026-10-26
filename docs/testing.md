# Testing

## 1. The regression run (every change)
```bash
tools/check-all.sh
```
It rebuilds the three examples in place, checks each in Chromium (output in `out/check/<example>/`), runs every `verify_data.py`, and checks the manifests. Passing looks like:
```
gallery | deck.html … 0 errors  0 warnings | check: 0 warnings (exit 0)
negative-binomial | … 0 errors  0 warnings | check: 0 warnings (exit 0)
mageck-rra | … 0 errors  0 warnings | check: 0 warnings (exit 0)
class variance | lesson.html … 0 errors  0 warnings | check: 0 warnings (exit 0)
…                                         (one line per class example)
mageck-rra verify | ALL OK
pca-3-why verify | ALL OK                  (one line per verify_data.py)
manifests: 5 plugin + 4 marketplace files · version X.Y.Z · OK
```
It also runs `tools/check_class.py` (the lint cases in `tools/class-cases/`), `tools/check_memory.py` (series memory and home data in a throwaway home) and `tools/check_docs.py` (`board.md` names every board field); each prints only its failures.
Anything else is a regression. A check exit of 2 means it could not run: report "not checked", never "passed". Each check takes about 20–30 s.
After a visual change, open `out/check/<example>/desktop.png` (the contact sheet) and the per-slide `desktop-NN.png` shots. Rebuilt `deck.html` files in `examples/` are tracked: commit them with the kit change that produced them.

## 1b. The deck seam stays byte-identical (after any change to `deck/scripts/build.py`)
The class skill reaches the deck through `build()`'s `ext` argument. With no `ext`, a deck must build exactly as before. Build each deck example with a base commit's `build.py` and with the changed one; `cmp` must print nothing:
```bash
git worktree add out/base <base commit>
mkdir -p out/ident
for d in gallery negative-binomial mageck-rra; do
  python3 out/base/plugins/viz-os/skills/deck/scripts/build.py plugins/viz-os/skills/deck/examples/$d/deck.yaml -o out/ident/$d.base.html --quiet
  python3 plugins/viz-os/skills/deck/scripts/build.py plugins/viz-os/skills/deck/examples/$d/deck.yaml -o out/ident/$d.new.html --quiet
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

## Past results
| Date | Version | Harness / model | Topic | Result |
|---|---|---|---|---|
| 2026-10-26 | 2.1.0 (class) | Antigravity / gemini-3.8-flash-high (high) | two-sample t-test lesson ("just build"), 16 slides, 26 min | All five gates passed on the judge's rerun (lint 0/0, check 0 warnings, data regenerates byte for byte, an independent scipy recompute matched every number: t = 16.68, SE = 0.254). Pedagogy weaker: the problem board shows no spread, `ss1` appears before its squares, limits name only doublets. `backlog.md` 35–39. |
| 2026-10-26 | 2.1.0 (class) | Grok Build / grok-4.7 (high) | two-sample t-test lesson ("just build"), 15 slides, 33 min | All five gates passed on the judge's rerun (lint 0/0, check 0 warnings, data regenerates byte for byte, independent scipy Welch recompute matched: t = 14.30 on CD3, −0.49 on CD14). Stronger science: a CD14 contrast, circular gating and cells-as-samples named as limits. Caught the sum-over-slash line by eye. `backlog.md` 35–39. |
| 2026-10-25 | 2.0.0 (class) | Grok Build / grok-4.7 (high) | z-score lesson ("just build"), 14 slides, 27 min | All five gates passed on the judge's rerun (lint 0/0, check 0 warnings, an independent numpy recompute matched every number, boards viewed). No image used, so AE4 passed. The judge found a missing-negative-bars kit bug and an empty what-if board; both fixed, along with the worker's `at()` bug and doc notes (`backlog.md` 28–34). On the fixed kit the lesson now gets 1 warning (what-if with no picture). |
| 2026-10-25 | 2.0.0 (class) | Grok Build / grok-4.7 (high) | PCA spine ("teach me PCA, just build"), 6 min | Passed AE6: proposed a What / How / Why series on one six-cell table, one question per lesson, wrote only each lesson's top and beat comments, and stopped for an OK. Named six doc gaps, all fixed (`backlog.md` 26). |
| 2026-10-24 | 2.0.0 | Claude Code / claude-opus-5-5 (medium) | Moran's I for spatial transcriptomics, 24 slides | All four gates passed on the judge's rerun (lint 0/0, check 0 warnings, independent recompute matched every number). One slip: three numbers typed by hand on a predict slide. Findings are in `backlog.md`. |
