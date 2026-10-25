# viz-learn: the viz-os workshop

This repo builds **viz-os**, a plugin that turns "teach me X" into one self-contained HTML learning deck. The agent writes only `deck.yaml`; a fixed kit draws every slide; a lint and a browser check enforce the rules.
Work here improves the plugin. Do not make decks for learning a topic here: use the installed plugin in another folder. Put test decks and check output in `out/` (git-ignored).
`CLAUDE.md` and `GEMINI.md` are links to this file, so every agent reads the same start-up notes.

## The goal
An independent agent, on any harness, given only `plugins/viz-os/`, builds a deck that passes the four gates (lint, browser, numbers, eyes) and teaches from the ground up. Judge every change by that. The honest test is a cold start (`docs/testing.md`).

## Who the decks are for
A biologist and bioinformatician who learns visually. Each deck should show intuition from the ground up, transformations and dot products, row-wise / column-wise / whole-matrix steps with the rows or columns read and the shape made, distributions with their parameters, notation, assumptions, where each formula comes from and what it is related to, predict questions, and step tables with the why. Plots carry the story, not text. The look is proff-viz 5.0.0 (flat dark plates, thick grey borders, one orange). Decks are for a laptop or desktop screen; phone layout exists but is not checked. Pictures from an image model only when the user asks. Keep it token-efficient: YAML in, kit does the design.

## Where things are
| Path | What it is |
|---|---|
| `plugins/viz-os/` | **The plugin.** Everything here ships to users. |
| `plugins/viz-os/skills/deck/SKILL.md` | entry point the agent reads every time: the loop, the four gates, the rules |
| `…/deck/probe.md`, `story.md`, `spec.md` | read at probe, spine/review, and slide-writing time |
| `…/deck/kit/` | `vizos.css` + `core.js` (expressions, stats) + `chart.js` + `slides.js` + `ops.js` (matrix steps) + `deck.js` (navigation, fit, audit) |
| `…/deck/scripts/` | `build.py` (lint, then yaml → html), `check.py` (Playwright desktop audit), `image.py` (opt-in picture) |
| `…/deck/examples/` | three decks; they double as the regression tests |
| `plugins/viz-os/docs/design.md` | decisions and why, colour measurements, learning-science sources (ships, but skill files never point at it) |
| manifests | one per agent family; see `docs/release.md` |
| `docs/` | notes for people and agents working on the plugin; **not shipped** |
| `tools/` | `check-all.sh` (the regression run), `check_manifests.py` |

## Read before you work
| Doc | Read it when |
|---|---|
| `docs/architecture.md` | you need to know which file controls what, or where a new rule or slide type belongs |
| `docs/testing.md` | before you say a change works; to run a cold-start test |
| `plugins/viz-os/docs/design.md` | before you reverse or redo something; it says why things are the way they are |
| `docs/backlog.md` | you look for open problems, or you leave one behind |
| `docs/release.md` | you bump the version, add an agent harness, commit, or push |

## Rules
- **Keep the build green.** Run `tools/check-all.sh` after any change to `kit/`, `scripts/`, a skill file or an example. Report the counts it prints, from its actual output; if it could not run, say "not checked".
- **Look at the contact sheets** (`out/check/<example>/desktop.png`) after a visual change. A clean check does not prove a deck teaches.
- **Skill files ship; docs do not.** Never point a file under `skills/deck/` at `docs/` or the repo root. A rule the deck-building agent needs goes in `SKILL.md`, `probe.md`, `story.md` or `spec.md`. Notes for plugin builders go in `docs/`.
- **One rule, one place**, at the level that needs it. Prefer a lint or check over a prose rule: prose decays in long outputs, a linter does not.
- **Every number is computed.** Example numbers come from a seeded `make_data.py`; `verify_data.py` recomputes them with separate code. Never type a number into a slide.
- **Never hand-edit a built `deck.html`.** Change the YAML or the kit and rebuild.
- **Keep the manifests in sync** (`tools/check_manifests.py`): one name, one version, everywhere.
- Write skill files in plain words: short sentences, active voice, each term defined once as `plain words (term)`. Keep numbers and units exact.
- Record a choice someone could undo by mistake in `design.md`; record a found or fixed problem in `docs/backlog.md`.
- Do not commit, push, or bump the version unless the user asks. Do not trigger GitHub reviews or other external automation.

## Setup
Python 3 with `pyyaml`, `playwright` (then `playwright install chromium`) and `pillow`; `numpy` and `scipy` for the verify scripts. Built decks load Inter and JetBrains Mono from Google Fonts and KaTeX 0.16.11 from cdnjs (`build.py --katex-dir`, `check.py --vendor` for offline machines).
