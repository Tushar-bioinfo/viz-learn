# viz-os workshop

This repo improves **viz-os**: `deck` slides, `class` board lessons and `sketch` drawn pages, each one self-contained HTML file. Agents write YAML; the fixed kit draws it.
The goal: a cold agent on any harness, given only `plugins/viz-os/` teaches from the ground up and passes lint, browser, numbers and eyes; lessons and pages also pass pedagogy. The honest test is a cold start.
Build learning material with the installed plugin in another folder. Put repo test outputs in `out/` (git-ignored). `CLAUDE.md` and `GEMINI.md` link here.

## Read before you work
Read the learner profile once; then only the task-specific row. `plugins/viz-os/` ships; `docs/` does not.

| Doc | Read it when |
|---|---|
| `docs/learner.md` | how the user learns, visual taste and working style |
| `docs/README.md` | file map and history index |
| `docs/architecture.md` | file ownership: read only the deck, class or sketch section needed |
| `docs/testing.md` | before claiming a change works: §0 docs only, §1 quick check, §1b full run, §1c deck seam, §2 cold start |
| `plugins/viz-os/docs/design.md` | before reversing a choice: find the affected row |
| `docs/backlog.md` | open problems and new findings, indexed by skill |
| `docs/todo-draw-math.md` | the user says "work on our to-do list": do the first change not `done`, one per session, following its "How we work" |
| `docs/c10-visuals.md` | the user says "work on C10…": an advanced-visuals block, with its state and who does what |
| `docs/release.md` | you bump the version, add an agent harness, commit, or push |

## Rules
- **Keep the build green.** After any change to `kit/`, `scripts/`, a skill file or an example, run the quick check (two lessons plus the touched cases, `docs/testing.md` §1). For now the work is on the `class` skill only: run the full `tools/check-all.sh` (about 10 minutes) only when a change edits `skills/deck/` or `skills/sketch/`, and before a release. Report the counts it prints, from its actual output; if it could not run, say "not checked".
- **Try a change on one or two lessons, not on all of them** (the user, 9 Nov). After a kit, lint or look change, build, check and look at 1–2 lessons of different types that it affects (a plane lesson and a 3D bench, say), and stop there. Do not rebuild, redraw or fix the other examples to match: note what they would need in `docs/backlog.md`, and touch them only when the user asks. Put this line in every worker's brief.
- **Look at the contact sheets** in `out/check/` after a visual change. A clean check does not prove a deck teaches.
- **Skill files ship; docs do not.** Never point a skill file at `docs/` or the repo root (`tools/check_docs.py` checks this). A rule the building agent needs belongs in its own skill.
- **One rule, one place.** Prefer a lint or check over a prose rule; prose decays in long outputs.
- **Every number is computed.** Example numbers come from a seeded `make_data.py`; `verify_data.py` recomputes them with separate code. Never type a number into a slide.
- **Never hand-edit a built `deck.html`.** Change the YAML or kit and rebuild.
- **Keep the manifests in sync** (`tools/check_manifests.py`): one name, one version, everywhere.
- Write skill files in plain words: short sentences, active voice, each term defined once as `plain words (term)`. Keep numbers and units exact.
- Record a choice someone could undo by mistake in `plugins/viz-os/docs/design.md`; record a found or fixed problem through `docs/backlog.md`.
- Do not commit, push, or bump the version unless the user asks. Do not trigger GitHub reviews or other external automation.

## UPDATE dispatch
For an explicit `UPDATE`, follow `docs/update.md`. Use `tools/update.py` for checks, publication and existing installations; read detailed logs only on failure or for required review. UPDATE authorizes that scoped release, while preserving unrelated work.
