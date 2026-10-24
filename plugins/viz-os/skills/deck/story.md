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
  mixture: each sample has its own true level
  nb: negative binomial (variance = μ + αμ²)
  alpha: dispersion α, the size of the wobble
arc: puzzle
beats:                  # one line per slide: its claim, and its link ("but"/"so") to the slide before
  - title · the question
  - predict · how much should 6 replicates spread? (pretest)
  - ...
```
Write the `answer` before any slide. If you cannot say it in one sentence, the deck has no point yet. The last content slide (`recap`) repeats it.

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
| **journey** | meet one unit (one gene, read or patient) → stage 1 → stage 2 → … (each stage: what goes in, what happens, what comes out, with its numbers) → the output → what we would misread without each stage → recap | pipelines and methods (MAGeCK, DESeq2, a model's training) |
| **duel** | the same data through method A and method B → where they disagree → why → when to use which → recap | method choice (mean vs median, Poisson vs NB) |
| **fix** | the tempting wrong move → watch it fail → diagnose → the fix → it works → when the fix fails too → recap | pitfalls (pseudoreplication, wrong denominator, leakage) |
Name the arc in `arc:`. Every arc keeps the ladder rule. Long topics chain arcs: a journey whose stages are small ladders.

## 4. The beat rule: "but" and "so", never "and then"
- Each slide answers something the previous slide left open. Write that link as the `lead` line: "But real replicates spread far more.", "So we divide by depth.", "Why does that happen?"
- If the honest link is "and then", the story has a gap: either a rung is missing, or the slide does not belong.
- Every 4–6 slides, give the learner a payoff: a number they can use, a picture that clicks, or a `statement` worth remembering.
- Keep **one running example** through the whole deck (one gene, one guide, one patient). Put its numbers in `data`, and show the same number in the table, the equation and the chart. Recognising a number they have seen before is how learners connect the slides.

## 5. Introducing a new idea: six moves
1. **Need.** Show the problem it solves, with numbers. ("These two samples cannot be compared: one has twice the reads.")
2. **Tiny case.** Solve it once on the smallest example. (`calc` or a small `table`)
3. **Picture.** One chart or diagram that makes the result visible. (`idea` + `visual`)
4. **Name.** Only now give the name: `plain words (term)`, and add the term to `symbols` or `abbr`.
5. **General form.** The formula, term by term. (`equation`, with `read:` and the running example's numbers)
6. **Check.** One `predict` that makes the learner use it on a new case.
Small ideas can merge moves 2–3 or 4–5 into one slide. Never skip move 1 or move 5's term-by-term meaning.

## 6. Bridges: connect to what they know
- Pick the analogy from `learner.anchors` (the learner's sport, money, their lab work, everyday life). One bridge per major idea; never stack two analogies on one idea.
- An analogy is a **mapping**, not a vibe. Write 2–4 pairs that correspond part to part (`bridge.pairs`): "a batter's form that day ≈ a sample's true expression level". The relation between the parts must carry over, not just the surface.
- Always write `breaks:`, where the analogy stops working. This keeps the learner from importing wrong ideas.
- Bridges also run sideways, to things learned before: "This is the same move as dividing runs by overs." The closing `map` slide lists these links.
- Good sources of anchors: rates and per-unit thinking (sport averages, prices per kg), noise and averages (form, weather, daily returns), selection and filtering (scouting, screening), and the learner's own pipelines.

## 7. Maths without mystery
This is where decks usually fail: a table of numbers with no formula, an equation with no meaning, a number from nowhere, a formula from nowhere.
- **No formula from nowhere** (`from:` and `kin:`). Before a formula's terms are named, show where it comes from: a form the learner already knows (from `learner.knows`, an earlier slide, or school maths) and the one move that turns it into this formula. "CPM is a percentage, counted per million instead of per hundred." "The Poisson is the binomial when there are many tries and each is rare." One to three links sketch the idea; this is not a full derivation (that goes in `more:`). Then name 1–3 relatives in `kin:`, the same shape in other topics ("run rate = runs ÷ overs"), so the learner sees one family of ideas, not one more formula to memorise. Pick relatives from the learner's anchors first.
- **Equations** (`equation`): a plain meaning for every symbol (its `short:` or `says:` is written under the term on the formula), the running example plugged in (the kit computes it when you use `expr:`), and `read:` (the formula said as a sentence). `read:` and `code:` sit one tap away in the more sheet. At most 5 terms; split a longer formula into two slides, inside first.
- **Totals made of pieces** (variance = counting part + wobble part; a library split into genes): show a `parts` bar, so the sizes are seen, not only summed. Use `rows` when the split changes with something (the wobble's share as the mean grows).
- **Arithmetic** (`calc`): one line per operation, each with `say:` (what this step does) and `expr:`. The kit writes the symbols, the numbers with their names underneath, and the result. Give each result a `name:`, so the next line can use it and the learner sees where it came from.
- **Tables** (`table`): computed columns use `expr:` and `says:`. The kit goes one step at a time: first the given columns and what each holds, then one new column per step (`build: rows` walks a row per step, `build: cells` one number per step). On each step the recipe card works the focus row's numbers, and the cells the formula reads are underlined in the colour their symbol wears in the formula, so the eye can follow each number from the table into the working. Keep the table at 8 rows or fewer and 6 columns or fewer.
- **Distributions and tests:** show where a statistic falls on its distribution (a chart with an `area` mark for the tail) before saying "p-value".
- **Notation for papers** (goal c): show the paper's notation (`tex:` with `[term]` markers), then the same thing with your symbols and numbers. Name every index and operator (`\sum_i`, `\hat{\theta}`) in `symbols`.

## 8. Show it: visuals that teach
The visual is the slide; words only point at it. Pick the visual by the job:
| The point | Visual |
|---|---|
| a shape, a spread or a trend in data | `chart` (with marks on the thing the title claims) |
| a whole made of pieces, or a share that changes | `parts` |
| a count or a rate ("1 in 20") | `units` |
| stages or a process | `flow` |
| the one number to remember | `stat` |
| two methods, two outcomes | `compare` with a `stat` on each side |
| a formula | `equation` (terms named on the formula) |
- Put the explanation **on** the visual: label marks (`label:`), not bullet points about them. Beside a visual keep 0–2 short points; one point sits above a full-width visual.
- One chart, one claim. The slide title is the claim, the chart proves it, and the `caption` says where to look ("The open dots sit far above the line."). Captions name shapes, never colours.
- Mark the thing the claim is about: a `point`, `vline`, `band` or `area` mark, with its value in the label. The orange accent (`focus: true`) is for the one thing that matters now; context series are `color: mist`.
- Use at most 3 coloured series. More than that means you need two charts or a grey context.
- Fix the axes so slider extremes still fit (`x.min/max`, `y.min/max`), and set a `step` on each mark so the chart builds one layer per click.
- Add a slider (`controls`) when moving one parameter **is** the lesson ("raise α and watch the spread grow"). Say what to try in the slide's points.

## 9. Review before you reply
Open both contact sheets and answer in your notes:
1. Read only the titles, in order. Do they tell the story by themselves? Is each one linked by a "but" or "so"?
2. Could a learner say where every number on every slide came from?
3. Is each new symbol named before or on the slide where it first appears? Does each formula say where it comes from?
4. Does each chart's lit mark (the orange one) show what its title claims?
5. Does the deck answer the opening question in the learner's words, and say where the idea breaks?
6. Is there anything on a slide that the learner does not need for the answer? Cut it, or move it to `more:`.
Fix what fails, rebuild, recheck. Report `check: 0 warnings · sheets viewed 2/2 · arc <name>`.

## 10. Writing
- Simple English: short sentences, active voice, "you". One idea per sentence.
- Titles are claims ("Deeper samples give every gene more reads"), not topics ("Sequencing depth").
- Few words: titles ≤ 8, leads ≤ 12, points ≤ 16 (at most 2 beside a visual), captions ≤ 20. The linter counts the words on each slide (about 40 on an idea slide). Put depth in `more:`, which opens a sheet; never put what the slide needs in there.
- Keep units on every number. Say when data is simulated.
- Use `==text==` for the one phrase to remember, `**bold**` sparingly, `$tex$` for inline symbols.
