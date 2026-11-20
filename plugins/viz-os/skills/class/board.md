# lesson.yaml: the board reference

Read this when you write scenes (loop step 4). `lesson.md` says what each scene is for; this file says how to write it. A lesson is a deck file (the sibling deck's `spec.md`) with `board` scenes in it, so every deck field, visual, expression and number format works here too. This file covers what the board adds; the top-level `recall` is an error here. Copy patterns from `examples/board-gallery/lesson.yaml`, which shows every plain board item below (of the deck visuals, not `units` or `dist`).

## Top level
```yaml
title: How spread out are six cells?
subtitle: Variance, built on the board one line at a time
question: How do we put one number on how spread out a set of measurements is?   # in full; the title slide shows only `title`
answer: Take each value's distance from the mean, square it, add the squares, and divide by n − 1.
learner: {goal: intuition+hand, knows: [mean], anchors: [flow cytometry], voice: short}   # from the probe and the profile
# beats: problem · data · by-hand · picture · formula · run · limits · next   (the spine, one line per scene)
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

### Symbols
Every name that appears in a formula, a worked line or a parameter card gets a symbol.
| Field | What it does |
|---|---|
| `tex` | how the symbol is written, in single quotes: `'\bar{x}'` |
| `says` | its meaning in plain words (about 6 words) |
| `short` | ≤ 2 words, the bold name on the symbol's pop-up card and on a parameter card |
| `term` | the field's own name for it, ≤ 4 words (`standard error`), at the foot of its pop-up card; a mark, a control, a `chance` group and `beads` take it too |
| `fmt` | how its number is shown in working (`2`, `s3`, `,`); for a matrix or vector, decimals only (`fmt: 1`) |
| `color` | a fixed colour for the symbol, its number, its table column and every place it shows in math: `s1` to `s5`, `good`, `bad`. A symbol keeps one colour across the page, and across every lesson of a series: set `color` by hand when it returns, since the automatic pick depends on what else the lesson lists. Without `color` it takes the next unused colour at the start, in the order listed, and `ink` once they run out; a `kind: operator` symbol takes none. Set it to pair symbols that belong together, like `w_1` and `x_1` |
| `kind` | `index` (i, j) or `operator` (Σ): no number to show first, so the symbol ledger skips it. `matrix` or `vector`: its numbers come from the data under the symbol's name (a list of rows, or a flat list), and it is drawn in brackets (see `matrix` and `vec`) |
| `cols`, `rows` | a matrix or vector's colours: one per column (`cols`), or one per row or entry (`rows`), as `s1`…`s5` or a hex |

## A board scene
```yaml
- type: board
  beat: by-hand            # one of: problem data by-hand picture formula run what-if limits next
                           #         analogy compare misconception aside, and refresher (at the end, below)
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
| `lead` | one short line that links this scene to the last; every scene after the first has one |
| `table` | the pinned table on the left (30% of the width). Leave it out and the scene takes the full width |
| `derive`, `controls` | as on a deck slide, plus the run and the toggle |
| `steps` | 1–10 steps. Split a scene that needs more |
| `more` | the scene's context and limits: what the reader may want after the scene, in plain text. It opens from a closed **Context and limits** fold at the scene's end |
| `sources` | pages you read for this scene, as `{title, url, why}` (below); listed at the end of its Context and limits fold |
| `ask` | a `refresher` scene's link line, a question at most 14 words ("Rusty on angles and cosine?"); only a refresher has one |

### How a scene is laid out
A lesson is one long page, a scene after a scene. You give the order; the kit places everything, never by coordinates. A scene is a head (beat label, title, lead), then its steps in order. What is written stays, and the learner scrolls back to it. Only a think answer waits.

- **Lines**: steps before the first figure run down the page. All text starts at the page's left edge, like a paper; only figures and equations sit in the middle.
- **Figure block**: a figure (`plane`, `space`, `chart`, `image`, `stat`, `units`) starts a block. It holds the figure and the steps after it, until the next figure or a wide item. The figure sits at the left of the page and stays in view while its lines scroll past beside it, 20 px away. The figure is sized first, from 70% of the page; the text takes all that is left, never under 30%. Side by side needs 520 px of figure and 300 px of text. A narrower window, or a formula too long for the text column at 20 px, puts that figure above its lines, in the middle of the page.
- **Wide items** (`assemble`, `compare`, `ops`, `dist`, `parts`, `flow`) run the full width and end the block. A wide figure sits in the middle at 1100 px or the page, and may reach 1280 on a big window. A formula card and a `compare` run the page, with their text on its left edge and a formula's equations in the middle.
- **Table scene**: the table stays in view in the left 30%, then any `note` or `params` with `side: true` under it. The rest of the scene sits to its right. A table too wide for 30% takes the room it needs; if that leaves under 520 px, or a worked line runs past the work's edge, it goes on top and pins as a smaller strip at the top of the window (the reading line moves just under it). A table taller than half the window then scrolls with the page: keep 3–8 rows.
- **Reading**: as a step passes the reading line, 45% down the window, it lights up, the table's next column fills in and the row in use lights. Hovering a step does the same. Scrolling never changes a figure.
- **Next and Back**: a figure gets them only if it changes: a mark, series or label with `step`, a run's frames (`frame:` or `stops`), an `ops` step. With one state it has no buttons. It starts at its first stop. A click on a line goes to its stop, and the ← → keys step the figure nearest the reading line.
- **Sizes**: a figure owns its shape. A plane's comes from its axis ranges, a space is 4:3, a chart's from its `ratio`, an image's from the image. The layout gives a width and a height limit, never a box to fill. With the scene's head at the top of the window, a figure and its buttons fit on screen.

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

### `picture`: the scene's drawing
Every board scene after the title has a picture (a lint error in a whole lesson): a figure item, or `picture:` beside `lead`, drawn full width above the steps; a whole lesson draws at least one `picture:`. One kind; the kit computes every number in it from the names you give:
```yaml
picture: {ruler: {from: cells, x: cd3, pin: xbar, lit: 0}}          # a middle: each row a weight at x, the ruler balanced at pin; lit rings row 0
picture: {cast: {from: cells, square: cd3 - xbar, lit: top_ids}}    # squared distances: each row's square, its area the value; lit: ids
picture: {machine: {from: cells, x: cd3, stations: [{op: values, say: six levels}, {op: minus, of: xbar}, {op: square}, {op: sum, out: ss}, {op: share, by: n - 1, out: s2}]}}   # a formula's steps; or {terms: [{w: u1^2, of: v1}, …], out: s2u}
picture: {pair: {a: {name: Donor A, values: donor_a, value: sA}, b: {…}, axis: CD3 level}}             # two cases on one scale
picture: {grid: {from: cells, row: 0, x: d1, y: d2, arrow: [u1, u2], sum: [[v1, c12], [c12, v2]]}}   # one row's shadow, (a + b)² as tiles, the 2 × 2 sum
picture: {ghost: {from: cells, x: d1, y: d2, line: th, name: best line, foil: {line: tg, name: worse line}}}   # a wrong reading; angles in degrees
```
A picture is drawn once, so it reads data only, no control or derive. `from` is a list of rows; `x`, `y` and `square` are worked on each row, and `label` names a row by a column (default `id`). Stations run values → minus → square → sum → share, each once, `say` ≤ 5 words; `out` must match what the station makes. The lint lists each kind's fields.

## Steps
```yaml
steps:
  - say: Start from the mean. How far does c1 sit from it?       # the teacher's line
    why: Spread is about how far cells sit from their centre.     # the reason, in grey at the end of the line
    add: {calc: {say: How far c1 sits, row: 0, expr: cd3 - xbar, name: d1, fmt: 2}}
    mark: row:0
  - think:
      q: Why not add the distances up as they are?
      a: 'They cancel: the sum is {{sum_dev|2}}. The mean sits where the pluses and minuses balance.'
```
| Field | What it does |
|---|---|
| `say` | one teacher line for this step, at most 14 words. In the full voice (`learner.voice: full`), 2 or 3 sentences, at most 50 words, each sentence at most 24 |
| `why` | the reason for this step, drawn in grey at the end of its `say`, at most 12 words (full voice: one sentence, 24). Say why we do it or what it lets us do next, not what it does. A step that adds a `calc`, `col` or `assemble` needs one (a `calc`'s own `why` counts) |
| `add` | one item, or a list of items, written with this step |
| `mark` | lights a table row, column, cell or item while this step is lit (see Marks) |
| `think` | a pause-and-think stop: `{q, a}`, the question at most 14 words, the answer at most 18 (full voice: 24 and 40). The question shows with a Show answer button, after `say` if there is one. The answer takes no room until pressed. What the step adds, even to a figure or a table, waits behind the answer. Add `transfer: <field>` (at most 6 words) to make it the lesson's transfer stop, tagged **Elsewhere** with the field named before the question: one a lesson, in its last third (`lesson.md`, move 21) |
| `frame` | the run frame this step shows (see Controls) |
| `more` | extra reading for this step: `{ask, answer, sources}`, a closed fold after what the step writes (see Extra reading) |
| `refresh` | the `id` of a refresher scene at the end; the step shows that scene's `ask` and a **Refresher ▸** link under its line (see Refreshers) |

A think step's `say` is optional; its question is the line. A think question has one short answer the learner can reach from the board. On a figure with Next, a stop on a think step takes two presses: the first asks and leaves the figure alone, the second answers and moves it.
### Extra reading
A fold (the gallery's by-hand scene has one) starts closed and opens with a click on its own `+`. Put in a fold what a curious learner asks next: why this choice, where a rule comes from, what the field calls it. The page must teach without it. One step fold a scene (the lint warns past one); the scene's own `more` holds the rest.
- **Give every term its meaning in the fold too**, the first time it appears there: plain words then the term, or the term then its meaning in brackets ("unweighted (every pixel counts the same)"). A fold is read on its own, so a term defined higher up the page is defined again.
- **List only pages you opened** while writing, with `why` saying what the reader gets there. `url` is a full `https://` link.

### Refreshers
A refresher is an earlier idea the lesson leans on, such as the cosine before a projection. It is a whole board scene with `beat: refresher`, placed after the `next` scene, so the story runs on without it. The step that first needs it links to it:
```yaml
  - say: 'Squared onto each alone, the parts are {{short_a|2}} and {{short_b|2}}: $H$ and $E$ are {{he_angle|1}}° apart.'
    refresh: cosine-refresher           # the refresher scene's id
  …
- type: board                           # after `next`
  id: cosine-refresher
  beat: refresher
  ask: Rusty on angles and cosine?      # the link line the step shows
  title: 'Cosine: how much two directions agree'
  lead: A side note. One number says how much two arrows point the same way.
  steps: [ … ]
```
The link jumps to the refresher, and a **back to where you were** button returns the reader to the line they left. A refresher teaches like any scene: worked numbers, a figure, a think stop. It is not counted in the lesson's 8–14 scenes. Link one only where a learner may have lost the idea; the lint warns on a refresher no step links to.

### Marks
`mark` lights, for one step, a table row `row:4` (from 0, as in `at()`), a column `col:cd3`, a cell `cell:4:cd3` or an item `#total` (its `id`); one target or a list. A think step's mark lights on its question and its answer; a target not yet on the board warns `mark target not found`. A `calc` with `row:` lights its row, and the cells it reads, by itself.

### Highlights in text
The kit colours worked lines and their table cells for you. In your own text:
- `==pixel==`: a **linked word**. It names the mark of this scene's `plane`, `space` or `chart` whose `label` (a chart mark's `name`), `id` or symbol is `pixel`, and takes its colour (a symbol's word is its TeX). Pointing at the word lights its mark and dims the rest; pointing at the mark lights its words. At rest the marks linked by a lead, say or question glow and the others step back. `==pixel:Your pixel==` shows other words. Every legend entry gets its word, by the step that draws the mark; give a mark whose label holds `{{…}}` or `$…$` an `id:`.
- `==s1:CD3==`: bold words in a colour, no link (`s1` to `s5`, `good`, `bad`, `mist`, `accent`, or a hex like `#cc6600`). For a term's symbol or column colour; a few words per scene.
- `**3.1×**`: bold, for a result.
- `==text==` that names no mark: an orange underline. Rare: once or twice a lesson, for the line to remember.
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
| `say` | a short label for the line (≤ 14 words) |
| `why` | a grey half-line after it (≤ 12 words) |
| `row` | reads that row of the table (from 0): a table column's name in `expr` takes that row's value, and its cell lights in the line's colour. Without `row`, a name means what the data holds, never the table: `sum(cd3)` adds the whole list `cd3` in `data.json`, not the scene table's rows. To work on a subset (one group's 3 cells), make that list in `make_data.py` and name it |
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
`lhs` is the name on the left; `expr` (an expression, drawn as TeX) or `tex` (TeX with `[name]` terms, as in `assemble`) is the right. Each term takes its colour. Nothing is written under a formula: pointing at, tapping or tabbing to a term (or a matrix's brackets) opens its card, with its notation, `short` name, value now, `says` and shape. No numbers: use it after the numbers are known.

### `matrix` and `vec`: a matrix or vector with its numbers
```yaml
symbols:
  X: {tex: X, says: the scanner's mixing rule, kind: matrix, cols: [s3, s2]}   # data.json: X: [[1, 0.5], [0.5, 1]]
  p5: {tex: '\vec{x}', says: the orange pixel, kind: vector, rows: [s3, s2]}   # data.json: p5: [8, 4]
add: {matrix: X}            # X = [1.0 0.5; 0.5 1.0], each column in its colour
add: {vec: p5, row: true}   # a row vector; leave out row for a column
```
Drawn as the symbol = its numbers in brackets, right-aligned, one number format for the whole object. Each takes an `id`. In maths (`$…$`, or an `eqn` or `assemble`'s TeX), `\mat{X}` (or `\mat{X|2}`, 2 decimals) draws the same brackets; write `X = \mat{X}` the first time, so the name stands beside them. They follow a slider when a `derive` makes the name.

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
A string, or `{text, side, id}`. At most 16 words (full voice: 30); the board is not for paragraphs.

### `compare`: two cases side by side, in words
```yaml
add:
  compare:
    a: {title: Supervised, bad: true, text: 'A person writes each answer. No answers, no learning.'}
    b: {title: Self-supervised, text: The data writes the answer, from a question we make up.}
```
`a` and `b` each take a `title`, and optionally `text` (one line), `bad: true` (the title turns red) and `color` (default `s1`, `s2`). No box, tick or figure. Two cases with numbers are a `pair` picture, or one `chart` with both sides' data on one axis; say each value in its side's colour (`==s1:{{sA|3}}==`).

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
`chart`, `stat`, `units` and `image` are figures, and `dist`, `parts` and `flow` are wide items, all written as on a deck slide (`spec.md`, Visuals and Charts), with `caption`, `alt` and `labels` beside them (`chance`, `fork`, `strip` and a space's `views` are adv only, `adv.md`):
```yaml
add:
  chart:
    x: {cats: [c1, c2, c3, c4, c5, c6], label: cell}
    y: {label: CD3 level, min: 0, max: 10}
    series: [{name: CD3, kind: lollipop, x: 'seq(0, 5, 1)', y: cd3, color: s1}]
    marks: [{kind: hline, y: xbar, step: 2}, {kind: band, y: [lo, hi], name: usual range, says: where most cells sit}]
  caption: The tallest stick sits farthest above the line.
```
`ratio` beside a `chart`, `dist` or `units` sets its shape, width to height (`ratio: 2:1`; default 16:9; a chart must stay between 1:1 and 2.2:1). An image keeps its own shape.

**A chart mark has no tag on a board.** A named mark gets a legend entry, and pointing at it (or the entry) opens its card with its value now. When an `hline`'s `y`, a `vline`'s `x` or a `point`'s `y` is a symbol, its `short` is the name, its card the symbol's and its colour the symbol's: add only `name:` to rename the entry. Otherwise give `name:` (2 words) and `says:`. No `label:`, `text:` or `kind: label`. An unnamed line, band or area is a plain reference. Give named marks of one kind their own colours. A chart mark's (or an image label's) `step` counts board steps: `step: 2` shows on the scene's second step. Dots on a category axis sit at the left edge of their band: add 0.5 to `x` to centre them.

An `image` is only for when the user asks for a picture (`D/scripts/image.py`). The picture has no text; put labels on it: `labels: [{text: c1, at: [0.08, 0.88]}]` (fractions from the top left, ≤ 4 words), and always `alt`.

### `product`: a matrix times a vector or a matrix, worked by hand
```yaml
symbols:
  y: {tex: 'X\vec{x}', says: what the sensors read for the pixel, short: readings, kind: vector}
add: {product: {m: X, v: p5, way: rows, name: y}}                    # a row at a time
add: {product: {m: X, v: p5, way: cols, name: y, plane: true}}       # a column at a time, as arrows tip to tail
add: {product: {m: X, v: P, way: rows, name: XP, show: [[1, 2]]}}    # matrix × matrix: entry (1, 2), then all
```
One step opens into one board step per line of working, each with its own teacher line (`says: [..]` gives yours, one per line, in order):
- `way: rows` (the default), vector: `[row i] [v] = sum = entry i` for each row, then `name = [sums] = [result]`.
- `way: cols`, vector: `name = v₁[col 1] + v₂[col 2]`, then the scaled columns, then `= [result]`.
- Matrix × matrix, rows: one line per entry in `show` (`[row, column]`, from 1; default `[[1, 1]]`), then the whole result. Cols: one line per column of `v` in `show` (`[2]`; default `[1]`), then the whole result.
`m` is a `kind: matrix` symbol; `v` a vector or matrix; both up to 4 × 4, drawn first with their numbers, and `m`'s columns must match `v`'s rows. `name` is a `kind: matrix|vector` symbol for the result: the kit computes it, so data.json need not hold it (if it does, they must agree at the controls' starting values), and a later product in the scene may use it. It may not be `m` or `v`. Its TeX heads the last line. Each matching pair of numbers shares a colour: `m`'s `cols`, else `v`'s `rows`. Every line follows a slider when a `derive` makes `m` or `v`.
- `plane: true` (columns way, a vector, `m` with 2 rows): a plane with an arrow per scaled column, tip to tail, and a dot at the result; `axes: [CD3, CD19]` names its axes (default `entry 1`, `entry 2`).
The `product` step holds nothing else: put a `think` or another item on the step before or after. No box round the answer anywhere (a lint error): the last line is the answer.

### `plane`: geometry with equal scales
A coordinate plane with one scale for both axes, so a slope, a right angle and a square look like what they are. It fills its room by showing more of the plane: both axes widen on both sides at one scale, and ticks, grid and shading follow. The `x` and `y` ranges you write are the least it shows.

Add `fill: true` to a plane that is a scatter, a line or a shaded side, with no right angle or length the lesson relies on. It takes the chart shape, 16:9 (up to 2:1 on a short window), with its own scale per axis, and fills its column. It cannot hold a `vector`, `foot` or `square`. Leave it off when the lesson compares the spread along the two axes, as a plot of PC scores does: one scale keeps that comparison true. The gallery's picture scene draws a plane with points, a line, a foot and a square.
`x` and `y` take `label`, `min` and `max` (expressions allowed). Every value in a mark is an expression; **quote one that has a comma** (`'at(cd3, 2)'`), since a comma splits a YAML list. A line `[w0, w1, w2]` is the set where w0 + w1·x + w2·y = 0, so a flat line at height m is `['-m', 0, 1]` and an upright one at x = m is `['-m', 1, 0]`.

| Mark | Takes | Draws |
|---|---|---|
| `points` | `{from, x, y, by, label, colors}` | a dot per row of `from`; `x`, `y` are row keys; `label` names each dot from a key; `by` a key that picks the colour from `colors: {T: {color: s1, label: T cell}}` (each colour joins the legend). With no `by` and no `color` the dots are neutral grey: a series colour would read as a group the legend names |
| `point` | `[x, y]` | one dot; `name` labels it. `centre: true` draws a centre (a mean, a cluster's centre) as a ring with a cross, so it never reads as one more data dot |
| `line` | `[w0, w1, w2]` | the line across the box (a line that misses the box says so in the legend) |
| `shade` | `[w0, w1, w2]` | the half of the box where w0 + w1·x + w2·y > 0; `side: '-'` shades the other half |
| `segment` | `[[x1, y1], [x2, y2]]` | a line between two points; `name` labels its middle |
| `vector` | `[dx, dy]`, `from: [x, y]` | an arrow from `from` (default the origin) |
| `foot` | `{from: [x, y], line: [w0, w1, w2]}` or `{from, dir: [dx, dy]}` | the drop from a point to a line, or onto a direction through the origin (a projection), with a right-angle tick |
| `square` | `[[x1, y1], [x2, y2]]` | the square built on that segment, on its left (`side: right` for the other side): a squared distance as an area |
| `text` | a label, with `at: [x, y]` | free text on the plane, always in the axis names' grey (`color` is ignored) |
| `ring` | `[x, y]` | a ring around a point: "this one" |
| `quarters` | `[cx, cy]`, where the zero lines cross | the two quarters where (x − cx)(y − cy) > 0 washed, and `+` or `−` in each outer corner: the sign of a product. Keep the two zero `line`s |

Every mark also takes:
| Field | What it does |
|---|---|
| `step` | the board step it appears on (default: the step that adds the plane) |
| `color` | `accent`, `s1` to `s5`, `ink`, `mist`, `good`, `bad`, …, or a hex like `#cc6600` |
| `rgb` | a `point` or `points` dot in its true colour, worked out on every redraw: `rgb: 10` reads x as red and y as green (blue 0), full at 10, so (8, 4) is `#cc6600`; `rgb: {r, g, b, max}` takes any numbers (left out = 0, `max` 1; on `points` they are row keys). Past `max` clips. Not with `color`. A colour word in a true-coloured mark's `name`, `label` or dot label must fit the colour drawn, under every control (the check warns; `red level` names a channel and is fine) |
| `pixel` | on `points` only: each row drawn as a square one unit wide (`pixel: true`) or of the given side, centred on its x and y, with a hairline gap, so a small image reads as countable pixels, not overlapping dots. Put pixel centres at `i + 0.5`. Use it with `rgb` for a patch or a mask |
| `label` | its short legend entry above the plane, 2 words at most (`PC1`, `bad line`), even when it also has `name` |
| `name` | a label beside the mark itself (point, segment, vector, foot), drawn only when no linked word names the mark (prefer `label:` and its word), 2 words at most like a legend entry (`1 unit`, not `1 unit of CD3`; `$a \cdot b$` counts as one): the rest goes in `says:`. A vector's, a segment's and a foot's sit beside the middle of the line, off to one side |
| `says` | the longer meaning (`how far u goes along PC1`); it opens on the board's pop-up card when the learner points at, taps or tabs to the name or legend entry, which brightens instead of an underline. `{{…}}` and markdown work |
| `dash` | `true` for a dashed line or segment |
| `when` | an expression; the mark is drawn only while it is not 0 (`when: prev` with a toggle; `when: 'at(has_next, t)'` in a run) |

Labels are placed clear of dots, lines, arrows, right-angle ticks, the edges of squares and shaded halves, and other labels; when no place is clear, the check warns. Keep 5 legend entries or fewer. Every `name` needs `says:`, or a teacher line that names it at or before its step; the lint warns otherwise, since a pop-up is not seen in print or a screenshot. A mark outside the box warns too: widen `min`/`max`.

### `space`: a 3D space the learner turns
A plane with a third axis, for a point and the plane of two vectors: projection, least squares, colour unmixing. The learner drags to turn it, scrolls to zoom, and presses `edge` to look along the sheet, where a drop meets it at a right angle. It never moves by itself. One unit is one length on every axis, and a slider never rescales it: the kit sizes the axes from 5 values of each control (a sample when the combinations pass 4096), and the check warns if a mark still leaves them. The gallery's run scene draws one, from `kind: vector` symbols.
A position is a name that gives 3 numbers (a `kind: vector` symbol, a data list, a derive) or a written `[x, y, z]` of expressions. `axes` is 3 names; `max: [x, y, z]` beside it fixes the axes instead (only to compare two spaces at one scale).

| Mark | Takes | Draws |
|---|---|---|
| `points` | `{from, at}` | a dot per row of `from`; `at` is the column whose cells are 3 numbers; neutral grey unless given a `color` |
| `point` | a position | one dot; `ring: true` adds an accent ring; `centre: true` draws a centre as a ring with a cross |
| `ring` | a position | a ring round a point: "this one" |
| `vector` | a position, `from:` | an arrow from `from` (default the origin) |
| `sheet` | `[U, V]`, `max: [a, b]`, `min:` | the flat piece a·U + b·V, a from `min` (default 0) to `max`, tinted from V's colour to U's |
| `foot` | `{from: P, onto: [U, V]}` or `{from: P, onto: U}` | the least-squares drop from P onto the plane of U and V (or the line along U): dashed (teal, `s2`, by default), a hollow dot at the foot, a right-angle mark |
| `segment` | `[P, Q]` | a line between two points (`dash: true`) |
| `text` | a label, `at:` | free text at a point |

Every mark takes `step`, `color`, `label`, `id`, `says`, `when` and `dash` as on a plane. `rgb: od` on a `point` or `points` dot gives its true colour from optical density, 255·10^(−OD) per channel; `rgb: 10` reads x, y, z as red, green, blue, full at 10; `{r, g, b, max}` as on a plane. **No names on the marks**: only the axis names are drawn. A mark with `label` gets a legend entry (2 words, 5 entries at most); pointing at it or the mark lights the mark and opens its card, which shows `says` (or its vector symbol's) and its numbers now. Give each labelled mark `says:` and its linked word.

## Controls
`controls:` on a scene takes three kinds. Each `name` becomes a variable for expressions on that scene.
**The label is the symbol or one word.** When `name` (a run's `show:`) is a symbol, its TeX in its colour is the label and opens its card; leave `label:` out. Else `label:` is one word (`$…$` counts as one), and `says:` gives it a card. The value column shows the bare value (`fmt`, else the symbol's).

**A slider**, as on a deck slide:
```yaml
controls: [{name: shift, label: shift, says: how far c5 moves, min: -3, max: 3, step: 0.1, value: 0, fmt: 1}]
```

**A run**: frames 0 … n − 1 of an iterative process, with a scrubber, a play button and the frame number (or its `show:` value). It plays only when the viewer presses play.
```yaml
controls:
  - {name: t, run: 12, show: w0, stops: [0, 1, 2, 11], every: 1.3}
derive:
  w0: at(w0_trace, t)        # make_data.py stores every frame; the page only picks frame t
```
| Field | What it does |
|---|---|
| `run` | the number of `frames`, 2 or more. Store each frame's values as lists in `data.json` and read them with `at(list, t)` |
| `stops` | the frame each step shows, in order (default 0, 1, 2 and the last). The run needs as many stops as the scene has steps, or a `frame:` on its steps |
| `every` | seconds per frame when playing (0.3–10; default 1.3) |
| `show` | a name the run moves (data, derive): the value column shows it now, and it labels the run |

Instead of `stops`, a step may set `frame: 5`; each Next stop then shows the frame of the latest step that set one. One run per scene. Choose stops on the first two frames and the last; let the learner scrub the middle.

**A toggle**: two buttons, 0 and 1.
```yaml
controls:
  - {name: prev, toggle: [hide, show], label: before, says: the line one update ago}
```
`toggle` is two labels, `[off, on]`; the name is 0 for the first, 1 for the second. Use it with `when:` on a mark, or in an expression.

A control sits under the figure it drives: the first figure that reads its name, otherwise the scene's last figure, otherwise the end of the lines. The check moves every slider, run and toggle to both ends. Draw what it changes on the scene (a matrix it remakes as `X = \mat{X}`, with `fmt:`).

## Series and home
A series is 2–3 lessons, each its own folder and `lesson.yaml`, on the same home table; `series` and `episode` name the lesson's place, and a later one reaches back as `lesson.md` §7 says. If its `make_data.py` reads an earlier lesson's `data.json` and that lesson was tidied, run `tidy.py --restore` on it first. `home: <name>` names the home table (`C/scripts/home.py`, written to `~/.viz-os/home/<name>.json`, or under `$VIZOS_HOME` when it is set). `make_data.py` reads that file and writes the rows it uses into `data.json`, plus `"home": {"name": …, "provenance": {…}}` copied from the file, so each lesson keeps its own copy and says where it came from. The build does not read the home file; it reads only `data.json`.

## The opening and the end
The title asks the question; the board opens on the `problem` and ends on `next`, whose first line answers it (`lesson.md` §1). A deck slide type (`predict`, `table`, `bridge`, …) may sit between board scenes when it teaches better, and counts as a scene. An older lesson's `plan` scene still draws its `flow` as numbered squares, each `title` and `sub` under its square.
The kicker above the title is made from `series`, `episode` and `home`. Give the title slide a drawn picture, `cover:`, when the problem can be seen as groups of things: 1 to 3 `rows`, each a source part (`flowtube`) in its group's board colour (`s1`–`s5`) with a `label` of 3 words at most, pouring copies of an item part (`tcell`) placed along a data list; an optional `mark` {`at`: a data name, `label`, `reach`: true draws a line from the mark to each copy}; one `line` of 14 words at most under it. The `problem` scene then shows the numbers behind the picture (an axis, the means), not the picture again.
`- type: title` · `cover: {rows: [{part: flowtube, color: s1, label: Donor A, pour: {part: tcell, along: donor_a}}, …], mark: {at: mA, label: same mean, reach: true}, line: Same middle. One donor's cells reach much further from it.}`

## YAML gotchas
- Quote text with `: ` in it, a value that starts with `{{`, and inside a `{ }` mapping any value that holds `{{…}}` or a `?`: `label: 'mean {{xbar|1}}'`.
- Put TeX in single quotes: `tex: '\bar{x}'`. In double quotes `\b` and `\f` become control characters.
- Inside `[ ]`, a comma splits items: quote `'at(cd3, 2)'`, and write a list item that has a comma as a block list.
- An apostrophe inside single quotes is doubled: `'the ringed cell''s values'`.
- `- think:` with `q:` and `a:` indented under it; `say:` beside `think:`, not inside it.
