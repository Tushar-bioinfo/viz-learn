# deck.yaml: the reference

One file per deck: `decks/<slug>/deck.yaml`. The kit draws everything; you give the content and the numbers. Every field below is checked by `build.py`: an unknown field is an error, so a typo cannot fail silently. `examples/gallery/deck.yaml` uses every slide type; `examples/mageck-rra/deck.yaml` is a full deck about a real method.

## Top level
```yaml
# probe answers: "1b 2c 3ad 4a"                 (keep the raw line; probe.md)
title: …                 # the deck title (title slide)
subtitle: …              # one line under it
kicker: …                # small line above the title (optional)
question: …              # the question the deck answers (title slide, recap)
answer: …                # one sentence; the recap says it
learner: {goal: intuition+hand, knows: [mean], anchors: [cricket]}   # from the probe; knows = rungs to skip
ladder: {id: plain name, …}          # concepts, lowest first (story.md §2)
arc: puzzle | ladder | journey | duel | fix
beats: [ … ]                          # one line per slide: the plan (not drawn)
chapters:                             # optional; else taken from `chapter:` on slides
  - {title: Counts, shape: guides × samples}       # shape = the data this chapter hands on (≤ 6 words)
  - {title: Genes, shape: one score per gene}      # (plain strings work too: [Counts, Genes])
data: {reps: [9, 31, 14], mu: 22.5}   # numbers, lists, lists of rows (records)
data_file: data.json                  # optional: numbers made by a script (story.md §11); its keys join data
derive: {m: mean(reps), v: var(reps)} # computed in order from data; usable everywhere
symbols:                              # every name that appears in a formula or a worked line
  mu: {tex: '\mu', says: the average count}
  alpha: {tex: '\alpha', says: how much the true level wobbles between samples, short: extra spread}
  cpm: {tex: '\mathrm{cpm}', says: reads per million reads, fmt: ','}   # fmt: how this number is shown in working
abbr: {NB: negative binomial}         # spelled-out abbreviations (lint)
notation: false                       # optional: no "New notation" chips anywhere
include: [ch2.yaml, ch3.yaml]         # optional: slides from other files, appended in order (their data,
                                      # derive, symbols and abbr join the deck's)
slides: [ … ]
```
Use each name once: a key in `data_file` must not also be in `data`. `says` is the meaning in plain words (about 6 words; the linter warns past 9 without a `short:`). `short` (2–3 words) labels the term on the formula and in step cards.

## Every slide
| Field | What it does |
|---|---|
| `type` | the slide type (default `idea`) |
| `title` | the claim, 4–8 words (≤ 10) |
| `lead` | the "But…" / "So…" line that links it to the slide before (≤ 12 words) |
| `why` | one line under the title on what the slide or its working is for (≤ 22 words). Expected on `calc`, `table` and `ops` |
| `eyebrow` | small label above the title (defaults exist on predict slides) |
| `chapter` | this slide starts the named chapter |
| `introduces` / `uses` | ladder ids: a concept is used only after a slide introduces it, or the learner knows it |
| `more` | extra depth in a sheet the learner opens (versions, the full derivation, caveats) |
| `derive` | slide-level names, recomputed when the slide's sliders move |
| `controls` | sliders: `[{name: alpha, label: 'extra spread α', min: 0, max: 1, step: 0.05, value: 0.4}]`; the name becomes a variable |
| `notation` | extra "New notation" chips: `[{tex: '\tilde{x}', says: x after normalizing}]`, or `false` for none |
| `id`, `notes` | for you; not drawn |

## Slide types
```yaml
- type: title                         # the deck's kicker, title, subtitle, question and the chapter pipe
  chips: false                        # optional: hide the chapter pipe
- type: chapter                       # a part divider; shows "in <last chapter's shape> → out <this shape>"
  title: Noise
  q: How much does a guide wobble at its count level?
  shape: one variance per guide       # optional here if chapters: gives it
- type: predict                       # guess first; options as a block list
  kind: pretest | check
  q: Six samples average 22 reads. Counting noise alone gives an SD of about…
  options:
    - about 5
    - about 22
    - about 50
  answer: 0                           # index of the right option
  why: Poisson noise has SD = √mean = √22 ≈ **4.7**. Real replicates show **{{sd(reps)|0}}**.   # ≤ 35 words
  visual: {…}                         # optional, shown with the answer
- type: idea                          # the workhorse: a claim and the visual that proves it
  title: Six samples, one gene, very different counts
  points: ['Counts run from {{min(reps)}} to {{max(reps)}}.']   # 0–2 points (≤ 16 words); 1 point sits above a full-width visual
  text: …                             # optional paragraph instead of points
  visual: {chart: {…}, caption: …}
  layout: split | stack | wide | vis-left | text-only   # auto if omitted
  build: false                        # show all points at once
- type: statement                     # one sentence worth remembering (≤ 22 words)
  text: When the variance beats the mean, the counts are ==overdispersed==.
  sub: optional second line
- type: equation                      # the formula is the figure: terms named on it, then run on the example
  lhs: v                              # the left side (a name in symbols); its value is stored for later slides
  expr: mu + alpha * mu^2             # computable: the kit writes the TeX, plugs the numbers, computes v
  terms: {mu: {value: m}, alpha: {value: 0.4, fmt: 2}}   # per term: value, says, short, tex, fmt (override symbols)
  order: [alpha, mu]                  # optional: the order the terms are named in
  fmt: 0                              # how the result is shown
  store: false                        # optional: do not store lhs for later slides
  read: spread = mean + wobble × mean squared   # the formula as a sentence (more sheet)
  code: var = mu + alpha * mu**2      # optional, in the more sheet; names matching terms get their colour
  note: For our gene, that is {{v|0}}. # optional closing line (≤ 20 words)
  hook: Spread grows faster than the mean.   # optional "Remember" line: the one thing to keep
  build: false                        # name all terms at once (default: one per step when there are ≤ 4)
  from:                               # where it comes from: a form the learner knows, and the move that turns it into this
    - {name: counting alone, tex: '\sigma^2 = \mu', move: "let each sample's true level wobble"}   # move ≤ 10 words
    - {name: spreads add, tex: '\sigma^2 = \mu + \mathrm{Var}(\lambda)', move: the wobble grows with the level}
    # 1–3 links sketch the derivation; the full working goes in `more:`. `from: false` only when an earlier
    # slide built this formula step by step
  kin:                                # the same shape in other topics (1–3), shown at the last step
    - {where: ecology, name: Taylor's law, tex: '\sigma^2 = a\mu^b'}
    - {where: genetics, name: beta-binomial}
  # display-only form for notation the expression language cannot compute (paper notation):
  # tex: 'p(y \mid [theta]) = \prod_{[i]} [p_i]'   mark every term as [name]
  # plug: '… {{x}} …'                              the numbers line (or plug: false to hide it)
- type: calc                          # arithmetic, one line per operation (≤ 4 lines)
  why: Work A1's gap in its own noise units.
  given: 'Gene A: {{xA}} reads; sample A: {{libA}} reads.'
  lines:
    - {say: Find the share of all reads, expr: xA / libA, name: p, fmt: 4}              # say ≤ 9 words
    - {say: Scale to a million reads, why: so every sample shares one scale, expr: p * 1e6, name: cpm, fmt: 0}   # why ≤ 12
    # tex: '…' instead of expr for a line the kit cannot compute (avoid: it shows no numbers)
  visual: {…}                         # optional, beside the lines
- type: table                         # step by step: the given columns, then one new column per step
  why: The same rule, every gene.
  rows: [{gene: A, x: 120, N: 1000}, {gene: B, x: 30, N: 1000}]   # or from: genes (a list of records in data)
  cols:
    - {key: gene, label: gene}
    - {key: x, label: reads}
    - {key: p, label: share, expr: x / N, fmt: 3, says: the gene's share of all reads, why: depth cancels out}
  focus: 0                            # the row worked in full (build: cols)
  build: cols                         # cols: a column per step · rows: a row per step · cells: one number per step · false: all at once
  given: false                        # skip the first step that names the given columns
  # on each step the cells the formula reads are underlined in their symbol's colour; tapping a computed number shows its working
- type: ops                           # a matrix and what each step does to it: see "Matrix steps" below
- type: bridge                        # analogy from the learner's anchors
  from: Cricket
  to: RNA-seq
  pairs: [[a batter's form that day, a sample's true expression], [runs in one innings, reads in one sample]]   # ≤ 3 pairs, ≤ 6 words a side
  breaks: Form drifts over a season; samples are independent draws.
- type: compare                       # two ways, side by side
  a: {title: Poisson test, tone: bad, verdict: fooled, points: […], visual: {stat: …}}
  b: {title: NB test, tone: good, verdict: honest, text: …}
  verdict: The NB test refuses to call noise a signal.
- type: quiz                          # flip cards for recall (3 is best)
  cards: [{q: …, a: …, tag: reversed}]
- type: recap                         # the answer, what to keep (≤ 3), where it breaks (≤ 2)
  answer: …
  points: [keep these]
  breaks: [where it fails]
  next: [what to learn next]          # in the more sheet
- type: map                           # connections to other ideas (≤ 6 links, how ≤ 7 words)
  center: negative binomial
  links: [{to: Poisson, how: α = 0 gives Poisson, kind: special}]   # kinds: prereq, special, sibling, analogy, uses, next
```

## Matrix steps (`type: ops`)
Use it whenever a step works across a table. The grid keeps its place; each step lights what it reads, draws what it makes in orange, and a card names the shape change (9 × 6 → 9 × 1), the rule in symbols, one row (or column) worked in numbers, and `say`/`why`.
```yaml
- type: ops
  title: The median ratio puts every sample on one scale
  why: A size factor per sample removes depth before any comparison.
  matrix:
    name: raw counts                  # shown above the grid
    from: raw                         # a data name (list of rows), or values: [[…], …], or records (with cols, rowKey)
    key: raw                          # optional: use this matrix by name in later cell rules
    rows: [A1, A2, A3]                # or a data name; records take labels from their text field (rowKey: to choose)
    cols: [ctl1, ctl2, trt1]
    row: guide                        # what a row is
    col: sample                       # what a column is
    says: reads of guide $i$ in sample $j$   # what one cell holds
    tex: 'x'                          # the cell's symbol (default x)
    fmt: ','
    focus: A1                         # the row worked in the card (label or index)
    focusCol: trt1                    # the column worked in the card
    corner: guide                     # optional: the label in the grid's corner (default: row)
  steps:
    - {op: rows, fn: geomean, expr: x + 1, name: gm, tex: g, label: geo mean, fmt: 0, say: "Find each guide's typical count", why: 'A geometric mean is the middle on a fold scale.'}
    - {op: map, expr: x / gm, name: ratio, tex: q, label: ratio, fmt: 2, say: "Divide each count by its guide's typical count", why: '1.2 means 20% more reads than usual.'}
    - {op: cols, fn: median, name: size, tex: s, label: size, fmt: 2, say: "Take each sample's middle ratio", why: Most guides do not change, so the middle measures depth.}
    - {op: map, expr: raw / size, name: xn, tex: '\tilde{x}', label: normalized, fmt: 0, say: Divide by the size factor, why: What is left is biology or noise.}
```
| `op` | Reads → makes | Shape | Extra fields |
|---|---|---|---|
| `rows` | each row → one number, a new column on the right | n × m → n × 1 | `fn`, `expr` (applied to each cell first), `over` (only these columns), `center` |
| `cols` | each column → one number, a new row underneath | n × m → 1 × m | `fn`, `expr`, `over` (only these rows), `center` |
| `map` | one rule for every cell; may borrow a row's or column's number | n × m → n × m | `expr` (required), `store: name` keeps the new matrix as data |
| `dot` | a weight per column, summed per row | n × m · m → n × 1 | `with` (list or an earlier `cols` result), `wtex`, `withLabel` |
| `sort` | rank the rows by a number; ties share the middle rank | n → n ranks | `by` (an earlier `rows` result), `desc: true` for largest first |
| `vec` | arithmetic on new columns (or on new rows) | n × 1 → n × 1 | `expr` using earlier results by name |
- `fn`: `sum`, `mean`, `median`, `geomean`, `var`, `sd`, `min`, `max`, or your own expression on `x` (the row's numbers) with `formula:` (its TeX). `var` and `sd` divide by n − 1; `center: median` measures spread around the median, `center: <earlier rows result>` around that number.
- In a rule, `x` is this cell, a matrix's `key` or `name` is its cell, a `rows` result is this row's number, a `cols` result is this column's number.
- Every step needs `say` (≤ 9 words) and `why` (≤ 14). `name` (default r, c, d, rank, v), `tex`, `label` (≤ 8 letters reads best) and `fmt` name and show the result.
- Results are stored under their `name` for later slides (charts, `{{…}}`); `store: false` stops that.
- Limits: ≤ 8 rows (≤ 10 with a `cols` or `sort` step) and ≤ 6 steps; the check warns when the columns crowd the matrix. Pick the rows that tell the story, then plot the result on the next slide.

## Visuals (`visual:` on idea, predict, calc, compare sides)
A visual has exactly one kind, plus an optional `caption` (where to look, ≤ 20 words).
```yaml
visual: {chart: {…}, caption: The open dots sit far above the line.}   # see Charts
visual: {dist: {…}, caption: …}                                        # see Distributions
visual: {stat: {value: '{{ratio|1}}×', label: variance ÷ mean, sub: Poisson says 1×}}
visual: {units: {n: 100, hi: 5, cols: 20, label: '**5** of 100 genes are false hits'}}
visual: {parts: {items: [{label: counting part, value: m}, {label: wobble part, value: 'alpha * m^2', focus: true}], total: {label: variance}}}
#   a whole split into named pieces; share: true shows percents; build: true adds one piece per step; fmt: for the numbers
visual: {parts: {items: [{label: counting}, {label: wobble, focus: true}], rows: [{label: 'μ = 5', values: [5, 'alpha * 25']}, …], share: true}}
#   one bar per row: how the split changes (each row's values in item order)
visual: {flow: {nodes: [{label: counts, sub: 9 guides × 6 samples}, normalize, test], verbs: [divide, compare], focus: 1, build: true}}
#   stages; each node's sub says the data's shape there (≤ 5 + 5 words); dir: row | col
visual: {code: "cpm = x / N * 1e6", terms: {x: s1, N: s2}}
visual: {eqn: '\bar{x} = \tfrac{1}{n}\sum_i x_i'}        # a formula without term cards
visual: {image: dish.png, alt: …, labels: [{text: guide library, at: [0.42, 0.37], step: 1}], caption: …}
#   only when the user asks for a picture (scripts/image.py). The file sits next to deck.yaml and is inlined.
#   The picture has no text: labels (≤ 4 words) are placed at [x, y], fractions of the picture from the top left
visual: {svg: '<svg …>…</svg>'}                           # last resort, when no kind fits
```

## Distributions (`dist`)
Show a named distribution: the kit draws it (bars for counts over a range of ≤ 120, else a curve), the mean and ±1 SD, and a card with each parameter in plain words and its value, then the mean and variance with their formulas.
```yaml
visual:
  dist:
    family: nb                        # poisson {mu} · nb {mu, alpha} · binomial {n, p} · normal {mu, sigma}
                                      # gamma {shape, rate} · beta {a, b} · uniform {a, b}
    params: {mu: lam, alpha: disp}    # numbers or expressions (a slider name moves it)
    says: {mu: the average count, alpha: extra spread between samples}   # each parameter in plain words
    label: negative binomial
    vs: {family: poisson, params: {mu: lam}, label: Poisson}   # optional: a second family, dashed, its variance on the card
    tail: {below: 'xA', label: P(count ≤ ours), mark: our guide}   # or above:; shaded in orange, its probability on the card;
                                                                   # at: false hides the line at the cut
    show: [mean, sd]                  # which marks to draw (default both)
    meanLabel: mean
    x: [0, 1200]                      # axis range (default: mean ± 4 SD)
    xlabel: reads for one guide       # ylabel, xfmt, yfmt, color, alt also work
  caption: Same mean, wider spread as soon as α is above zero.
controls:                             # a slider whose name is a parameter's expression moves into that parameter's row
  - {name: disp, label: 'extra spread α', min: 0, max: 0.5, step: 0.01, value: 0.2}
```

## Charts
```yaml
chart:
  x: {label: reads per sample, min: 0, max: 80, fmt: 0}    # min/max may be expressions
  y: {label: variance (log scale), min: 1, max: 1e7, log: true, ticks: [1, 100, 10000, 1000000]}
  # axis: label (with units), min, max, log, fmt, ticks (a count or a list; [] for none), cats: [A, B] (bars by
  # name); on y also zero: false (need not start at 0) and head: 0.3 (room above the data, default 0.16)
  # chart level: legend: false, table: false (no data table button), alt: … (what a screen reader hears)
  series:
    - {name: Poisson, kind: bars, fn: 'poisPmf(x, m)', color: mist}          # fn of x (integer x for bars, lollipop, step)
    - {name: negative binomial, kind: line, fn: 'nbPmf(x, m, alpha)', focus: true, step: 2}
    - {name: our 6 samples, kind: dots, x: reps, y: 0.004}                   # lists, or expressions giving lists
    - {name: simulated, kind: hist, values: 'rnb(2000, m, alpha, 7)', density: true, bins: 30}
  marks:
    - {kind: vline, x: m, label: 'mean {{m|1}}', step: 1}
    - {kind: hline, y: 0.05, label: …}
    - {kind: band, x: ['m - sqrt(m)', 'm + sqrt(m)'], label: ±1 SD}          # or y: [a, b]
    - {kind: span, x: [a, b], y: 0.08, label: …}                             # a measured range with end ticks
    - {kind: point, x: 22, y: 'poisPmf(22, m)', label: …, place: tr}
    - {kind: area, fn: 'normPdf(x, 0, 1)', x: [1.96, 4], label: 'tail = 2.5%'}
    - {kind: fn, fn: 'x', label: variance = mean, labelAt: 0.9}              # a reference curve (dashed)
    - {kind: line, from: [0, 0], to: [100, 100]}
    - {kind: arrow, from: [10, 0.02], to: [22, 0.05], label: …, bend: 0.2}
    - {kind: label, at: [44, 0.03], text: '{{nout}} of 6 outside'}
  controls: [ … ]                                                            # sliders may sit here too
```
- Series kinds: `line`, `area`, `bars`, `hist`, `dots`, `lollipop`, `step`. Series options: `name`, `kind`, `fn` or `x`/`y` or `values`, `density`, `bins`, `binwidth`, `color`, `focus`, `step`, `dash`, `width`, `opacity`, `legend: false`, `label` (end label), `highlight` (outline one bar by its x).
- Mark options: `step`, `label` (or `text`), `color`, `dash: false` (solid), `place` (`t b l r tl tr bl br c`: where its label goes), `labelAt` (0–1 along a line), `r` (point size), `bend` (arrow), `yf` (span height as a fraction).
- Colours: `focus: true` = the orange accent, for the one thing that matters now. By order: `s1` blue, `s2` mint, `s3` magenta. Context: `mist` (grey), `haze`, `ink`. Also `good`, `bad`, `accent`. At most 3 coloured series; grey the rest.
- Every series and mark can have `step`: the chart builds one layer per click. Labels avoid each other and the data; readers get a data table button and a hover readout for free.

## Expressions (in derive, expr, fn, marks, {{…}})
Operators `+ - * / ^`, comparisons give 1/0, `[a, b]` lists, and maths on lists works element by element.
- Maths: `abs sqrt exp log ln log2 log10 log1p round floor ceil pow min max sign clamp`
- Lists: `sum mean var sd median geomean quantile count len sort rank cumsum seq(a,b,step) at(list,i) first last where(cond,a,b)` (`at` counts from 0; `var` divides by n − 1)
- Distributions: `normPdf normCdf normInv tPdf tCdf binomPmf binomCdf poisPmf poisCdf nbPmf(k,mu,alpha) nbCdf gammaPdf(x,shape,rate) betaPdf betaCdf choose factorial`
- Seeded random draws: `rnorm(n,mu,sd,seed) runif(n,a,b,seed) rpois(n,lambda,seed) rnb(n,mu,alpha,seed) rgamma(n,shape,rate,seed) rbinom(n,size,p,seed)`
- Constants: `pi`, `e`, `inf`.

`nbPmf` and `rnb` use the mean–dispersion form: variance = μ + αμ², and α = 0 gives the Poisson.

## Numbers
**In text:** `{{expr}}` or `{{expr|fmt}}` in any text, also inside `$…$`.
| fmt | Shows | Example (1234.567) |
|---|---|---|
| none | automatic: integers in full; ≥ 1000 → 0 decimals; ≥ 100 → 1; ≥ 1 → 2; below 1 → 3 significant digits; scientific (2 digits) below 0.001 or from 10 million | 1,235 |
| `2` | that many decimals | 1,234.57 |
| `s3` | that many significant digits | 1,230 |
| `,` or `int` | a rounded integer with commas | 1,235 |
| `%` / `%2` | a percent (of a fraction) with 1 or 2 decimals | (0.256 → 25.6%) |
| `e` / `e3` | scientific with 2 (or 3) significant digits | 1.2×10³ / 1.23×10³ |

**In worked lines** (equation numbers, calc lines, table recipes, ops cards), each number going in is shown with its own `fmt` (an earlier calc line, a table column, an equation term), else its symbol's `fmt`, else in full if it is an integer, else 4 significant digits. A line's `fmt` rounds only its result. The working must add up by hand: if the rounded inputs do not give the result shown, the kit adds up to 2 digits to them; if that is still not enough, the line reads ≈ and the check warns. Fix it with a finer `fmt` on the inputs, or name the step in between. Negative numbers go in brackets when substituted, and a `calc` line too long for one row breaks at the = signs.

**Notation chips.** The first slide that uses a symbol such as ∑, ∏, a bar, a hat, `x_{ij}`, a log, e^x, √, Φ, ~, |, a binomial coefficient, n!, median, rank, min, max, Var, E, ∝, ≈, ∫ or ∞ gets a "New notation" chip with its meaning, once per deck and at most 4 per slide. Add your own with `notation: [{tex, says}]`; turn them off with `notation: false` on a slide or the deck.

## Limits the linter counts
| Words | Limit | Counts | Limit |
|---|---|---|---|
| title | 4–8 (warns past 10) | points beside a visual | ≤ 2 (≤ 3 without) |
| lead | ≤ 12 | calc lines | ≤ 4 |
| point | ≤ 16 | table | ≤ 8 rows, ≤ 15 steps |
| caption | ≤ 20 | ops | ≤ 8 rows (10 with cols/sort), ≤ 6 steps |
| slide `why` | ≤ 22 (predict ≤ 35) | equation terms | ≤ 5 |
| calc `say` / `why` | ≤ 9 / ≤ 12 | `from` links / `kin` | ≤ 3 / ≤ 3 |
| ops `say` / `why` | ≤ 9 / ≤ 14 | recap | ≤ 3 points, ≤ 2 breaks |
| table column `why` | ≤ 12 | bridge pairs / map links | ≤ 3 / ≤ 6 |
| equation `note`, `from` move | ≤ 20, ≤ 10 | coloured series | ≤ 3 |
| statement | ≤ 22 | checkpoint | a predict or quiz within every 8 content slides |
| chapter `shape`, map `how` | ≤ 6, ≤ 7 | leads | on at least half the content slides |
| flow node, image label | ≤ 5 + 5, ≤ 4 | symbol `says` | ≤ 9 or add `short:` |
Words on a slide's face: idea 40, statement 30, equation 40, calc 45, table 30, ops 30, bridge 55, compare 55, predict 70, recap 60, map 60. It also warns on "clearly", "obviously", "just", "imagine" and similar words, abbreviations not spelled out, math outside `$…$`, a bridge not from the learner's anchors, a missing `recap`, and a missing `answer` or `question`.

## YAML gotchas (each one was hit in testing)
- Inside `[ ]`, a comma splits items. Write options and points that contain commas as a block list (`- item`) or in quotes.
- Put TeX in **single quotes**: `tex: '\frac{a}{b}'`. Never in double quotes, because `\f` becomes a form feed.
- Quote text that starts with `{`, `[`, `*`, `&`, `!`, `%` or `@`, or that contains `: `. A value that starts with `{{…}}`, or holds `{{…}}` inside a `{ }` mapping, must be quoted: `label: '{{m|1}} reads'`.
- `yes`, `no`, `on` and `off` stay text (the build reads YAML 1.2), so `No` is safe as an option.

## Build and check output
`build.py` prints `ERR` (must fix) and `WARN` (fix unless you have a reason) lines, then `build: <path>  N KB  N slides  N errors  N warnings`. `check.py` opens the deck on a desktop screen (1440 × 900), visits every step, moves every slider to both ends, opens every predict answer ("after the answer"), measures text contrast on the pixels, and refits each slide with animations on. It prints `WARN slide N: …` lines and `check: N warnings`, writes the contact sheet `snaps/desktop.png`, one `snaps/desktop-NN.png` per slide and `snaps/numbers.txt` (every visible line with a digit, per slide), and exits 0 when clean, 1 with warnings, 2 when it could not run. The kit's portrait layout for phones is not checked. Options: `--slides 3,5-7` to check part of a deck, `--out <dir>`, `--all-steps` (a screenshot per step), `--vendor <dir>` (KaTeX and fonts from a local folder, offline). Open a slide at a step with `deck.html#12.3`.

| Message | Fix |
|---|---|
| `… has no meaning: add … under symbols` | add `name: {tex: …, says: …}` to `symbols` |
| `uses X before any slide introduces it` | add `introduces: [X]` to the slide that first explains it, or move the slide |
| `unknown name` / `could not compute {{…}}` | define the name in `data`, `derive`, `controls`, a table row or an ops step, or an equation's `terms: {n: {value: …}}` |
| `this formula comes from nowhere` | add `from:`: the form the learner knows and the `move` that changes it (story.md §7) |
| `no why` / `each step needs say` | one line on what the working is for; each step says what it does |
| `N words on the slide (aim ≤ M)` | let the visual carry it: turn points into labelled marks, shorten the caption, move detail to `more:` |
| `no visual: show it` | add the visual that proves the title (chart, dist, parts, units, flow, stat); keep words for the caption |
| `content was shrunk to N%` / `runs into the navigation bar` / `content is taller than the slide` | cut words, drop a point, or split the slide |
| `spills out of its card` / `is wider than its box` | too much for the card: the same fix; a long name label under a number counts too, so give that symbol a `short:` |
| `text overlaps` / `chart labels overlap` / `chart text … leaves the chart` | shorten labels, change a mark's `step`, or set `place:` on the mark |
| `a worked line reads ≈` | its rounded numbers do not give the result: give the inputs a finer `fmt`, or name the step in between |
| `the matrix is crowded` / `a line in the step card shrank` | shorter step labels (≤ 8 letters), fewer rows or columns, or a shorter rule |
| `term labels are crowded` | give long meanings a `short:` (2–3 words) |
| `the table takes N steps` | use `build: cols`, or show fewer rows |
| `low contrast` | usually text over a bright spot: move it onto a card, or cut it |
| `after the answer: …` | the same fixes, for the slide with its answer open: shorten the `why`, or give the answer's visual less text |
| `with animations on, the slide fits at X%… (kit bug)` | the kit's fault, not the deck's: report it with the slide number |
| `` `theme` set the 1.x glass look `` | delete `theme:`; 2.0 has one look |
