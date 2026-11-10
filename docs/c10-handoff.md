# C10 handoff for a block's orchestrator

The user starts a new chat per block with the strong model (Fable, high) and says "work on C10i" (or another block). You run that one block as orchestrator. Read this once, then [c10-visuals.md](c10-visuals.md) (the ledger: blocks, status, State now, Decisions, the loop), then only your block's rows in the design, [c10-plan-v2.md](c10-plan-v2.md). The ledger is the truth; this file gives the why, the sources and who does what. Written 9 Nov 2026 (plan v2).

## Where we are (10 Nov)
| Block | State |
|---|---|
| C10a 3D look, C10b build `space` | done, committed (3a568a8) |
| C10d word-link mock-ups | done and approved: look A, twin glow, `==pixel==` syntax |
| C10e build word links | done and approved 9 Nov; **not committed** (commit when the user says) |
| C10i look and playground shell | half 1 done 9 Nov (the user picked the look); half 2 done and approved 10 Nov (the look is the kit's default; `quarters` mark); **not committed** (commit when the user says) |
| C10g chooser (adv) | done and approved 9 Nov; **not committed** (commit when the user says) |
| C10k proportions bench and the `chance` figure | done and approved 10 Nov (public-health toy: 80 homes, well against piped water; bench `out/c10/bench-prop/`); **not committed** (commit when the user says) |
| C10c motion and hands-on (**next**), C10j linked strip, C10f drawn parts | todo, in that order |
| C10h cold-start exam on two lessons | last |

Uncommitted work in the tree: C10e (`plugins/viz-os/skills/class/…`, `tools/class-cases/link-*.yaml`), C10g (`class/adv.md`, `scripts/storyboard.py`, the lint, `tools/class-cases/adv-*.yaml`, `tools/check_docs.py`), C10i half 2 (`class/kit/`, `board.md`, `lint.md`, the lint, `examples/pca-2-how/lesson.yaml`, `tools/class-cases/quarters-*.yaml`, `plugins/viz-os/docs/design.md`), C10k (`class/kit/`, the lint, `adv.md`, `board.md`, `lint.md`, `tools/class-cases/chance-*.yaml`, `adv-wrong-figure.yaml`, `plugins/viz-os/docs/design.md`), the docs clean-up and plan v2 (`docs/`, `AGENTS.md`), and the user's own `docs/release.md`, `docs/update.md`, `tools/update*.py`. Leave the user's files alone. Commit only when the user says.

## What the user wants (their words, 8–9 Nov, condensed)
- **Agents that choose the visual that builds the right intuition:** geometric, plain logic, an analogy, or a small worked example. The picture is chosen for the idea, not decoration. Lessons should not all show the same kinds of figure.
- **Extraordinary means both:** the best visuals, interaction and story, and cheap to make. Templates and a fixed kit keep any agent's run short.
- **Media, eventually:** motion graphics, images from an image model (through a CLI the user names), interactive figures, plots, advanced JS, short films, generative art.
- **Look:** clean, no overlaps, good colours and borders, professional; a black and orange theme. Inspired by, never copied from, the references below.
- **Dislikes ("slop"):** image-model pictures that draw the maths; dark boxed labels pasted over figures.
- **Process:** ask questions, offer ideas and templates. Show options as a **playground** with enough settings to choose from and to tune layout; the user sends back a settings line. The user judges visually, never from diffs. Keep tokens low.

Not yet planned: short films, generative art, image-model illustrations, agent-written widgets. Propose blocks for them only after C10h, and ask the user first.

Taste and learning style, with sources: [learner.md](learner.md). Project goal and rules: [AGENTS.md](../AGENTS.md).

## Who does what
You are the costly model. Your work is to decide, write short briefs, look at screenshots, settle disputes and talk with the user. Hand off the rest. A worker cannot hand work on (the dispatcher refuses a nested run), so you route every run yourself.

| Work | Who | Flags |
|---|---|---|
| Mock-ups, playgrounds, kit code, lints, example YAML, fixes | Opus 5.5 medium (more effort only if a run fails at medium) | `--to claude --model opus --effort medium --role worker` |
| Reading many files or pages, finding where something lives, browsing references, taking and sorting screenshots, counting tokens, digesting a chat, first-pass checks | Terra 6.1 high | `--to codex --model gpt-6.1-terra --effort high` (`--role reviewer` when it must not edit) |
| Code review, in proportion (ledger, "Who does what") | Terra 6.1 high, or Grok 4.7 high when the user says | `--to codex --model gpt-6.1-terra --effort high --role reviewer`; `--to grok --model grok-4.7 --effort high --role reviewer`; a second round resumes each with `--session` |
| Deep research or repo clean-up | Sol 6.1 xhigh | `--to codex --model gpt-6.1-sol --effort xhigh` |
| Second eye on design, new ideas (on trial in C10i) | Gemini 4 Argon high | `--to agy --model gemini-4-argon-high --effort high --role reviewer` |
| The user's map artifact (link under Sources) | an in-chat Opus subagent, which has the Artifact tool | update in place, same link, at a block's end |
| **You, by hand** | the look page in C10i; a mock-up that failed your gate twice; the ledger and this file | — |
| Visual choices, approvals | the user | a playground and its settings line |

Rule of thumb: reading more than about three files, or writing more than about thirty lines of code, is a worker's job. Do not review code diffs yourself; read the reviewer's findings and probe only a disputed one.

All runs go through the dispatcher. Failure rule: if `status` is not success or `.model` differs, report `error_message` and `.model` verbatim and stop; never swap models.

```
python3 ~/.claude/skills/agent-delegate/scripts/delegate.py --to … --model … --effort … --role worker|reviewer --workspace /Users/tusharsingh/Work/Project/viz-os-dev --timeout 1800 < brief.md > run.json 2> run.err
```

## The design gate (yours, before the user sees anything)
Only the user reviewed the look before; now you do first. Open the screenshots and hold them against the look numbers (design §4) and the block's reference pictures. Fail it for: a figure that fills under 60% of its plate, a label box or text over a mark, a control that does not move the mark the scene is about, more than 4 mark hues, anything that moves without its number changing. One send-back to Opus, then show the user.

## A brief, in order (short; point to paths, never paste content)
1. **Goal:** two lines.
2. **Read:** the paths, with line spans when you know them.
3. **Look at:** the look stylesheet (after C10i), and the 2–4 pictures the design names for the block (§6, "Pictures to name in briefs"), each with one line to borrow and one not to copy.
4. **Do not touch:** `plugins/` during mock-ups; the user's own files always.
5. **Write to:** `out/c10/<block>/`.
6. **Checks to run:** the quick check (`docs/testing.md` §1) for kit changes; console errors and numbers for mock-ups.
7. **Report:** ≤ 80 lines, pictures linked.

## Spending rules
- **Free first:** pictures, GIFs and contact sheets come from the scripts already in `out/c10/*/` (`shots.py`, `build.py`, Playwright); numbers from `make_data.py` and `verify_data.py`. No model needed.
- Read a run's `status`, `model` and its report file, not the full `response` or logs; open `run.err` only on failure.
- Run long jobs in the background; Opus builds take 10–25 minutes, Terra reads 2–5, Argon about 8.
- Reviewers probe on a bench or the two quick-check lessons, never the full `check-all.sh`. Codex and Grok reviewers run unsandboxed: check `git status` after each.
- Only one block edits `plugins/` at a time. A mock-up-only block (C10i half 1) can run in a second chat beside it.
- What reaches every lesson must cost the lesson agent no extra reading or YAML; the rest is adv-only and documented in `class/adv.md`, not in `board.md` or `lesson.md` (design §2).

## Sources
| What | Where |
|---|---|
| The design: chooser, look numbers, blocks, pictures per block | [c10-plan-v2.md](c10-plan-v2.md) |
| Why lessons look alike (figure counts per example) | `out/c10/plan2/inventory.md` |
| The references, sorted and ranked; ideas from Argon | `out/c10/plan2/refs.md`, `out/c10/plan2/argon.md` |
| Reference pages | [ciechanow.ski/bicycle](https://ciechanow.ski/bicycle/), [Pele diagrams](https://pele-art-diagrams.vercel.app/), [kevintngo.com](https://kevintngo.com), [CNN Explainer](https://poloclub.github.io/cnn-explainer/) |
| How they are made (Terra) | `out/c10/inspire/notes.md`; screenshots `out/c10/inspire/shots/` |
| The user's clip and images | `out/c10/inspire/src/video.mp4` (frames `video-sheet.png`); the 9 images `out/c10/inspire/user-shots/` (sheet `user-sheet.png`; 1–2 a pricing graphic, 3–4 drawn cell division, 5–7 the slop to avoid, 8 CNN Explainer, 9 Ciechanowski's Moon) |
| The user's study chat (the "right idea" of what to show) | https://chatgpt.com/share/6af12b8b-6f80-83ea-b3dd-a5dbd9018f98; digest `out/c10/inspire/gptchat.md`, full text `gptchat-full.md` |
| Options and token costs (Sol) | `out/c10/research.md` |
| The H&E picture plan (first draft) | `out/c10/plan.md` (bottom table) |
| 3D mock-ups and the first playground (the shell C10i reuses) | `out/c10/h3d/` (`b2-play.html`, `src/play.js`, `src/play.css`, `report.md`) |
| Block reports | `out/c10/c10b/report.md`, `out/c10/c10d/report.md`, `out/c10/c10e/report.md` |
| Test benches: H&E, and the test of proportions (C10k) | `out/c10/bench/`, `out/c10/bench-prop/` (each `lesson.yaml`, `make_data.py`, `verify_data.py`) |
| Earlier motion mock-ups (feed C10c) | `out/c10/proto/` |
| Why each kit choice was made | `plugins/viz-os/docs/design.md` |
| Checks | `docs/testing.md` §1 (quick check) |
| Map picture for the user | https://claude.ai/artifact/2r7angg1HBwSeyk2UQMDpV (the ledger is the truth) |

Read reports and the ledger; open source files only for the span you need.

## Your loop
Follow "The loop for every block" in the ledger. At a block's end: set its status, add a Decisions line, update State now, refresh this file's "Where we are", and have a subagent bring the map artifact up to date.
