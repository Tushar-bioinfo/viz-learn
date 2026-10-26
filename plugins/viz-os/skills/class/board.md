# lesson.yaml: the board reference

Read this when you write scenes (loop step 4). `lesson.md` says what each scene is for; this file says how to write it. A lesson is a deck file (the sibling deck's `spec.md`) with `board` scenes in it, so every deck field, visual, expression and number format works here too. This file covers what the board adds. Copy patterns from `examples/board-gallery/lesson.yaml`, which uses every item below.

## Top level
```yaml
title: How spread out are six cells?
subtitle: Variance, built on the board one line at a time
question: How do we put one number on how spread out a set of measurements is?   # asked on the title slide
answer: Take each value's distance from the mean, square it, add the squares, and divide by n − 1.
learner: {goal: intuition+hand, knows: [mean], anchors: [flow cytometry]}        # from the probe
# beats: plan · problem · data · by-hand · picture · formula · run · limits · summary · next   (the spine, one line per scene)
series: spread        # the series this lesson belongs to (memory.py's name for it)
episode: 2            # its place in the series, from 1
recall: [../what-is-variance]    # earlier lessons whose review cards open this one (lesson 2 onward; see Series)
home: cells           # the learner's home table this lesson reads (its rows and provenance are in data.json)
data_file: data.json  # every number, made by make_data.py
abbr: {SD: standard deviation, CD3: a T-cell surface marker}
symbols:
  xbar: {tex: '\bar{x}', says: the mean CD3 level, short: mean, fmt: 2}
  i: {tex: 'i', says: which cell, kind: index}
slides: [ … ]
```
`series`, `episode`, `recall` and `home` are the board's own top-level keys; the rest are the deck's.

### Symbols
Every name that appears in a formula, a worked line or a parameter card gets a symbol.
| Field | What it does |
|---|---|
| `tex` | how the symbol is written, in single quotes: `'\bar{x}'` |
| `says` | its meaning in plain words (about 6 words) |
| `short` | 2–3 words, the label under the symbol in a formula and on a parameter card |
| `fmt` | how its number is shown in working (`2`, `s3`, `,`) |
| `color` | a fixed colour for the symbol, its number and its table column: `s1`, `s2`, `s3`, `good`, `bad`. Without it, the inputs of each line take s1, s2, s3 in order |
| `kind` | `index` (i, j) or `operator` (Σ): no number to show first, so the symbol ledger skips it |

A symbol shows only after its number (`lesson.md` §3). A table column, a worked line, a `{{name}}` in text, or a parameter card all count as showing the number.

## A board scene
```yaml
- type: board
  beat: by-hand            # one of: plan problem data by-hand picture formula run what-if limits summary next
                           #         analogy compare misconception aside
  title: Work it out by hand
  lead: Distance from the mean, for every cell, then one number.
  table: {from: cells, cols: [{key: id, label: cell}, {key: cd3, label: CD3}]}
  derive: {sq: (cd3 - xbar)^2}     # scene-level names, recomputed when a control moves
  controls: [ … ]                  # a slider, a run or a toggle (see Controls)
  steps: [ … ]                     # one teacher line per click
```
| Field | What it does |
|---|---|
| `beat` | what the scene is for; drawn as the small label above the title ("By hand", "What if", "A common mix-up") |
| `title` | the claim, 4–8 words |
| `lead` | one short line that links this scene to the last; every scene after the plan has one |
| `table` | the pinned table on the left (about 30% of the width). Leave it out and the work area takes the full width |
| `derive`, `controls` | as on a deck slide, plus the run and the toggle |
| `steps` | 1–10 steps. A full board must fit the stage at its last click; split a scene that does not |

### The zones
The board has fixed zones, filled by order, never by coordinates:
- **Table column** (left): the pinned table, then any `note` or `params` with `side: true`.
- **Work area** (right): a text column (worked lines, equations, notes, parameter cards, comparisons, matrix steps) and a picture column (planes, charts, images, other deck visuals). With both, they sit side by side.
- **Formula strip**: under both columns, present only when a step adds an `assemble`. If the scene opens with the `assemble`, the strip sits on top.
- **Teacher band** (foot): the current step's `say:` line.

Every item stays on the board once added. The current item is orange (`now`); earlier ones turn grey (`past`). The board never reflows: space for every item is kept from the first click.

### The table
```yaml
table:
  from: cells                                  # a data name holding a list of rows (records)
  cols:
    - {key: id, label: cell}
    - {key: cd3, label: CD3, fmt: 1}
    - {key: dev, label: distance, expr: cd3 - xbar, fmt: 2}   # a column worked from each row
```
`from` names a list of rows in the data, never `rows:` (that crashes in the browser; the lint stops it). A column is a `key` read from each row, or an `expr` worked on each row; `label` is its header and `fmt` its number format. A plain string (`cols: [id, cd3]`) is a column with its key as its label. Keep 3–8 rows, in the source's layout: a row per cell, or a row per gene. The table never moves between clicks (the check measures it).

## Steps
```yaml
steps:
  - say: Start from the mean. How far does c1 sit from it?       # the teacher's line, ≤ 24 words
    add: {calc: {say: How far c1 sits, row: 0, expr: cd3 - xbar, name: d1, fmt: 2}}
    mark: row:0
  - think:
      q: Why not add the distances up as they are?
      a: 'They cancel: the sum is {{sum_dev|2}}. The mean sits where the pluses and minuses balance.'
```
| Field | What it does |
|---|---|
| `say` | one teacher line for this click, at most 24 words |
| `add` | one item, or a list of items, placed on this click |
| `mark` | lights a table row, column, cell or item for this click only (see Marks) |
| `think` | a pause-and-think stop: `{q, a}`. It takes two clicks: the question (after `say`, if there is one), then the answer with whatever the step adds |
| `frame` | the run frame this click shows (see Controls) |

A think step's `say` is optional; its question is the line. At least one think stop in any 6 steps in a row (a quiz slide resets the count). A think question has one short answer the learner can reach from the board.

### Marks
| Target | Lights |
|---|---|
| `row:4` | the table's fifth row (rows count from 0, as in `at()`) |
| `col:cd3` | a table column, by its `key` |
| `cell:4:cd3` | one cell |
| `#total` | an item with `id: total` |

`mark` takes one target or a list. It lights for one click; a think step's mark lights on both its clicks. A target not yet on the board is ignored, and the check warns `mark target not found`. A `calc` with `row:` lights its row, and the cells it reads, by itself.

### Highlights in text
- `==s1:CD3==`: the words in bold, in that colour (`s1`, `s2`, `s3`, `good`, `bad`, `mist`). Match a term's symbol and column colour. A few words per scene.
- `**3.1×**`: bold, for a result.
- `==text==`: an orange underline. Rare: once or twice a lesson, for the line to remember.
- `$…$`: maths, in KaTeX.

## Items
Each item is one key under `add:`. Most take an `id`, so `mark: '#id'` can point at it later.

### `calc`: one worked number
```yaml
add: {calc: {say: How far c1 sits, why: below the mean, so negative, row: 0, expr: cd3 - xbar, name: d1, fmt: 2}}
```
Drawn as a numbered line: `d₁ = xᵢ − x̄ = 4.3 − 5.70 = −1.40`, symbol = formula = numbers = result.
| Field | What it does |
|---|---|
| `say` | a short label for the line (≤ 9 words) |
| `why` | a grey half-line after it (≤ 12 words) |
| `row` | reads that row of the table (from 0): a table column's name in `expr` takes that row's value, and its cell lights in the line's colour |
| `expr` | the computation, an expression over data, derive, earlier lines and the row |
| `name` | names the result, so later lines and `{{name}}` can use it. A name that is also in `data.json` must come out the same, or the check warns that `make_data.py` and the page disagree |
| `fmt` | rounds the result only; each input shows with its own `fmt` |
| `id` | for `mark: '#id'` |

The working must add up by hand at the rounding shown, or the line reads ≈ and the check warns: give the inputs a finer `fmt`.

### `col`: a new table column
```yaml
add: {col: {key: sq, label: squared, expr: (cd3 - xbar)^2, fmt: 2}}
mark: col:sq
```
Adds a column worked on every row, on this click. `key`, `label`, `expr`, `fmt` as in the table. Pair it with `mark: col:<key>`.

### `eqn`: a formula in symbols
```yaml
add: {eqn: {say: The standard deviation, lhs: sd, expr: sqrt(s2)}}
```
`lhs` is the name on the left; `expr` (an expression, drawn as TeX) or `tex` (TeX with `[name]` terms, as in `assemble`) is the right. Each term takes its colour and its `short` name under it. No numbers: use it after the numbers are known.

### `assemble`: the formula built from our numbers
The formula scene's core (`lesson.md` §3). On its click the strip shows **Our numbers**; on the next click, **In symbols** appears under it, each term in the same colour and named. So the step after it must say what the symbols are.

With an expression, the numbers row is worked for you:
```yaml
add: {assemble: {say: The variance, lhs: s2, expr: ss / (n - 1), fmt: 2}}
```
With TeX, write both rows yourself:
```yaml
add:
  assemble:
    say: The variance of our six cells
    lhs: s2
    tex: '\dfrac{\sum_{[i]} ([cd3] - [xbar])^2}{[n] - 1}'
    plug: '[s2:{{s2|2}}] = \dfrac{([cd3:{{at(cd3, 0)|1}}] - [xbar:{{xbar|1}}])^2 + \cdots}{[n:{{n}}] - 1}'
```
| Field | What it does |
|---|---|
| `say`, `lhs`, `fmt`, `id` | as on `calc` |
| `expr` | the formula as an expression; its numbers row comes from the data |
| `tex` | the formula in TeX; each term written `[name]` |
| `plug` | the same formula with our numbers, each tagged `[name:number]` with the term it stands for, numbers from `{{…}}` |

Every term must have been worked by hand in an earlier scene (the lint checks). More than 5 terms is a wall: build it over two scenes.

### `params`: a card of named numbers
```yaml
add: {params: {say: 'The line, at this update', names: [w0, w1, w2], side: true}}
```
Each name shows its symbol in its colour, its value now and its `short` name; it follows the sliders and the run. Every name must be in data, derive or a worked line so far. `side: true` puts it under the table.

### `note`: a short line of text
```yaml
add: {note: 'The means are ==s1:{{mA|1}}== and ==s2:{{mB|1}}==, but B is **{{ratio|1}}×** as variable as A.'}
add: {note: {text: '**The update:** $w_j \leftarrow w_j + \eta\, y\, x_j$', side: true, id: rule}}
```
A string, or `{text, side, id}`. One or two sentences; the board is not for paragraphs.

### `compare`: two cases side by side
```yaml
add:
  compare:
    a: {title: Donor A, tone: good, verdict: tight, text: 'Cells close to the mean.', visual: {stat: {value: '{{sA|2}}', label: variance}}}
    b: {title: Donor B, tone: bad, text: 'Cells far from the mean.', visual: {stat: {value: '{{sB|2}}', label: variance}}}
```
`a` and `b` each take a `title`, and optionally `text`, `tone` (`good` ✓ or `bad` ✗), `verdict` (the word beside the tick; default "works" / "fails") and a small `visual`. A chart inside a side gets little room; prefer a `stat`.

### `ops`: a matrix step
```yaml
add:
  ops:
    matrix: {name: marker levels, from: cells, cols: [cd3, cd19, cd4], row: cell, col: marker, fmt: 1, focusCol: cd19}
    steps:
      - {op: cols, fn: var, name: mvar, tex: 's^2', label: variance, fmt: 2, say: Find each marker's variance, why: Each column is its own set.}
```
The deck's matrix steps (`spec.md`, Matrix steps), drawn in the text column. Its first step lands on this click and each further step takes the next click, so add one board step after it per matrix step. `notation: false` on the `ops` item hides the deck's notation chip (`x_ij` = …); use it when the card is narrow, since the chip can spill out of it, and say what the row and column are in `says:` instead.

### Deck visuals
`chart`, `dist`, `stat`, `units`, `parts`, `flow` and `image` go in the picture column, written as on a deck slide (`spec.md`, Visuals and Charts), with `caption`, `alt` and `labels` beside them:
```yaml
add:
  chart:
    x: {cats: [c1, c2, c3, c4, c5, c6], label: cell}
    y: {label: CD3 level, min: 0, max: 10}
    series: [{name: CD3, kind: lollipop, x: 'seq(0, 5, 1)', y: cd3, color: s1}]
    marks: [{kind: hline, y: xbar, label: 'mean {{xbar|1}}', step: 2}]
  caption: The tallest stick sits farthest above the line.
```
A chart mark's (or an image label's) `step` counts board steps: `step: 2` shows on the scene's second step. Dots on a category axis sit at the left edge of their band: add 0.5 to `x` to centre them.

An `image` is only for when the user asks for a picture (`D/scripts/image.py`). The picture has no text; put labels on it: `labels: [{text: c1, at: [0.08, 0.88]}]` (fractions from the top left, ≤ 4 words), and always `alt`.

### `plane`: geometry with equal scales
A coordinate plane with one scale for both axes, so a slope, a right angle and a square look like what they are.
```yaml
add:
  plane:
    x: {label: CD3, min: 0, max: 10}
    y: {label: CD19, min: 0, max: 10}
    marks:
      - points: {from: cells, x: cd3, y: cd19, label: id}
      - {line: ['-xbar', 0, 1], color: accent, label: 'mean {{xbar|1}}'}
      - {foot: {from: [far_i, 'at(cd3, far_i - 1)'], line: ['-xbar', 0, 1]}, color: ink, label: distance, step: 2}
```
`x` and `y` take `label`, `min` and `max` (expressions allowed). Every value in a mark is an expression; **quote one that has a comma** (`'at(cd3, 2)'`), since a comma splits a YAML list. A line `[w0, w1, w2]` is the set where w0 + w1·x + w2·y = 0, so a flat line at height m is `['-m', 0, 1]` and an upright one at x = m is `['-m', 1, 0]`.

| Mark | Takes | Draws |
|---|---|---|
| `points` | `{from, x, y, by, label, colors}` | a dot per row of `from`; `x`, `y` are row keys; `label` names each dot from a key; `by` a key that picks the colour from `colors: {T: {color: s1, label: T cell}}` (each colour joins the legend) |
| `point` | `[x, y]` | one dot; `name` labels it |
| `line` | `[w0, w1, w2]` | the line across the box (a line that misses the box says so in the legend) |
| `shade` | `[w0, w1, w2]` | the half of the box where w0 + w1·x + w2·y > 0; `side: '-'` shades the other half |
| `segment` | `[[x1, y1], [x2, y2]]` | a line between two points; `name` labels its middle |
| `vector` | `[dx, dy]`, `from: [x, y]` | an arrow from `from` (default the origin) |
| `foot` | `{from: [x, y], line: [w0, w1, w2]}` or `{from, dir: [dx, dy]}` | the drop from a point to a line, or onto a direction through the origin (a projection), with a right-angle tick |
| `square` | `[[x1, y1], [x2, y2]]` | the square built on that segment, on its left (`side: right` for the other side): a squared distance as an area |
| `text` | a label, with `at: [x, y]` | free text on the plane |
| `ring` | `[x, y]` | a ring around a point: "this one" |

Every mark also takes:
| Field | What it does |
|---|---|
| `step` | the board step it appears on (default: the step that adds the plane) |
| `color` | `accent`, `s1`, `s2`, `s3`, `ink`, `mist`, `good`, `bad`, … |
| `label` | its legend entry above the plane |
| `name` | a label beside the mark itself (point, segment, vector, foot) |
| `dash` | `true` for a dashed line or segment |
| `when` | an expression; the mark is drawn only while it is not 0 (`when: prev` with a toggle; `when: 'at(has_next, t)'` in a run) |

Labels are placed clear of dots, lines and other labels; when no place is clear, the check warns. A mark outside the box warns too: widen `min`/`max`.

## Controls
`controls:` on a scene takes three kinds. Each `name` becomes a variable for expressions on that scene.

**A slider**, as on a deck slide:
```yaml
controls: [{name: shift, label: move c5 by, min: -3, max: 3, step: 0.1, value: 0, fmt: 1}]
```

**A run**: frames 0 … n − 1 of an iterative process, with a scrubber, a frame count and a play button. It plays only when the viewer presses play.
```yaml
controls:
  - {name: t, run: 12, label: updates, stops: [0, 1, 2, 11], every: 1.3}
derive:
  w0: at(w0_trace, t)        # make_data.py stores every frame; the page only picks frame t
```
| Field | What it does |
|---|---|
| `run` | the number of frames, 2 or more. Store each frame's values as lists in `data.json` and read them with `at(list, t)` |
| `stops` | the frame each click shows, one per step in order (default 0, 1, 2 and the last). The run needs as many stops as the scene has steps, or a `frame:` on its steps |
| `every` | seconds per frame when playing (0.3–10; default 1.3) |
| `label` | the words beside the scrubber |

Instead of `stops`, a step may set `frame: 5`; each click then shows the frame of the latest step that set one. One run per scene. Choose stops on the first two frames and the last; let the learner scrub the middle.

**A toggle**: two buttons, 0 and 1.
```yaml
controls:
  - {name: prev, toggle: [hide, show], label: last line, step_at: 3}
```
`toggle` is two labels, `[off, on]`; the name is 0 for the first, 1 for the second. Use it with `when:` on a mark, or in an expression.

`step_at` (any control) hides the control until that step, so it appears with the question that asks the learner to use it. The check moves every slider, run and toggle to both ends.

## Series, recall and home
A series is 2–3 lessons, each its own folder and `lesson.yaml`, on the same home table:
```
lessons/
  what-is-variance/   lesson.yaml  data.json  make_data.py  verify_data.py  lesson.html
  computing-variance/ lesson.yaml  …          # series: spread, episode: 2, recall: [../what-is-variance]
```
- `series` and `episode` name the lesson's place. An episode after 1 with no `recall:` warns.
- `recall: [paths]` lists earlier lessons, relative to this file; a folder means its `lesson.yaml`. List them oldest first: the last one is the most recent.
- The build copies their review cards into a quiz titled "Before we start: from last time", right after the title slide: the most recent lesson's first cards, then the first card of each older one, at most 5 in all. So put each lesson's most important card first.
- A recalled card shows the numbers its own lesson showed. The build reads that lesson's `data.json` (and inline `data:`) and renames each name a card reads, so `{{n}}` from lesson 1 becomes a separate name (`r1_n`). Lesson 1's `n` and this lesson's `n` can differ.
- `home: <name>` names the home table (`C/scripts/home.py`, written to `~/.viz-os/home/<name>.json`, or under `$VIZOS_HOME` when it is set). `make_data.py` reads that file and writes the rows it uses into `data.json`, plus `"home": {"name": …, "provenance": {…}}` copied from the file, so each lesson keeps its own copy and says where it came from. The build does not read the home file; it reads only `data.json`.

The plan and recall quiz come first: title, recall quiz, then the `plan` scene.

## Review cards
The last slide:
```yaml
- type: quiz
  cards:
    - q: Why square the distances?
      a: So cells below the mean do not cancel cells above it, and far cells count most.
    - q: 'Our six cells had mean {{xbar|1}}. What do their plain distances from it add up to?'
      a: 'Zero, always: that is what makes it the mean.'
```
5–8 cards, each `q` and `a`. A card may read data with `{{…}}`; every name it reads must be in this lesson's data, so a later lesson can recall it.

The summary scene is a deck `recap` slide: `{type: recap, answer: …, points: [ … ]}`. Any other deck slide type (`predict`, `table`, `bridge`, …) may sit between board scenes when it teaches better, and counts as a scene.

## Lint messages
`lesson.py` prints the deck's messages and these. `ERR` must be fixed; `WARN` is a judgement call, fixed unless you have a reason.

| Message (shortened) | Fix |
|---|---|
| `N scenes; a lesson is 8–14` | add the missing beats, or split into a series |
| `the first scene after the title … is a plan scene` | start with `beat: plan` |
| `a formula scene before any problem scene` | show the problem first |
| `no limits scene` / `limits comes after next` | add one, before `next` |
| `a what-if scene with no picture` | add a `chart` or `plane` whose marks read the slider |
| `no summary scene` | a `recap` slide that answers the opening question, before `next` |
| `no next scene` / `after the next tease only the review cards follow` | one `next` scene, then the quiz |
| `end with the review cards` / `N review cards; use 5–8` | a last `quiz` slide of 5–8 cards |
| `no lead` | one short line linking the scene to the last |
| `N steps (≤ 10)` | split the scene |
| `6 steps in a row with no think stop` | add a `think` step |
| `` `say` has N words (≤ 24) `` | move the rest to the next step |
| `` `beat` is …; use one of … `` | a beat from the list above |
| `unknown step field` / `a step needs say` | steps take `say`, `add`, `mark`, `think`, `frame` |
| `` `calc` has no field X `` (also `col`, `eqn`, `assemble`, `params`) | a comma inside an unquoted `{ }` value split it into a second key: quote the value |
| `each added item is one of …` | a typo in an item key, or an item at the wrong level |
| `` `mark: …` is not a target `` | `row:<i>`, `col:<key>`, `cell:<i>:<key>`, `#<id>` |
| `symbol X shows on slide …, but its number first shows on …` | show the number first: a worked line, a column, or `{{name}}` |
| `` `assemble` uses X, whose number was not worked in an earlier by-hand scene `` | work it by hand first |
| `a formula scene builds its formula with an assemble item` | add the `assemble` |
| `` `assemble` shows its symbols row on the next click `` | add a step after it |
| `an assemble with tex needs plug` / `a number in plug has no tag` | write `plug` with each number as `[name:number]` |
| `N terms: more than 5 is a wall` | build it over two scenes |
| `typed number N in say matches X` | write `{{X|fmt}}` |
| `` `ops` has N steps and each one takes the next click `` | add that many board steps after it |
| `a calc with row: reads that row of the scene's table` | give a row number from 0, and a `table` |
| `` `params` name X is not in data, derive or the worked lines `` | work it first, or add it to data |
| `` `rows: X` names data, which a table cannot read `` | write `from: X` |
| `the line for X has its own name as its formula` | write the formula from the names it is made of |
| `plane mark N is one of …` / `plane line takes 3 values` | one mark kind per entry; quote expressions with commas |
| `` control …: `run` is the number of frames `` / `stops … are not frames` | `run` ≥ 2; stops between 0 and run − 1 |
| `the run stops on N frames, one per click, but the scene has M steps` | one stop per step, or `frame:` on the steps |
| `one run per scene` | split the scene |
| `review card N reads X, which is not in data.json` | add X to `data.json`, or compute it in the card |
| `` recall: … not found `` / `has no review cards` / `a review card reads X, which is not in that lesson's data.json` | fix the path, or the earlier lesson |
| `` recall: wants to add r1_X, but this lesson's data already has that name `` | rename this lesson's `r1_X` |
| `episode N has no recall:` | name the earlier lesson |

The browser check adds: `the pinned table moved between steps`, `the work area overflows` / `the board is too full for one scene` (split it), `mark target not found`, `a worked line … reads ≈` (finer `fmt` on the inputs), `point … is outside the picture` / `plane mark N is outside the box` (widen the box), `the plane label … overlaps` (shorter names, or move a mark), `a formula is wider than its box` (split it), and `X works out to … on the board but the data says …` (`make_data.py` and the page disagree: fix one).

## YAML gotchas
- Quote any value that starts with `{{` or holds `{{…}}` inside a `{ }` mapping: `label: 'mean {{xbar|1}}'`.
- Quote text with `: ` in it, and any text with a `?` inside a `{ }` mapping.
- Put TeX in single quotes: `tex: '\bar{x}'`. In double quotes `\b` and `\f` become control characters.
- Inside `[ ]`, a comma splits items: quote `'at(cd3, 2)'`, and write a list item that has a comma as a block list.
- An apostrophe inside single quotes is doubled: `'the ringed cell''s values'`.
- `- think:` with `q:` and `a:` indented under it; `say:` beside `think:`, not inside it.
