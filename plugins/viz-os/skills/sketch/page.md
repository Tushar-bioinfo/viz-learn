# How to write a page

Read this at the spine (loop step 2) and when you write the sheets (step 4). `C/lesson.md` says what each beat is for and in what order. This file says how to put it on paper.

A sheet is 100 units wide. Its height is 100 × height ÷ width of its `ratio`: `"16:7"` gives 43.75 units. You place each thing in those units with `at: [x, y]`, from the top left of the figure. There are no layouts. A figure lives on the left of a sheet and the four answers beside it, unless the sheet is `tall`.

## Top level
```yaml
title: Rotate the axes to find what matters    # a claim, not a topic
question: Can one number hold most of two markers?
answer: Yes. One new axis keeps most of the spread.
goal: Find the one direction along which six cells differ most.
seed: pca-what            # one seed gives the same drawing every time
learner: {goal: read a PCA plot, knows: [mean, variance], anchors: [flow cytometry gates]}
series: pca               # with `episode` and `recall`, only in a series
episode: 2
recall: ../pca-what       # a page's folder, or an older lesson that still ends in cards: its review cards open this page
home: cells               # the learner's home table
data_file: data.json      # the numbers make_data.py wrote
data: {...}               # a few small values, if any
derive: {mx: mean(cd3)}   # computed from data
symbols: {mx: {tex: '\bar{x}', says: mean CD3}}
abbr: {CD3: a surface marker on T cells}
sheets: [...]
```
`goal` is required, and each sheet's `why` ties back to it. A YAML anchor (`layers: &cloud`, then `- *cloud`) reuses a list of plot layers on a later sheet.

## A sheet
| Field | What it does |
|---|---|
| `beat` | required: `plan`, `problem`, `data`, `by-hand`, `picture`, `formula`, `run`, `what-if`, `limits`, `summary`, `next`, `analogy`, `compare`, `misconception`, `aside`, or `review` |
| `title` | a short claim, lettered by hand |
| `lead` | optional line under the title |
| `paper` | `cream` (default), `graph` (for data on a grid) or `navy` (a change of air) |
| `ratio` | `"width:height"` in quotes; a thin `"16:4"`, a tall `"4:3"`, anything |
| `width` | percent of the full sheet, 40–100; a narrow sheet is a small aside |
| `tall` | `true` lets a sheet pass the screen height, with its notes below the figure |
| `note` | the four answers: `shown`, `read`, `why`, `changed`, each ≤ 24 words |
| `figure` | a list of figure items |
| `label` | a list of labels attached to anchors |
| `frames`, `cols` | a strip of frames, and how many frames in a row |
| `stop` | a stop on the gold thread: `say`, `shape` |
| `break` | the red branch: `rule`, `path` |
| `alt` | the pale branch: `say` |
| `think` | a think stop: `q`, `a` |
| `more` | fold-outs: a list of `{ask, answer}`, closed until opened |
| `derive`, `controls` | sheet numbers and sliders: `{name, min, max, step, value, label}` |

The last sheet is `beat: review` with `title` and 5–8 `cards` of `{q, a}` (see Review cards). A class lesson ends at `next`; a page goes on to this sheet.

**Beats on paper.** `plan`: a thin sheet, the stops as text or a row of parts. `problem`: a plot or two tables that show the need. `data`: a `table` with a `mark`, on a sheet of its own. `by-hand`: the table on the left, `calc` lines on the right. `picture`: a `plot` with `equal: true` on `graph` paper. `formula`: `assemble`, with numbers above symbols. `run`: `frames`. `what-if`: `controls` that move a `plot`. `limits`: the method failing on this data, with `break`. `summary`: a thin sheet, the answer in the question's words. `next`: one picture from this page's data.

**Compose freely.** Mix sheet sizes and let a figure breathe. A long timeline can be `ratio: "3:1"`. Two small `width: 60` sheets in a row read as an aside. A dense table needs `"16:9"`; a line of text needs `"16:4"`. Do not repeat one ratio down the page.

## Figure items
Every item takes `at: [x, y]`, `id` (needed to attach a label) and most take `width`.

- **`table`** and **`matrix`**: `{rows, head, cols: [{key, label, fmt}], mark, foot, name, rh, shape}`. `rows` names the row labels. `mark: {row: 2}`, `{col: cd3}`, or both for one cell, with an optional `color`; give a list for several. `foot: [{label, cols: {cd3: "{{mx|2}}"}}]` adds rows under the table. `name` is a heading above it. `rh` is the row height in units (default 6). A matrix has bracket sides and writes its size below; `shape: false` drops that. Anchors: `row.2`, `row.c3`, `cell.2.cd3`, `col.cd3`, `top`, `bottom`, `left`, `right`.
- **`plot`**: `{x: {label, min, max, ticks}, y: {...}, equal, axes, ml, mb, layers}`, with `height` on the item. `equal: true` gives both axes the same scale; use it for anything with geometry. `axes: false` lays a plot over another one with the same `at`, size and scales. Each entry in `layers` holds one of:
  - `dots: [xs, ys]`, with `names`, `size`
  - `path: [xs, ys]`, a polyline through data
  - `line: [[x0, y0], [x1, y1]]`
  - `arrow: [[x0, y0], [x1, y1]]`
  - `hline: value`, `vline: value`
  - `curve: expression in x`
  - `sticks: [x0s, y0s, x1s, y1s]`, one thin line per point, for shadows and residuals
  - `bars: [names, values]`

  Any layer takes `color`, `nib`, `w` and `id`. Anchors: `plot.cells.c3` (`<id>.<layer id>.<name>`), `plot.cells.point.2`, `plot.fit.line`, `plot.fit.arrow`, `plot.h.bar.1`, `plot.origin`, and the four sides.
- **`calc`**: `{expr, name, say, fmt}` works one line with its numbers and names the result, for `{{name}}` on this sheet and later ones.
- **`assemble`**: `{tex, plug, lhs, say, fmt}` writes a formula with our numbers, then the same shape in symbols. In `plug`, `[mx:2]` puts in that number; in `tex`, `[mx]` puts in its symbol. `lhs` names a number from an earlier `calc`; a negative number before `^` gets brackets.
- **`eqn`**: `{tex, lhs}` or plain TeX, with no `$`.
- **`text`**: `text`, with `size` in units (default 2.2), `letter: true` for the hand font, `color`.
- **`part`**: a drawing from the box, below.
- **`draw`**: a custom drawing, below.

`color` takes `s1`–`s4` (series), `accent`, `ink`, `soft`, `gold` or `red`. Colours are measured on each paper; a hex value skips that, so avoid it.

## Labels
```yaml
label:
  - {on: cells.row.2, say: the brightest T cell, dx: 3, dy: 0}
```
`on` is `<figure id>.<anchor>`, or `sheet.left`, `sheet.right`, `sheet.top`, `sheet.bottom`. `dx` and `dy` are offsets in units; the default sits just above and to the right. A label more than 5 units away gets a thin leader line. A label's `say` can hold `{{…}}`.

## The box of parts
`{part: cell, at: [cx, cy], size: 14, rotate: 30, state: dividing, color: s2, id: t1}`. `at` is the centre and `size` the width, in units. `rotate` is in degrees, and the anchors turn with it. All parts publish `top`, `bottom`, `left`, `right`, `center`.

| Part | `state` | Also takes | More anchors |
|---|---|---|---|
| `cell` | `plain`, `dividing`, `dead` | | `nucleus`, `membrane`, `a`, `b`, `waist` |
| `nucleus` | | | `nucleolus` |
| `dna` | `open` | `turns` (default 3) | `start`, `end`, `middle` |
| `chromosome` | `single` | | `centromere`, `shortarm`, `longarm` |
| `tissue` | `regions` | `other` (second colour) | `a`, `b` |
| `spots` | `empty`, `captured` | `rows`, `cols`, `values` | `spot.r.c` |
| `tube` | `empty`, `filled` | | `cap`, `liquid`, `tip` |
| `plate` | `empty`, `filled` | `rows`, `cols`, `values` | `well.r.c` |
| `gene` | `on`, `off` | `exons` | `exon.i`, `start`, `end` |
| `read` | `short` | | `barcode`, `umi`, `insert`, `start`, `end` |
| `droplet` | `empty`, `cell`, `bead`, `both` | | `cell`, `bead` |
| `arrow` | `bent` | | `start`, `end`, `middle` |
| `bracket` | | | `start`, `end`, `middle` |
| `lens` | | | `lens`, `handle` |

`values` names a list in the data, so a plate or a spot grid shows computed numbers as shade.

## Frames
```yaml
beat: run
ratio: "16:9"
cols: 3
frames:
  - say: Start with the mean of each marker.
    add: [{part: cell, at: [50, 30], size: 30}]
  - say: Each cell is now a distance from that mean.
    think: {q: "Which cell moves most?", a: "c5, because it sat furthest away."}
    add: [{plot: {...}, at: [10, 10], width: 80, height: 40}]
```
Each frame is its own small sheet, 100 units wide, and repeats everything added before it. Only `add` the new part. Everything in a frame shrinks with it, so text there can fall below the size limit: put words in `say`. The newest part draws in the accent colour. Keep each `say` to one change. Frames count toward the think stop rule: a sheet of 6 frames needs a `think` on one of them.

## The thread
```yaml
stop: {say: "Each cell is now two distances", shape: "{{n}} cells × 2 markers"}
break: {rule: "Spread means signal only when the markers share a scale.", path: "Measure one marker a hundred times brighter."}
alt: {say: "Or stop at the sample covariance"}
```
Say what the reader sees or cares about. A stop that reads like code stops the build. `shape` is what the data is here (`one number per marker`, `{{n}} cells × 2 markers`), computed. Put a `stop` on every `by-hand` and `run` sheet, and on any sheet where the data changes form. A `break` or `alt` needs a `stop` on the same sheet, and a sheet has one branch. Draw one `break` per broken rule; a page with 5 is arguing with itself.

## The four answers
Each answers its own question, in the learner's words. Do not repeat the title.

| Field | Good | Poor, and why |
|---|---|---|
| `shown` | One dot per cell, placed by its two markers. | A scatter plot. (names the chart, not what it holds) |
| `read` | Further right means more CD3; higher means more CD19. | Look at the plot. (no way in) |
| `why` | The goal needs the shape of the cloud, which a table hides. | This is an important step. (no tie to the goal) |
| `changed` | The table became a picture; no number moved. | We continued. (no change named) |

`read` is the answer learners miss most: say what direction, size or colour means. In `changed`, name the thing that moved. Numbers in notes are `{{…}}`. A note that needs more than 24 words is two ideas: keep the first and fold the rest into `more`.

## Custom drawing
Use it when no part fits and only for art, never for data positions. A block gets the sheet's pens, its scale and the page's data, and nothing else.
```yaml
- id: wheel
  at: [20, 2]
  width: 60
  height: 38
  scale: {x: [0, 5], y: [0, 5]}     # optional: x(), y() map data to the block's units
  draw: |
    const n = data.ids.length, cx = w / 2, cy = h / 2, r = 13;
    ring([cx, cy], r);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU - PI / 2, p = [cx + cos(a) * r, cy + sin(a) * r];
      dot(p, 1, { color: 'accent' });
      pub('cell' + i, p[0], p[1]);
    }
    text(cx, cy, 'mean ' + fmt(data.mx, 2), { align: 'center' });
```
The block sees these names, and no others:

| Name | What it does |
|---|---|
| `line(pts, o)`, `curve(pts, o)`, `arrow(a, b, o)` | a wobbling line, a smooth line, an arrow |
| `dot(p, r, o)`, `ring(p, r, o)`, `fill(pts, o)` | a filled dot, a circle, a filled shape |
| `text(x, y, str, o)` | words at a point; `o.align` is `left`, `center` or `right` |
| `part(name, o)` | a part from the box, with the item fields above |
| `pub(name, x, y)` | publish an anchor, so a label can attach here |
| `x(v)`, `y(v)` | data to block units, when `scale` is set |
| `w`, `h`, `data`, `fmt(v, f)` | the block's size, the page's numbers, a number to `f` decimals |
| `sin`, `cos`, `PI`, `TAU` | for arcs and wheels |

`o` takes `color` and `nib`, plus `size` for an arrow or text, and `angle` or `pressure` for a fill. Limits: 40 lines a block, 3 blocks a page, 20% of the page's words. Numbers in drawn text come from `data` through `fmt`.

## Review cards
- **Test the method, not the trivia.** "Why square the distances?" beats "What symbol is the mean?"
- **Mix kinds**: one card asks for a number from the page's table (computed, `{{…}}`); one asks why a step is there; one asks what breaks; one asks what changes if an input changes.
- **At least one card from an angle the page did not take**: an interview question, a different field, a reversed question ("a variance of 0 means what?").
- **Order them by importance.** A later page's recall takes the first cards of this one, so put the one the learner must keep first.
- **A card may read data names** (`{{xbar|1}}`); a later page then shows this page's numbers. Every name a card reads must be in this page's `data.json` or inline `data:`.

A later page in a series opens with these cards: `recall:` copies them, with their numbers, to the top of the page. `C/lesson.md` §7 says a lesson has no cards; a page keeps them. A lesson made now has no cards to recall, so `recall:` names a page, or an older lesson that still ends in a `quiz`.

## The review
On top of `C/lesson.md` §8, answer yes to each, or fix the YAML:
1. Close every fold. Do the sheets still give the beats in order?
2. Cover the notes. Can you name every part of each figure from its labels?
3. Read only the stops, top to bottom. Is that the data's journey, in plain words, with the right shape at each stop?
4. Is each red branch a rule the data really breaks?
5. Do sheet sizes and papers vary with what each sheet holds?
6. Does each sheet claim only what its numbers or its sources show? A simulated number shows the arithmetic, never how the world behaves. If a plot claims a difference, do its numbers show one?
7. Follow one number worked by hand to the end of the page. Is it unchanged in every later table? Is the formula the rule you used by hand, not a rearrangement that needs the answer first?

## What the lint says
| Message starts | What to do |
|---|---|
| `no note.…` | Write that answer. `changed` is only excused on the first sheet. |
| `note.… has N words` | Cut it to 24 words, or fold the rest into `more`. |
| `… say the same thing` | Each answer has its own question. Rewrite one. |
| `… which the lettering font lacks` | Put the symbol in `$...$`, or use a word. |
| `stop … reads like code` | Write what the reader sees. |
| `no stop` | Add one: the thread runs through every method sheet. |
| `a branch leaves the thread at a stop` | Add `stop` to the sheet. |
| `one branch per sheet` | Move the `alt`. |
| `no red branch` | Add `break` where the method fails. |
| `N frames or sheets in a row with no think stop` | Add a `think` on or before that sheet or frame. |
| `custom drawing uses …` | A drawing gets pens, scales and data. Remove it. |
| `custom drawing types the number …` | Read it from `data`, print it with `fmt`. |
| `custom drawing has N lines` | Use parts, or split it. |
| `no part …`, `part … has no state …` | Use a name from the table above. |
| `no goal`, `no limits sheet`, `no next sheet` | Add it. |
| `… typed number …` | Replace it with `{{…}}`; the message names the matching value. |
| `… is a typed number in braces` | Name it in the data; braces around a literal compute nothing. |
| `N of M sheets are …` | Size each sheet to what it holds; see The review, question 5. |
| `a problem sheet holds only text` | Show the need with a plot or two tables. |

## What the browser check says
| Warning | What to do |
|---|---|
| `… sits on the thread` | The thread runs in the gutter, the first 5 units of a sheet with a `stop`. Start items at `x` 6 or more; move a label with `dx`, `dy`. |
| `label … covers a data mark` | Move it with `dx`, `dy`; a label longer than 5 units gets a leader line. |
| `text overlaps` | Two pieces of text sit on one place; move one or pick another anchor. A table's `name` sits above it: leave room under the title. |
| `… runs off the sheet` | Shorten the text, or narrow the item. |
| `low contrast` | Use a palette `color` for this paper. If the text sits past the sheet's bottom, it is on the wall: lower `rh` or raise the ratio. |
| `the figure is blank` | A figure drew nothing; check its data. |
| `cannot be seen together at 1440×900` | Lower the ratio, or set `tall: true`. |
| `… too small` | Widen the table, or raise `rh`. |
| `draws differently` | A custom drawing used something other than the pens; report it. |
| `a label names … not on this sheet` | Check the `on` name; the message lists the anchors. |
| `… is wider than its box`, `… wider than its column` | Shorten the text, or widen the item. |
