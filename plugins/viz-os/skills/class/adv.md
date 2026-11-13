# adv: plan the pictures before the scenes

Read this only when the user says "adv". It adds one probe question, a picture plan in the spine, and a storyboard the user approves before you write data or scenes. A plain lesson does none of this.

## 1. The probe gains question 5
Add it to the probe in `SKILL.md` step 1:
```
5. How deep on each idea?  a) 1–2 pictures or examples per idea (default)  b) 3–4, more worked cases  c) a number
```
Store the answer in the top of `lesson.yaml` as `learner: {goal: …, knows: […], anchors: […], depth: 2}` (a whole number from 1 to 6; a = 2, b = 4).

## 2. The plan: a stub for every scene
After the spine's top, write every scene as a stub, in reading order. Write block style: one field per line, never `{ }`, because a comma or a `?` in a value breaks there.
```yaml
  - type: board
    beat: picture
    idea: closest
    see: residual
    shows: your guess on the sheet, the left-over length live, then the true drop
    title: The nearest mix
    lead: Slide your guess along the sheet and watch what is left over.
```
- `idea`: what the learner is stuck on, from the table below (or your own, §4).
- `see`: the one mark that must carry the point (the witness, §6). Use the label or `id` you will give that mark.
- `shows`: the picture in words, in one line.
Scenes with beat `plan`, `summary` or `next` carry no idea: give them `type`, `beat` and `title` only. The stubs later become the scenes: add `steps` under each, and keep the three fields.

## 3. The idea table
| `idea` | The learner asks | The picture | Draw it today with |
|---|---|---|---|
| `made-of` | where does this number come from? | whole → one part → its numbers | the scene's `table`, `calc`, `product`, `vec`, `matrix`; `strip` when the whole is a picture (board.md) |
| `amount` | how much, what share? | countable units, a level that fills | `units`, `parts`, `stat`, `chance` |
| `cause` | what happens if I change this? | one handle moves one mark | `plane`, `chart`, `space`, `dist` |
| `closest` | which choice is best? | your guess, its error, then the answer | `plane`, `space` |
| `shortcut` | why not the easy way? | the wrong way as a ghost on the same frame | `plane`, `space`, `chart`, `compare` |
| `process` | how does it move, step by step? | a run with stops and a trail | `plane`, `chart`, `space`, `ops` |
| `connect` | how do the pieces feed each other? | input, operation, output, lit together | `flow`, `ops`, `product`, `assemble` |
| `outcomes` | what can happen? | one start, 2–3 aligned ends | `fork` (§9b), `compare`, `parts` |
| `chance` | is this difference real? | dots as draws, the gap in noise units | `chance` (§9), `dist`, `chart` |
| `angle` | what does it look like from the right side? | a named view the camera turns to | `space`, `plane` |
| `like` | what is it like? | two matched pictures, and where the match breaks | `compare` |

## 4. Your own idea
The table is a menu, not a fence. When no row fits, write the learner's question in their words, ending in `?`:
```yaml
    idea: why does a log turn shares into steps?
```
Then no picture family is checked; `shows` says the picture, and `see` and the foil rule (§6) still apply.

## 5. Depth
Up to `depth` scenes may work on one idea: a second example, a second picture. More than that: merge scenes, or ask the learner for more depth. Two scenes count as one idea when they share a table name, or the same own question (case and spaces aside).

## 6. The contract for every adv figure
- **Witness:** the mark named in `see`. Its shape shows the point without reading text, and a teacher line links its word (`==residual==`).
- **Handle:** at most one control per figure, and it moves the witness. The control wears the colour of the thing it moves.
- **Foil:** a `shortcut`, `misconception` or `limits` scene draws the wrong way and the right way on one frame.

## 7. The storyboard: wait for an OK
```bash
python3 C/scripts/storyboard.py lessons/<slug>/lesson.yaml   # writes storyboard.svg beside the yaml
```
It prints the path and one line (`10 scenes, 8 ideas, depth 2`). Show `storyboard.svg` to the user: one card per scene, with an icon for its idea; pointing at a card shows its `shows` and `see`. Ten cards with the same icon mean ten scenes that teach the same way. **Wait for an OK** before you make the data and write the scenes. Change the plan the user asks for, and run the storyboard again.

## 8. What the lint checks
A lesson is adv once any board scene has `idea`.
- Every scene but `plan`, `summary` and `next` has `idea`, `see` and `shows` (error).
- `idea` is a table name or a question ending in `?`; a near miss gets "did you mean" (error).
- Once a scene has steps: a table idea draws with one of its items (error).
- `see` names something the scene draws: a mark's label or `id`, a chart series, a symbol it shows, or a table column. If it names a mark, a `lead`, `say` or think question links its word; a think answer does not count (error).
- A `shortcut`, `misconception` or `limits` scene holds two states on one frame: a `compare`, a control the figure reads (directly or through `derive`), or a mark that shows on a later `step:` or under `when:` (error).
- One idea in more scenes than `depth` (warning): merge, or ask for more depth.
- `learner.depth` is a whole number from 1 to 6 (error).
- `idea`, `see` or `shows` on a slide that is not a board (error, in any lesson).
A spine of stubs fails the lint for its missing `steps`, and other lints warn about what is not written yet; the checks above that look at a figure wait for steps. The storyboard never runs the lint.

## 9. The `chance` figure: is a gap between two shares bigger than chance makes?
```yaml
- chance:
    groups:
      - {name: well, n: n1, ill: xw, color: s4}    # n: units (1–100); ill: how many have the outcome
      - {name: piped, n: n0, ill: xp, color: s1}
    step: step       # one noise step, as a share; leave out for no ruler
    tally: fr_far    # optional: exactly one 0 or 1 per frame of the scene's run, frame 0 first
    axis: share of homes with an ill child (%)
```
It draws each group as squares, 10 a row, the `ill` ones filled; one share line with a dot per group; the **gap** between the dots (the witness); with `step`, a ruler from the lower share with a tick per **noise step**; with `tally`, a square per frame, grey once the run reaches it and in the gap's colour where the list holds 1. `n`, `ill` and `step` are numbers or names, so a run's `derive` (`xw: at(fr_well, draw)`) redraws it, each change eased.
- Its marks are the two group names, `gap` and `noise step`: legend entries and linked words (`==gap==`, `==noise step:noise steps==`), so no group may take the names `gap` or `noise step`, and a scene holds one `chance`. Optional `says:` on a group, `gap_says:` and `step_says:` fill their cards.
- The lint, on each state of a run or slider: exactly two groups with two names; `n` a whole number 1–100; `ill` 0 to that state's `n`; `step` above 0, the gap at most 12 steps; a list read with `at(list, draw)` covers every state; `tally` needs a run and one entry per frame. Arithmetic it cannot read passes; the browser check warns if the page clamps it.

## 9b. The `fork` figure: what can happen, side by side
```yaml
- fork:
    start: {name: "one cell, copies lined up", draw: [{part: cell, state: metaphase, chroms: parent}]}
    ends:
      - {via: shared evenly, name: two healthy cells, num: "{{n_even}} and {{n_even}} chromosomes", draw: [{part: cell, chroms: even_a}, {part: cell, chroms: even_b}]}
      - {via: one copy strays, name: wrong count, bad: true, num: "{{n_up}} and {{n_down}} chromosomes", draw: [{part: cell, chroms: un_a}, {part: cell, chroms: un_b}]}
    see: one copy strays    # the end lit at rest: the witness
```
It draws the start at the top and the 2 or 3 ends in a row below it, each reached by a curved path. Each path carries its `via` (how this end comes about, 3 words at most). Under each end are its `name` (4 words at most, in red with `bad: true`) and `num`, a line whose numbers come only from `{{…}}`. The end named by `see` is lit: an orange path, the others dimmed. Pointing at an end, pressing it or a linked word (`==shared evenly==` or `==two healthy cells==`) lights that end instead. It fills the reading column, and a scene holds one `fork`.
- Drawn parts (`draw`, 1–3 an end): `cell` (plain, metaphase, dividing, dead), `nucleus`, `chromosome` (pair, single), `tissue` (plain, regions), `tube` (filled, empty), `plate` (filled, empty), `read` (full, short), `droplet` (empty, cell, bead, both, two), `lens`. Each takes `state`, and if you like `color` (a kit colour), `size` (40–240 px) and `turn` (degrees).
- A cell's `chroms` names a data list from make_data.py: one letter per chromosome kind, with `*` after a damaged copy (`[A, B, C*]`). Each kind keeps one colour across the figure; a fork colours 4 kinds apart.

## 10. Space figures the learner moves: views, a hunt, a split
The camera glides only when the learner presses something; a step never moves it.
```yaml
space:
  axes: [OD red, OD green, OD blue]
  views: {2: face, 5: edge}   # step: fit, edge (along the sheet), face (square on to it), or {yaw, pitch}
```
- **A view (`views`)** becomes a pressable word at the end of its step's line (*face-on*, *edge-on*, *across*, *from the start*). A view on step 1 is where the figure starts. A view on a `think` step turns the figure when its answer opens; once the learner has turned the figure by hand, the answer offers its word instead.
- **A hunt** is one step. The learner drags a dot on a sheet to find the point nearest `from`:
  ```yaml
  - hunt: {from: px, on: [H, E], start: hunt_start}   # start: a data name holding 2 amounts
    q: Where is the nearest mix?
    a: 'The ==residual== meets the sheet square. You were ==gap:{{gap|3}} off==.'
  ```
  The kit adds the guess's line from `from` (`==your line==`, its length `{{line|3}}`) to the question. Show answer and Next wait until the learner drags. The answer glides the guess to the foot, leaves a dashed ghost where it was, draws the `residual` drop and the dashed `gap` from the ghost, and turns the figure `edge` (unless `views` names another view for that step). It needs a `sheet` on the same two vectors, added at or before the hunt.
- **A split** is one mark. The learner drags two arrow tips to reach a point by one vector, then the other:
  ```yaml
  - {split: ft, along: [H, E], start: split_start, foil: true, label: your split, step: 2}
  ```
  Each part is drawn in its vector's colour, from the origin and tip to tail. The names `part_a`, `part_b` (the two amounts) and `miss` (how far the tip is from the point) go in lines. The first `think` at or after `step` moves the tips onto the point when its answer opens. `foil: true` adds the `shortcut` on the step after that think: square drops onto each vector alone, a common wrong answer whose amounts are `short_a` and `short_b`. The figure needs a `sheet` on the same two vectors.
- Under the hood a hunt and a split make controls with `drag` (`guess`, `was`, `split`): their handles replace slider rows. The kit-made `guess` mark takes `on` and `was`; the `split` mark takes `by` and `to`. Do not write these by hand.
- The lint stops on: a hunt with no `from`, no `on`, or no matching sheet; a split whose two vectors are parallel or have no sheet; a split with no `think` after it; a `start` that is not a data name with 2 numbers; a view word that names no view; a `views` key that is not a step; and a name of yours (in the scene, the data or the lesson's `derive`) that clashes with the kit's: `hunt_a`, `hunt_b`, `hunt_wa`, `hunt_wb`, `hunt_fa`, `hunt_fb`, `line` and `gap` for a hunt; `part_a`, `part_b`, `split_fa`, `split_fb`, `miss`, `short_a` and `short_b` for a split. It also stops on a sheet whose `max`/`min` is not 2 numbers or whose `min` is not below its `max`, a hunt field it does not know, a split point off the sheet, and a start or an answer the learner cannot drag to inside the sheet as drawn. What the lint cannot read (a point made by a formula) the page checks, and the browser check warns. A think's own `set` is kept beside the split's.
