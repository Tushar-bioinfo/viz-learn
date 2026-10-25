# Story: how a viz-os deck teaches

A deck is not a list of facts. It is one question, answered in steps the learner can follow, where each slide exists because the last one left something open.

## 1. The spine (write it first, at the top of deck.yaml)
```yaml
title: Why RNA-seq counts need the negative binomial
question: Why do DESeq2 and MAGeCK model read counts with a negative binomial, not a Poisson?
answer: Replicates spread more than pure counting noise allows, because each sample's true level wobbles; the negative binomial adds that wobble (variance = μ + αμ²), so tests stop calling noise a signal.
learner: {goal: intuition+hand, knows: [mean, variance], anchors: [cricket]}
ladder:                 # every concept the answer needs, lowest rung first
  count: a read count is a tally of molecules
  poisson: counting noise alone (variance = mean)
  overdispersion: variance bigger than the mean
  nb: negative binomial (variance = μ + αμ²)
arc: puzzle
beats:                  # one line per slide: its claim, and its link ("but"/"so") to the slide before
  - title · the question
  - predict · how much should 6 replicates spread? (pretest)
  - ...
```
Write the `answer` before any slide. If you cannot say it in one sentence, the deck has no point yet. The `recap` slide repeats it.

## 2. The ladder: build from what can be counted
1. Write the target idea. Ask "what must the learner already understand to follow this?" Repeat until you reach something they can check by counting, or something the probe says they know.
2. Order the rungs from the bottom. Each rung gets a slide (`introduces: [id]`) before any slide uses it (`uses: [id]`). The linter checks this.
3. Each rung starts concrete: a tiny case with real numbers (3 genes, 6 samples, one coin), then the picture, then the general form. Numbers come before symbols, and the picture comes before the formula (concreteness fading).
4. If the probe says the learner knows a rung, add it to `learner.knows`, give it one recap line, and move on.

## 3. Arcs: pick the one that fits the question
| Arc | Beats (slides) | Best for |
|---|---|---|
| **puzzle** | surprising fact → the obvious explanation → data that breaks it → clue 1 → clue 2 → the idea that resolves it → check it on a new case → recap | counter-intuitive results, "why do we need X?" |
| **ladder** | the question → what you know (bridge) → rung 1 → rung 2 → … → the general form → use it on the opening question → where it breaks → recap | formulas built from smaller ideas |
| **journey** | meet the data (its shape, one unit in it) → stage 1 → stage 2 → … (each stage: what goes in, what happens, what comes out, with its numbers and its new shape) → the output → what we would misread without each stage → recap | pipelines and methods (MAGeCK, DESeq2, a model's training) |
| **duel** | the same data through method A and method B → where they disagree → why → when to use which → recap | method choice (mean vs median, Poisson vs NB) |
| **fix** | the tempting wrong move → watch it fail → diagnose → the fix → it works → when the fix fails too → recap | pitfalls (pseudoreplication, wrong denominator, leakage) |
Name the arc in `arc:`. Every arc keeps the ladder rule. Long topics chain arcs: a journey whose stages are small ladders. `examples/mageck-rra` is a journey in 4 chapters (counts → noise → guides → genes); `examples/negative-binomial` is a puzzle.

## 4. The beat rule: "but" and "so", never "and then"
- Each slide answers something the previous slide left open. Write that link as the `lead` line: "But real replicates spread far more.", "So we divide by depth.", "Why does that happen?"
- If the honest link is "and then", the story has a gap: either a rung is missing, or the slide does not belong.
- Every 4–6 slides, give the learner a payoff: a number they can use, a picture that clicks, or a `statement` worth remembering.
- Keep **one running example** through the whole deck (one gene, one guide, one patient). Put its numbers in `data`, and show the same number in the matrix, the equation and the chart. Recognising a number they have seen before is how learners connect the slides. Light it the same way everywhere (`focus:` on matrices and tables, `focus: true` on its series or mark).

## 5. Introducing a new idea: six moves
1. **Need.** Show the problem it solves, with numbers. ("These two samples cannot be compared: one has twice the reads.")
2. **Tiny case.** Solve it once on the smallest example. (`calc`, `ops` or a small `table`)
3. **Picture.** One chart or diagram that makes the result visible. (`idea` + `visual`)
4. **Name.** Only now give the name: `plain words (term)`, and add the term to `symbols` or `abbr`.
5. **General form.** The formula, term by term. (`equation`, with `read:` and the running example's numbers)
6. **Check.** One `predict` that makes the learner use it on a new case.
Small ideas can merge moves 2–3 or 4–5 into one slide. Never skip move 1 or move 5's term-by-term meaning.

## 6. Bridges: connect to what they know
- Pick the analogy from `learner.anchors` (the learner's sport, money, their lab work, everyday life). One bridge per major idea; never stack two analogies on one idea.
- An analogy is a **mapping**, not a vibe. Write 2–3 pairs that correspond part to part (`bridge.pairs`): "a batter's form that day ≈ a sample's true expression level". The relation between the parts must carry over, not just the surface.
- Always write `breaks:`, where the analogy stops working. This keeps the learner from importing wrong ideas.
- Bridges also run sideways, to things learned before: "This is the same move as dividing runs by overs." The `kin:` line on an equation and the closing `map` slide hold these links.

## 7. Maths without mystery
This is where decks usually fail: a table of numbers with no formula, an equation with no meaning, a number from nowhere, a formula from nowhere, a step with no reason.
- **What and why on every step.** A working slide gets a `why:` (what the working is for, shown under the title). Each `calc` line gets `say:` (what it does, ≤ 9 words) and, when the reason is not obvious, `why:` (≤ 12). Each `ops` step gets `say:` (≤ 9) and `why:` (≤ 14). A procedure without its reason is the failure this rule exists for.
- **No formula from nowhere** (`from:`, `kin:`, `hook:`). Before a formula's terms are named, show where it comes from: a form the learner already knows and the one move that turns it into this formula. "CPM is a percentage, counted per million instead of per hundred." "The Poisson is the binomial when there are many tries and each is rare." One to three links sketch the idea; this is not a full derivation (that goes in `more:`). Then name 1–3 relatives in `kin:` from the learner's anchors first. `hook:` is the one line to keep ("variance grows faster than the mean, so borrow the trend").
- **Equations** (`equation`): a plain meaning for every symbol (its `short:` or `says:` is written beside the term on the formula), the running example plugged in (the kit computes it from `expr:`), and `read:` (the formula said as a sentence, in the more sheet). At most 5 terms; split a longer formula into two slides, inside first.
- **Arithmetic** (`calc`): one line per operation. The kit writes the symbols, the numbers with their names, and the result. Give each result a `name:` so the next line can use it. The numbers going in are rounded the way they were shown before, with enough digits that the line adds up by hand; if it cannot, the line reads ≈ and the check warns: give the inputs a finer `fmt`, or name the step in between.
- **Matrices** (`ops`): use it whenever a step works across a table. Say what a row and a column are (`row: guide`, `col: sample`) and what one cell holds (`says:`). Each step is one kind: `rows` (each row → one number, a new column), `cols` (each column → one number, a new row), `map` (one rule for every cell, which may borrow a row's or a column's number), `dot` (a weight per column, summed per row), `sort` (rank the rows), `vec` (arithmetic on new columns). The card names the shape change (9 × 6 → 9 × 1), lights the row or column being read, and works one row (`focus:`) in numbers. Keep it at 8 rows or fewer and 6 columns or fewer; pick rows that tell the story. Then plot the result on the next slide.
- **Totals made of pieces** (variance = counting part + wobble part): show a `parts` bar, so the sizes are seen, not only summed. Use `rows` when the split changes with something.
- **Distributions** (`dist`): name the family and its parameters; the kit draws the shape, the mean and ±1 SD, and a card with each parameter in plain words and the mean and variance with their formulas. Compare two families with `vs:` (Poisson against negative binomial at the same mean). Put a slider on the parameter that is the lesson. Show where a statistic falls (`tail:`) before saying "p-value".
- **Shapes and types.** Say how the data changes as it moves: a chapter's `shape:` ("guides × samples"), a flow node's `sub:` ("9 guides × 6 samples", "1 number per gene"), and the ops card's shape line. Name type changes in words: counts → normalized counts → a z-score → a p-value → a rank → a percentile.
- **Notation.** The first slide that uses ∑, Π, a bar, a hat, an index, a log, ~ or | gets a "New notation" chip saying what it means (automatic, at most 4 per slide, once per deck). Add your own with `notation: [{tex, says}]`; turn them off with `notation: false`. For paper notation (goal c), show the paper's form (`tex:` with `[term]` markers), then the same thing with your symbols and numbers.
- **Tables** (`table`): computed columns use `expr:` and `says:`. The kit goes one step at a time: the given columns first, then one new column per step (`build: rows` walks a row per step, `build: cells` one number per step). Prefer `ops` when the step is "for every row" or "for every column"; use `table` for a few named columns.

## 8. Show it: visuals that teach
The visual is the slide; words only point at it. Pick the visual by the job:
| The point | Visual |
|---|---|
| a shape, a spread or a trend in data | `chart` (with marks on the thing the title claims) |
| a named distribution and its parameters | `dist` (with `vs:` to compare two) |
| a step that works across a table | `ops` slide (then a chart of its result) |
| a whole made of pieces, or a share that changes | `parts` |
| a count or a rate ("1 in 20") | `units` |
| stages or a process, with the data's shape at each | `flow` (shape in each node's `sub:`) |
| the one number to remember | `stat` |
| two methods, two outcomes | `compare` with a `stat` or chart on each side |
| a formula | `equation` (terms named on the formula) |
| a real thing to picture (a cell, a dish, a sequencer) | `image`, only when the user asks; labels on it |
- Put the explanation **on** the visual: label marks (`label:`), not bullet points about them. Beside a visual keep 0–2 short points.
- One chart, one claim. The slide title is the claim, the chart proves it, and the `caption` says where to look ("The open dots sit far above the line."). Captions name shapes and labels, never colours.
- Mark the thing the claim is about: a `point`, `vline`, `band`, `span` or `area` mark, with its value in the label. The orange accent (`focus: true`) is for the one thing that matters now; context series are `color: mist`.
- Use at most 3 coloured series. More than that means you need two charts or a grey context.
- Fix the axes so slider extremes still fit (`min`/`max`); use `log: true` when values span orders of magnitude, with `ticks:` to choose readable ones. Set a `step` on marks so the chart builds one layer per click.
- Add a slider (`controls`) when moving one parameter **is** the lesson ("raise α and watch the spread grow"). Say what to try in the caption.

## 9. Review before you reply
Open the contact sheet (`snaps/desktop.png`) and `snaps/numbers.txt`, and answer in your notes:
1. Read only the titles, in order. Do they tell the story by themselves? Is each one linked by a "but" or "so"?
2. Could a learner say where every number on every slide came from? Does every number in `numbers.txt` match your independent recompute?
3. Is each new symbol named before or on the slide where it first appears? Does each formula say where it comes from?
4. Does every working step say what it does and why? Can you see which rows or columns each matrix step reads, and the shape it makes?
5. Does each chart's lit mark (the orange one) show what its title claims?
6. Does the deck answer the opening question in the learner's words, and say where the idea breaks?
7. Is there anything on a slide that the learner does not need for the answer? Cut it, or move it to `more:`.
Fix what fails, rebuild, recheck.

## 10. Writing
- Simple English: short sentences, active voice, "you". One idea per sentence.
- Titles are claims ("Deeper samples give every gene more reads"), not topics ("Sequencing depth").
- Few words: titles ≤ 8, leads ≤ 12, points ≤ 16 (at most 2 beside a visual), captions ≤ 20, a slide's `why` ≤ 22. The linter counts the words on each slide (about 40 on an idea slide). Put depth in `more:`, which opens a sheet; never put what the slide needs in there.
- Keep units on every number. Say when data is simulated.
- Numbers in prose are `{{expr|fmt}}`, so they cannot drift from the data. Type a number only when it is part of the design ("3 replicates"), a hypothetical in a question, or a constant of the theory ("α = 0").
- Use `==text==` for the one phrase to remember, `**bold**` sparingly, `$tex$` for inline symbols (a caret or backslash outside `$…$` is warned).

## 11. A real method: facts you can stand behind
A deck about a published method teaches what the method does, so check it before you teach it.
- **Read the source.** Read the method's code (the version users run) for every step you show, and the paper for the reasons. Write the version in a comment at the top of `deck.yaml` and in the `more:` of the slide that depends on it.
- **Code and paper can disagree.** Say so on the slide where it matters ("the paper describes a negative binomial p-value; version 0.5.9.5 computes a normal tail"), and show both if the difference changes a number. Note renamed or swapped symbols.
- **Leave out what you did not check.** If you did not read how a step is done (an FDR method, what an acronym stands for), do not state it. Say "not shown" or skip it.
- **Toy data that follows the code.** Write `make_data.py` with a fixed seed: it simulates data with known truth (which genes are real hits) and works it the way the code does, writing `data.json` (`data_file: data.json`). Choose the seed by the story it must tell, and say in the docstring what that story is.
- **Recompute independently.** Write `verify_data.py`: it reruns the generator to show `data.json` is reproducible, then redoes every step with different code (numpy and scipy, not the generator's functions) and prints ok/BAD per quantity. A deck ships only when it prints ALL OK.
- **Then read the slides.** `check.py` writes `snaps/numbers.txt`, every visible line with a digit per slide. Compare it with the recompute: the kit computes what you wrote, so this catches a wrong expression, not a wrong kit.
