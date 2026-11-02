# What a lint message means

Read this after a build or a check fails. `lesson.py` prints the deck's messages and these. `ERR` must be fixed; `WARN` is a judgement call, fixed unless you have a reason.

| Message (shortened) | Fix |
|---|---|
| `N scenes; a lesson is 8–14` | add the missing beats, or split into a series |
| `the first scene after the title … is a plan scene` | start with `beat: plan` |
| `the plan is its picture, so it has no lines of text` | delete the `say` and keep the `flow` |
| `a formula scene before any problem scene` | show the problem first |
| `no limits scene` / `limits comes after next` | add one, before `next` |
| `a what-if scene with no picture` | add a `chart` or `plane` whose marks read the slider |
| `no summary scene` | a `recap` slide that answers the opening question, before `next` |
| `no next scene` / `the next tease is the last scene` | one `next` scene, at the end |
| `a class lesson has no quiz cards` | delete the slide; keep any good question as a `think` stop |
| `a class lesson has no recall cards` | delete `recall:`; reach back with a `think` stop near the start |
| `no lead` | one short line linking the scene to the last |
| `N steps (≤ 10)` | split the scene |
| `6 steps in a row with no think stop` | add a `think` step |
| `` `say` has N words (≤ 14) ``; also `think q` and an item's `say` (≤ 14), `note` (≤ 16), `think a` (≤ 18) | cut it, or move the rest to the next step |
| `` `beat` is …; use one of … `` | a beat from the list above |
| `unknown step field` / `a step needs say` | steps take `say`, `add`, `mark`, `think`, `frame` |
| `` `calc` has no field X `` (also `col`, `eqn`, `assemble`, `params`) | a comma inside an unquoted `{ }` value split it into a second key: quote the value |
| `each added item is one of …` | a typo in an item key, or an item at the wrong level |
| `` `mark: …` is not a target `` | `row:<i>`, `col:<key>`, `cell:<i>:<key>`, `#<id>` |
| `symbol X shows on slide …, but its number first shows on …` | show the number first: a worked line, a column, or `{{name}}` |
| `` `assemble` uses X, whose number was not worked in an earlier by-hand scene `` | work it by hand first |
| `a formula scene builds its formula with an assemble item` | add the `assemble` |
| `` `assemble` has a line between its numbers and its symbols `` | add a step after it |
| `an assemble with tex needs plug` / `a number in plug has no tag` | write `plug` with each number as `[name:number]` |
| `N terms: more than 5 is a wall` | build it over two scenes |
| `typed number N in say matches X` | write `{{X|fmt}}` |
| `` `ops` has N steps and each one takes a board step `` | add that many board steps after it |
| `a calc with row: reads that row of the scene's table` | give a row number from 0, and a `table` |
| `` `params` name X is not in data, derive or the worked lines `` | work it first, or add it to data |
| `` `rows: X` names data, which a table cannot read `` | write `from: X` |
| `the line for X has its own name as its formula` | write the formula from the names it is made of |
| `plane mark N is one of …` / `plane line takes 3 values` | one mark kind per entry; quote expressions with commas |
| `a plane with fill stretches its axes` | delete `fill`, or drop the `vector`, `foot` or `square` |
| `` control …: `run` is the number of frames `` / `stops … are not frames` | `run` ≥ 2; stops between 0 and run − 1 |
| `the run stops on N frames, one per step, but the scene has M steps` | one stop per step, or `frame:` on the steps |
| `one run per scene` | split the scene |

The browser check adds: `a plane is N wide per 1 tall` (change its ranges, or the spacing of what it shows), `a chart is W × H px` (set its `ratio`), `a plane is only W × H px` (give it more room, or split the scene), `a formula renders under 20px`, `a table cell renders under 18px`, `mark target not found`, `a worked line … reads ≈` (finer `fmt` on the inputs), `point … is outside the picture` / `plane mark N is outside the box` (widen the box), `the plane label … overlaps` (shorter names, or move a mark), `a formula is wider than its box` (split it: at 20 px, above its text, it still does not fit), and `X works out to … on the board but the data says …` (`make_data.py` and the page disagree: fix one).
