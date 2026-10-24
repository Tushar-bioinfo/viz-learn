# deck.yaml: the reference

One file per deck: `decks/<slug>/deck.yaml`. The kit draws everything; you give content and numbers.

## Top level
```yaml
title: …                 # the deck title (title slide)
subtitle: …              # one line under it
kicker: …                # small line above the title (optional)
question: …              # the question the deck answers (title slide, recap)
answer: …                # one sentence; the recap says it
learner: {goal: intuition+hand, knows: [mean], anchors: [cricket]}
ladder: {id: plain name, …}          # concepts, lowest first (story.md §2)
arc: puzzle | ladder | journey | duel | fix
beats: [ … ]                          # one line per slide, the plan (not drawn)
chapters: [Counts, Noise, The fix]    # optional; else taken from `chapter:` on slides
data: {reps: [9, 31, 14], mu: 22.5}   # numbers and lists; tables can be lists of rows
derive: {m: mean(reps), v: var(reps)} # computed in order; usable everywhere
symbols:                              # every name that appears in a formula
  mu: {tex: '\mu', says: the average count}
  alpha: {tex: '\alpha', says: how much the true level wobbles between samples}
abbr: {NB: negative binomial}         # spelled-out abbreviations (lint)
data_file: data.json                  # optional: big data made by a script; keys join data
include: [ch2.yaml, ch3.yaml]         # optional: more slides from other files
slides: [ … ]
```

## Every slide
`type` (default `idea`) · `title` (the claim) · `lead` (the "But…/So…" link from the previous slide) · `chapter` (starts a chapter) · `introduces: [id]` · `uses: [id]` · `more` (extra depth in a sheet) · `derive` (slide-level, recomputed when its sliders move) · `controls` (sliders).

## Slide types
```yaml
- type: title                         # uses the deck's title, subtitle, question, chapters
- type: chapter                       # a part divider
  title: Too much spread
  q: Why do real replicates spread more than counting noise?
- type: predict                       # guess first; options as a block list
  kind: pretest | check
  q: Six samples average 22 reads. Counting noise alone gives an SD of about…
  options:
    - about 5
    - about 22
    - about 50
  answer: 0                           # index of the right option
  why: Poisson noise has SD = √mean = √22 ≈ **4.7**. Real replicates show **{{sd(reps)|0}}**.
  visual: {…}                         # optional, shown with the answer
- type: idea                          # the workhorse: a claim and the visual that proves it
  title: Six samples, one gene, very different counts
  points: [Counts run from {{min(reps)}} to {{max(reps)}}.]   # 0–2 short points; 1 point sits above a full-width visual
  visual: {chart: {…}, caption: …}
  layout: split | stack | wide | vis-left | text-only   # auto if omitted
  build: false                        # show all points at once
- type: statement                     # one sentence worth remembering
  text: When the variance beats the mean, the counts are ==overdispersed==.
  sub: optional second line
- type: equation                      # the formula is the figure: each term is named under it, then run on the example
  lhs: v                              # the left side (a name in symbols)
  expr: mu + alpha * mu^2             # computable: the kit writes the TeX, plugs the numbers, computes v
  terms: {mu: {value: m}, alpha: {value: 0.4}}   # optional: the numbers (or meanings) to use here
  read: spread = mean + wobble × mean squared   # in the more sheet, with code
  code: var = mu + alpha * mu**2      # optional, in the more sheet; names matching terms get their colour
  note: For our gene, that is {{v|0}}. # optional closing line (≤ 20 words)
  build: false                        # name all terms at once (default: one per step when there are ≤ 4)
  # each term's label under the formula is its symbol's `short`, else its `says`: keep them to a few words
  # display-only form for notation the expression language cannot compute:
  # tex: 'p(y \mid [theta]) = \prod_{[i]} [p_i]'   (mark every term as [name]; plug: '… {{x}} …')
- type: calc                          # arithmetic, one line per step
  given: 'Gene A: {{xA}} reads; sample A: {{libA}} reads.'
  lines:
    - {say: Find the share of all reads, expr: xA / libA, name: p}
    - {say: Scale to a million reads, expr: p * 1e6, name: cpm, fmt: 0}
- type: table                         # computed columns show their formula; one column per step
  rows: [{gene: A, x: 120, N: 1000}, {gene: B, x: 30, N: 1000}]   # or from: genes (a list in data)
  cols:
    - {key: gene, label: gene}
    - {key: x, label: reads}
    - {key: p, label: share, expr: x / N, fmt: 3, says: the gene's share of all reads}
  focus: 0                            # the row worked in full
- type: bridge                        # analogy from the learner's world
  from: Cricket
  to: RNA-seq
  pairs: [[a batter's form that day, a sample's true expression], [runs in one innings, reads in one sample]]
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
- type: map                           # connections to other ideas
  center: negative binomial
  links: [{to: Poisson, how: α = 0 gives Poisson, kind: special}]   # kinds: prereq, special, sibling, analogy, uses, next
```

## Visuals (`visual:` on idea, predict, calc, compare sides)
```yaml
visual: {chart: {…}, caption: The open dots sit far above the line.}   # caption = where to look
visual: {stat: {value: '{{ratio|1}}×', label: variance ÷ mean, sub: Poisson says 1×}}
visual: {units: {n: 100, hi: 5, label: '**5** of 100 genes are false hits'}}
visual: {parts: {items: [{label: counting part, value: m}, {label: wobble part, value: 'alpha * m^2', focus: true}], total: {label: variance}}}
#   a whole split into named pieces; `share: true` shows percents; `build: true` adds one piece per step
visual: {parts: {items: [{label: counting}, {label: wobble, focus: true}], rows: [{label: 'μ = 5', values: [5, 'alpha * 25']}, …], share: true}}
#   one bar per row: how the split changes (each row's values in item order)
visual: {flow: {nodes: [{label: reads, sub: FASTQ}, counts, test], verbs: [align, compare], focus: 1, build: true}}
visual: {code: "cpm = x / N * 1e6", terms: {x: s1, N: s2}}
visual: {eqn: '\bar{x} = \tfrac{1}{n}\sum_i x_i'}         # a formula without term cards
visual: {image: cells.png, alt: …}                         # file next to deck.yaml (inlined)
```

## Charts
```yaml
chart:
  x: {label: reads per sample, min: 0, max: 80, log: false, fmt: 0}   # min/max may be expressions; cats: [A, B] for bars by name
  y: {label: probability, min: 0, max: 0.1}
  series:
    - {name: Poisson, kind: bars, fn: 'poisPmf(x, m)', color: mist}          # fn of x (integer x for bars/lollipop/step)
    - {name: negative binomial, kind: line, fn: 'nbPmf(x, m, alpha)', focus: true, step: 2}
    - {name: our 6 samples, kind: dots, x: reps, y: 0.004}                     # lists (or expressions giving lists)
    - {name: simulated, kind: hist, values: 'rnb(2000, m, alpha, 7)', density: true, bins: 30}
  marks:
    - {kind: vline, x: m, label: 'mean {{m|1}}', step: 1}
    - {kind: hline, y: 0.05, label: …}
    - {kind: band, x: ['m - sqrt(m)', 'm + sqrt(m)'], label: ±1 SD}
    - {kind: span, x: [a, b], y: 0.08, label: …}          # a measured range with end ticks
    - {kind: point, x: 22, y: 'poisPmf(22, m)', label: …}
    - {kind: area, fn: 'normPdf(x, 0, 1)', x: [1.96, 4], label: 'tail = 2.5%'}
    - {kind: fn, fn: 'x', label: variance = mean}         # a reference curve (dashed)
    - {kind: line, from: [0, 0], to: [100, 100]} · {kind: arrow, from: [..], to: [..], label: …} · {kind: label, at: [x, y], text: …}
controls:                                                  # on the slide; names become variables
  - {name: alpha, label: 'wobble α', min: 0, max: 1, step: 0.05, value: 0.4}
```
Series kinds are `line`, `area`, `bars`, `hist`, `dots`, `lollipop` and `step`. Colours are given by `focus: true` (the orange accent: the thing that matters now), by order (`s1` blue, `s2` teal, `s3` pink), or by `color: mist` for context. Grey carries context; give a colour only to what the claim is about. Every series and mark can have `step`. Readers get a `data` button (a table view) and a hover readout without you adding anything.

## Expressions (in derive, expr, fn, marks, {{…}})
Operators `+ - * / ^`, comparisons give 1/0, `[a, b]` lists, and maths on lists works element by element.
- Maths: `abs sqrt exp log ln log2 log10 log1p round floor ceil pow min max sign clamp`
- Lists: `sum mean var sd median quantile count len sort rank cumsum seq(a,b,step) at(list,i) first last where(cond,a,b)`
- Distributions: `normPdf normCdf normInv tPdf tCdf binomPmf binomCdf poisPmf poisCdf nbPmf(k,mu,alpha) nbCdf gammaPdf(x,shape,rate) betaPdf betaCdf choose factorial`
- Seeded random draws: `rnorm(n,mu,sd,seed) runif(n,a,b,seed) rpois(n,lambda,seed) rnb(n,mu,alpha,seed) rgamma(n,shape,rate,seed) rbinom(n,size,p,seed)`

`nbPmf` and `rnb` use the mean–dispersion form: variance = μ + αμ², and α = 0 gives the Poisson.
**Text:** `{{expr}}` or `{{expr|fmt}}` in any text, where fmt is `2` (decimals), `s3` (significant digits), `%1` (percent), `,` (integer with commas) or `e` (scientific). Inside `$…$`, `{{…}}` works too.

## YAML gotchas (each one was hit in testing)
- Inside `[ ]`, a comma splits items. Write options and points that contain commas as a block list (`- item`) or in quotes.
- Put TeX in **single quotes**: `tex: '\frac{a}{b}'`. Never in double quotes, because `\f` becomes a form feed.
- Quote text that starts with `{`, `[`, `*`, `&`, `!`, `%` or `@`, or that contains `: `.
- `yes`, `no`, `on` and `off` stay text (the build reads YAML 1.2), so `No` is safe as an option.

## Build output
`build.py` prints `ERR` (must fix) and `WARN` (fix unless you have a reason) lines, then one summary line. `check.py` prints `WARN [desktop|phone] slide N: …` lines, writes `snaps/desktop.png` and `snaps/phone.png`, and exits 0 when clean. Common fixes:
| Message | Fix |
|---|---|
| `… has no meaning: add … under symbols` | add `name: {tex: …, says: …}` to `symbols` |
| `uses X before any slide introduces it` | add `introduces: [X]` to the slide that first explains it, or move the slide |
| `content was shrunk to N%` | cut words, drop a point, or split the slide |
| `N words on the slide (aim ≤ M)` | the visual should carry it: turn points into labelled marks, shorten the caption, move detail to `more:` |
| `no visual: show it` | add the visual that proves the title (chart, parts, units, flow, stat); keep words for the caption |
| `text overlaps` / `chart labels overlap` | shorten labels, change a mark's `step`, or set `place: tl/tr/bl/br/t/b/l/r` on the mark |
| `runs into the navigation bar` | too much content: same fix as shrunk |
| `spills out of its card` | too much for the card: same fix as shrunk; a long name label under a number counts too, so give that symbol a `short:` |
| `low contrast` | usually text over a bright spot: move it onto a card, or cut it |
| `could not compute {{…}}` / `unknown name` | define the name in `data`, `derive`, `symbols` (with a value) or `controls` |
