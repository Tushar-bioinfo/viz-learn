# Workshop index

Start with [AGENTS.md](../AGENTS.md) for the goal and rules and [learner.md](learner.md) for the user's taste. Read by task or heading; this index is not a reading list.

## Live work
| Need | Read |
|---|---|
| Where we stand | [map.yaml](map.yaml): each block's status; `python3 tools/block_map.py --check` draws `out/map/index.html` |
| "Work on our to-do list" | [todo-draw-math.md](todo-draw-math.md): How we work, Changes, then the relevant Decisions |
| "Work on C10…" | [c10-visuals.md](c10-visuals.md): block, dependencies and State now; use draw-math's How we work |
| New C10 planner | [c10-handoff.md](c10-handoff.md): the user's wishes, sources, who to delegate cheap work to; then the block's rows in [c10-plan-v2.md](c10-plan-v2.md), the design |
| Open problems | [backlog.md](backlog.md): routes to class, deck/shared and sketch details |
| Token cost of a build | [inefficiencies.md](inefficiencies.md): the waste found, what was fixed, good practice; measure with `tools/session_cost.py` |
| Checks for this change | [testing.md](testing.md): choose the applicable section; setup is §4 |
| Release or explicit UPDATE | [release.md](release.md) / [update.md](update.md); no release is implied by ordinary work |

## File map
| Need | Where |
|---|---|
| Which file to edit | [architecture.md](architecture.md): deck file table, The class skill, The sketch skill, Packaging |
| Why a choice was made | [design.md](../plugins/viz-os/docs/design.md): search the affected feature; includes measurements and teaching sources |
| Shipping entry points | [deck](../plugins/viz-os/skills/deck/SKILL.md), [class](../plugins/viz-os/skills/class/SKILL.md), [sketch](../plugins/viz-os/skills/sketch/SKILL.md) |
| Deck authoring | `plugins/viz-os/skills/deck/`: `probe.md` for questions, `story.md` for teaching/review, `spec.md` for fields; `kit/` renders, `scripts/` builds/checks, `examples/` supplies regression decks |
| Class authoring | `plugins/viz-os/skills/class/`: `lesson.md` owns teaching (sketch reads it too), `board.md` owns fields, `lint.md` is read after an error; `kit/`, `scripts/`, `examples/` implement and test it |
| Sketch authoring | `plugins/viz-os/skills/sketch/`: `page.md` owns fields/parts; `kit/`, `scripts/`, `examples/` implement and test it; needs class and deck siblings |
| Repo checks | `tools/`: regression, docs, manifests, UI, cases, memory, tidy, sketch and palette checks; see testing.md for when |

## History
[archive/README.md](archive/README.md) indexes the pre-cleanup notes and past test results. They are evidence, not current instructions. `docs/.ignore` excludes the archive from normal ripgrep searches; for history use `rg --no-ignore PATTERN docs/archive`.
