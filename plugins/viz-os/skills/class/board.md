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
home: cells           # the learner's home table this lesson reads (its rows and provenance are in data.json)
data_file: data.json  # every number, made by make_data.py
abbr: {SD: standard deviation, CD3: a T-cell surface marker}
symbols:
  xbar: {tex: '\bar{x}', says: the mean CD3 level, short: mean, fmt: 2}
  i: {tex: 'i', says: which cell, kind: index}
slides: [ … ]
```
`series`, `episode` and `home` are the board's own top-level keys; the rest are the deck's. `recall` is an error in a lesson.

### Symbols
Every name that appears in a formula, a worked line or a parameter card gets a symbol.
| Field | What it does |
|---|---|
| `tex` | how the symbol is written, in single quotes: `'\bar{x}'` |
| `says` | its meaning in plain words (about 6 words) |
| `short` | 2–3 words, the label under the symbol in a formula and on a parameter card |
| `fmt` | how its number is shown in working (`2`, `s3`, `,`) |
| `color` | a fixed colour for the symbol, its number, its table column and every place it shows in math: `s1` to `s5`, `good`, `bad`. A symbol keeps one colour across the page, and across every lesson of a series: set `color` by hand when it returns, since the automatic pick depends on what else the lesson lists. Without `color` it takes the next unused colour at the start, in the order listed, and `ink` once they run out; a `kind: operator` symbol takes none. Set it to pair symbols that belong together, like `w_1` and `x_1` |
| `kind` | `index` (i, j) or `operator` (Σ): no number to show first, so the symbol ledger skips it |

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
  steps: [ … ]                     # one teacher line per step
```
| Field | What it does |
|---|---|
| `beat` | what the scene is for; drawn as the small label above the title ("By hand", "What if", "A common mix-up") |
| `title` | the claim, 4–8 words |
| `lead` | one short line that links this scene to the last; every scene after the plan has one |
| `table` | the pinned table on the left (30% of the width). Leave it out and the scene takes the full width |
| `derive`, `controls` | as on a deck slide, plus the run and the toggle |
| `steps` | 1–10 steps. Split a scene that needs more |

### How a scene is laid out
A lesson is one long page, a scene after a scene. You give the order; the kit places everything, never by coordinates. A scene is a head (beat label, title, lead), then its steps in order. What is written stays, and the learner scrolls back to it. Only a think answer waits.

- **Lines**: steps before the first figure run down the page. All text starts at the page's left edge, like a paper; only figures and equations sit in the middle.
- **Figure block**: a figure (`plane`, `chart`, `image`, `stat`, `units`) starts a block. It holds the figure and the steps after it, until the next figure or a wide item. The figure sits at the left of the page and stays in view while its lines scroll past beside it, 20 px away. The figure is sized first, from 70% of the page; the text takes all that is left, never under 30%. Side by side needs 520 px of figure and 300 px of text. A narrower window, or a formula too long for the text column at 20 px, puts that figure above its lines, in the middle of the page.
- **Wide items** (`assemble`, `compare`, `ops`, `dist`, `parts`, `flow`) run the full width and end the block. A wide figure sits in the middle at 1100 px or the page, and may reach 1280 on a big window. A formula card and a `compare` run the page, with their text on its left edge and a formula's equations in the middle.
- **Table scene**: the table stays in view in the left 30%, then any `note` or `params` with `side: true` under it. The rest of the scene sits to its right. A table too wide for 30% takes the room it needs; if that leaves under 520 px, it goes on top and does not stay in view.
- **Reading**: as a step passes the reading line, 45% down the window, it lights up, the table's next column fills in and the row in use lights. Hovering a step does the same. Scrolling never changes a figure.
- **Next and Back**: a figure gets them only if it changes: a mark, series or label with `step`, a run's frames (`frame:` or `stops`), an `ops` step. With one state it has no buttons. It starts at its first stop. A click on a line goes to its stop, and the ← → keys step the figure nearest the reading line.
- **Sizes**: a figure owns its shape. A plane's comes from its axis ranges, a chart's from its `ratio`, an image's from the image. The layout gives a width and a height limit, never a box to fill. With the scene's head at the top of the window, a figure and its buttons fit on screen.

### The table
```yaml
table:
  from: cells                                  # a data name holding a list of rows (records)
  cols:
    - {key: id, label: cell}
    - {key: cd3, label: CD3, fmt: 1}
    - {key: dev, label: distance, expr: cd3 - xbar, fmt: 2}   # a column worked from each row
```
`from` names a list of rows in the data, never `rows:` (that crashes in the browser; the lint stops it). A column is a `key` read from each row, or an `expr` worked on each row; `label` is its header and `fmt` its number format. A plain string (`cols: [id, cd3]`) is a column with its key as its label. Keep 3–8 rows, in the source's layout: a row per cell, or a row per gene.

## Steps
```yaml
steps:
  - say: Start from the mean. How far does c1 sit from it?       # the teacher's line
    add: {calc: {say: How far c1 sits, row: 0, expr: cd3 - xbar, name: d1, fmt: 2}}
    mark: row:0
  - think:
      q: Why not add the distances up as they are?
      a: 'They cancel: the sum is {{sum_dev|2}}. The mean sits where the pluses and minuses balance.'
```
| Field | What it does |
|---|---|
| `say` | one teacher line for this step, at most 14 words |
| `add` | one item, or a list of items, written with this step |
| `mark` | lights a table row, column, cell or item while this step is lit (see Marks) |
| `think` | a pause-and-think stop: `{q, a}`, the question at most 14 words, the answer at most 18. The question shows with a Show answer button, after `say` if there is one. The answer takes no room until pressed. What the step adds, even to a figure or a table, waits behind the answer |
| `frame` | the run frame this step shows (see Controls) |

A think step's `say` is optional; its question is the line. A think question has one short answer the learner can reach from the board. On a figure with Next, a stop on a think step takes two presses: the first asks and leaves the figure alone, the second answers and moves it.

### Marks
| Target | Lights |
|---|---|
| `row:4` | the table's fifth row (rows count from 0, as in `at()`) |
| `col:cd3` | a table column, by its `key` |
| `cell:4:cd3` | one cell |
| `#total` | an item with `id: total` |

`mark` takes one target or a list. It lights for one step; a think step's mark lights on its question and its answer. A target not yet on the board is ignored, and the check warns `mark target not found`. A `calc` with `row:` lights its row, and the cells it reads, by itself.

### Highlights in text
The kit colours worked lines and their table cells for you. In your own text:
- `==s1:CD3==`: the words in bold, in that colour (`s1` to `s5`, `good`, `bad`, `mist`). Match a term's symbol and column colour. A few words per scene, never a whole sentence.
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
Adds a column worked on every row. It keeps its place, with its row lines, and fills in when the reading reaches this step. `key`, `label`, `expr`, `fmt` as in the table. Pair it with `mark: col:<key>`.

### `eqn`: a formula in symbols
```yaml
add: {eqn: {say: The standard deviation, lhs: sd, expr: sqrt(s2)}}
```
`lhs` is the name on the left; `expr` (an expression, drawn as TeX) or `tex` (TeX with `[name]` terms, as in `assemble`) is the right. Each term takes its colour and its `short` name under it; when two names would touch, or the formula has a fraction, they move to one key row under the formula. No numbers: use it after the numbers are known.

### `assemble`: the formula built from our numbers
The formula scene's core (`lesson.md` §3). One full-width plate holds **Our numbers**, then the next step's line, then **In symbols**, each term in the same colour and named. So the step after it must say what the symbols are.

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
A string, or `{text, side, id}`. At most 16 words; the board is not for paragraphs.

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
The deck's matrix steps (`spec.md`, Matrix steps), drawn at full width with their own Back and Next. Its first step lands on this step and each further one on the next board step, so add one board step after it per matrix step. `notation: false` on the `ops` item hides the deck's notation chip (`x_ij` = …); use it when the card is narrow, since the chip can spill out of it, and say what the row and column are in `says:` instead.

### Deck visuals
`chart`, `stat`, `units` and `image` are figures, and `dist`, `parts` and `flow` are wide items, all written as on a deck slide (`spec.md`, Visuals and Charts), with `caption`, `alt` and `labels` beside them:
```yaml
add:
  chart:
    x: {cats: [c1, c2, c3, c4, c5, c6], label: cell}
    y: {label: CD3 level, min: 0, max: 10}
    series: [{name: CD3, kind: lollipop, x: 'seq(0, 5, 1)', y: cd3, color: s1}]
    marks: [{kind: hline, y: xbar, label: 'mean {{xbar|1}}', step: 2}]
  caption: The tallest stick sits farthest above the line.
```
`ratio` beside a `chart`, `dist` or `units` sets its shape, width to height (`ratio: 2:1`; default 16:9; a chart must stay between 1:1 and 2.2:1). An image keeps its own shape.

A chart mark's (or an image label's) `step` counts board steps: `step: 2` shows on the scene's second step. Dots on a category axis sit at the left edge of their band: add 0.5 to `x` to centre them.

An `image` is only for when the user asks for a picture (`D/scripts/image.py`). The picture has no text; put labels on it: `labels: [{text: c1, at: [0.08, 0.88]}]` (fractions from the top left, ≤ 4 words), and always `alt`.

### `plane`: geometry with equal scales
A coordinate plane with one scale for both axes, so a slope, a right angle and a square look like what they are. It fills its room by showing more of the plane: both axes widen on both sides at one scale, and ticks, grid and shading follow. The `x` and `y` ranges you write are the least it shows.

Add `fill: true` to a plane that is a scatter, a line or a shaded side, with no right angle or length the lesson relies on. It takes the chart shape, 16:9 (up to 2:1 on a short window), with its own scale per axis, and fills its column. It cannot hold a `vector`, `foot` or `square`. Leave it off when the lesson compares the spread along the two axes, as a plot of PC scores does: one scale keeps that comparison true.
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
| `color` | `accent`, `s1` to `s5`, `ink`, `mist`, `good`, `bad`, … |
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
| `run` | the number of `frames`, 2 or more. Store each frame's values as lists in `data.json` and read them with `at(list, t)` |
| `stops` | the frame each step shows, in order (default 0, 1, 2 and the last). The run needs as many stops as the scene has steps, or a `frame:` on its steps |
| `every` | seconds per frame when playing (0.3–10; default 1.3) |
| `label` | the words beside the scrubber |

Instead of `stops`, a step may set `frame: 5`; each Next stop then shows the frame of the latest step that set one. One run per scene. Choose stops on the first two frames and the last; let the learner scrub the middle.

**A toggle**: two buttons, 0 and 1.
```yaml
controls:
  - {name: prev, toggle: [hide, show], label: last line}
```
`toggle` is two labels, `[off, on]`; the name is 0 for the first, 1 for the second. Use it with `when:` on a mark, or in an expression.

A control sits under the figure it drives: the first figure that reads its name, otherwise the scene's last figure, otherwise the end of the lines. The check moves every slider, run and toggle to both ends.

## Series and home
A series is 2–3 lessons, each its own folder and `lesson.yaml`, on the same home table:
```
lessons/
  what-is-variance/   lesson.yaml  data.json  make_data.py  verify_data.py  lesson.html
  computing-variance/ lesson.yaml  …          # series: spread, episode: 2
```
- `series` and `episode` name the lesson's place.
- A later lesson reaches back with a think stop near its start, not with cards (`lesson.md` §7). Copy any number it needs into this lesson's data with `make_data.py`, or compute it with `{{…}}`. If `make_data.py` reads an earlier lesson's `data.json` and that lesson was tidied, run `tidy.py --restore` on it first.
- `home: <name>` names the home table (`C/scripts/home.py`, written to `~/.viz-os/home/<name>.json`, or under `$VIZOS_HOME` when it is set). `make_data.py` reads that file and writes the rows it uses into `data.json`, plus `"home": {"name": …, "provenance": {…}}` copied from the file, so each lesson keeps its own copy and says where it came from. The build does not read the home file; it reads only `data.json`.

## The plan and the summary
The plan is its picture: a `plan` scene has one step, `add` with a `flow`, and no `say`. The `flow` draws as a row of numbered squares, the first one filled, with each `title` under its square and any `sub` under that.

The summary scene is a deck `recap` slide: `{type: recap, answer: …, points: [ … ]}`. Any other deck slide type (`predict`, `table`, `bridge`, …) may sit between board scenes when it teaches better, and counts as a scene.

## YAML gotchas
- Quote any value that starts with `{{` or holds `{{…}}` inside a `{ }` mapping: `label: 'mean {{xbar|1}}'`.
- Quote text with `: ` in it, and any text with a `?` inside a `{ }` mapping.
- Put TeX in single quotes: `tex: '\bar{x}'`. In double quotes `\b` and `\f` become control characters.
- Inside `[ ]`, a comma splits items: quote `'at(cd3, 2)'`, and write a list item that has a comma as a block list.
- An apostrophe inside single quotes is doubled: `'the ringed cell''s values'`.
- `- think:` with `q:` and `a:` indented under it; `say:` beside `think:`, not inside it.

When a build or a check fails, read `lint.md`.
