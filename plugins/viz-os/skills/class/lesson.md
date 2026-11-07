# How a lesson teaches

Read this at the spine (loop step 2) and at the review (step 6). `board.md` says how to write each scene; this file says what each scene is for and in what order.

A lesson is one question answered on one long page, the way a teacher fills a board: what is written stays. The learner watches a teacher work a small table by hand, then sees the formula built from those same numbers, then sees the picture and the method running, then sees where it breaks. Nothing is said before it is needed, and nothing is shown that was not first worked.

## 1. The shape
A lesson has 8–14 scenes (not counting the title), each with at most 10 steps. Each scene carries one beat (`beat:`). The order is fixed at the ends and free in the middle:

```
title (asks the question)
plan
problem → data → by-hand → picture → formula → run → what-if    (the middle: any order the topic needs)
limits
summary (a `recap` slide that answers the question)
next (the tease, the last scene)
```

The lint checks the ends: `plan` first, a `problem` before any `formula`, `limits` before `next`, and `next` last. It also checks the size of the lesson and of each scene.

## 2. The beats
| Beat | What the scene does | Usually holds |
|---|---|---|
| `plan` | Says the one question and the path in 3–4 stops. The learner knows where the board is going. | a `flow` of the stops |
| `problem` | Shows the need before the method: two things the obvious number cannot tell apart, a guess that fails, a question nobody can answer yet. | a chart, a compare, a think stop |
| `data` | Puts the learner's toy table on the board and points at what matters in it. | a `table`, a chart of it, a mark on a row or column |
| `by-hand` | Works the method on the table, one operation per step, and names each new number. The core of every lesson. | `table`, `calc` lines, new `col`s, `mark` |
| `picture` | Shows what the numbers look like: a distance as a drop, a square as an area, a weight as a slope. | `plane` (equal scales), chart, image |
| `formula` | Builds the formula from the by-hand numbers (`assemble`): our numbers, then the symbols under them; the next line names the terms (each also has its pop-up card). | `assemble`, `eqn` |
| `run` | Runs an iterative method frame by frame, or the same rule across a whole table. | a run control, `plane`, `params`, `ops` |
| `what-if` | Changes one input and shows what moves: a slider, a flipped count, one cell removed. The change moves a picture, not only numbers. | a slider or toggle with a `chart` or `plane`, a `compare` |
| `limits` | Shows where the method breaks or what it assumes, on the same data where possible. | `parts`, a chart, a think stop |
| `summary` | Answers the opening question in one line, plus 2–3 points. Use a `recap` slide. | `answer:`, `points:` |
| `next` | Teases the next lesson's question with one picture from this lesson's data. | a `plane` or chart, 2 steps |
| `analogy` | Maps the idea onto something the learner already knows. Optional. | a `compare` or note |
| `compare` | Puts two cases side by side so one difference stands out. Optional. | `compare` |
| `misconception` | Names a wrong idea a learner is likely to hold, shows why it fails, gives the right one. Optional. | `compare` (bad, good), a think stop |
| `aside` | One short detour the learner will want: a name's history, a common variant. Optional; keep it to 2–3 steps. | `note` |

Leave out a middle beat the topic does not need, and say so in the reply. Never leave out `by-hand`, `formula` (when the topic has a formula), or `limits`.

## 3. Numbers before symbols
This is the rule that makes the lesson feel like a class rather than a textbook.

1. **The learner makes the numbers.** In the by-hand scene, each `calc` line works one number from the table: "how far c1 sits from the mean: 4.3 − 5.70 = −1.40". A `col` does the same for every row at once. Name every number you will need later (`name: d1`).
2. **The formula is a summary of what was done.** The formula scene's `assemble` writes the formula once with our numbers in it, each tagged with its term (`[xbar:{{xbar|1}}]`). Under it, after the next step's line, the symbols sit in the same places and colours, each with its plain name. The learner sees that `x̄` *is* the 5.70 they worked.
3. **A symbol never comes before its number.** The lint keeps a ledger: if `\bar{x}` appears on slide 4 but the mean's number first shows on slide 5, it is an error. A table column, a worked line, a `{{name}}` in text or a parameter card all count as showing the number. Index letters and operators (`kind: index`, `kind: operator`) are exempt, but still give them a plain meaning under `symbols:`.
4. **One new symbol at a time.** More than 5 terms in one formula is a wall (the lint warns). Build a long formula over two scenes, or show it whole and point at the parts that matter (move 14).

The table keeps its source's shape through all of this. A cells × markers table has a row per cell; genes × samples has a row per gene, the way a count table does. If the method is usually written the other way round (a matrix with samples as rows), say so in a note and keep the table as it is.

## 4. The teaching moves
Pick the moves the topic needs; this is a menu, not a template. Each line says when to reach for it.

1. **Bookends.** Always: the plan at the start; limits and next at the end.
2. **What / How / Why split.** The topic is too big for one lesson (§7).
3. **Problem-first ladder.** The method has parts that each fix the last one's problem. Show the problem, add the part, show the next problem (distances cancel → square them → units are squared → take the root).
4. **Think like the algorithm.** The method works from local information (a gradient, a nearest neighbour, one misclassified point). Say what it can see from where it stands, and what it cannot: "it has no eyes for the whole curve, only the slope under its feet".
5. **Personification.** A point, a weight or a gene "wants" something. Use it once or twice per lesson to make a rule stick: "this wrong cell objects, and the line moves to quiet it".
6. **One running toy example.** Always. The learner's home table, the same rows, in every scene and every lesson of a series.
7. **A tiny table, then a slow hand calculation.** Always, for anything with arithmetic. 3–8 rows, one operation per step.
8. **Counterfactual flip.** The answer depends on one count or one value. Change it and redraw: "if c5 were 5.0 instead, the variance would drop to …". A slider or a toggle does this; compute both states in `make_data.py` or with an expression.
9. **Geometry reveal.** The method has a picture: a projection, a distance, a decision line, an area. Show it after the numbers, so the picture explains something already done.
10. **Watch it run.** The method repeats an update. Show the frames, with Next stops on the first two and the last, and let the learner scrub the rest.
11. **Pause and think.** Always. Ask the question the learner should be asking; the answer waits behind its button.
12. **Interview angle.** The topic is a common exam or interview question. Ask it the way an interviewer would, in a think stop: "why n − 1 and not n?"
13. **Real product demo.** The method runs inside a tool the learner uses (a clustering in Seurat, a test in DESeq2). One scene that shows where the number appears in that tool's output. Do not invent the tool's output: show the shape, not made-up values.
14. **"Don't be afraid."** The real expression or diagram is big. Show it whole, say "most of this you can ignore", then mark only the 2–3 parts that matter.
15. **Labelled drawing.** Before writing a formula, name every part on the picture: inputs, weights, the constant 1.
16. **Dependency drawing and the chain rule.** One quantity depends on another through several steps. Draw the chain (`flow`), one factor per link, before the derivative.
17. **Board style.** Always: the page accumulates. Earlier items stay, in their colours, so the learner can scroll back to them.
18. **Limitation as its own beat.** Always: one whole scene, on the same data.
19. **Simplify first.** The method has several parameters. Freeze all but one, learn that one, then free the rest ("fix the slope and learn only the offset").
20. **Show the change, don't name it.** When a step changes a colour, a count or a place, draw before and after: a colour as dots in their true colour (`rgb:`), a count as `units`, a place as plane marks.

## 5. Voice
You are a teacher at a whiteboard talking to one student. Each step's `say:` is the one line you would say while writing.

- **One breath per step.** The lint counts the words (`board.md`; a sketch's limit is in `page.md`). Short sentences. Active voice. Keep lines about even in length.
- **Say only what helps.** Cut "Here is", "Now" and "as we did". Cut a line that only repeats the title or the card under it, and a note that repeats its line. If a step has nothing left to say, merge it with the next.
- **On a board, write a symbol as math**: `$w_0$`, not w0, so it takes its colour. The lint warns on a bare name.
- **Say what you are doing, then why**: "Square each distance. Now every one counts, and far cells count most."
- **Use the learner's words**: "cells", "CD3 level", "counts", not "observations" or "the random variable".
- **Define a term once**, the first time, as plain words then the term: "how far a cell sits from the mean (its deviation)".
- **Read the board aloud**: name the cell, the column, the number on screen. "c5 sits 2.4 above the mean." Numbers come from `{{…}}`, never typed.
- **A think question is a real question**: it has one short answer the learner can reach from what is on the board. "Which cell sits farthest from the mean?" not "What do you think?".
- **A think answer gives the answer and its reason** in one or two sentences.
- **No hype, no filler**: no "amazing", "simply", "just", "as you can see".

## 6. Pacing
- **One new thing per step.** A step adds one item, or marks one part, or asks one question.
- **Two to four steps per idea.** Show it, name it, check it with a think stop.
- **A scene is one idea.** If the lead line needs "and", split the scene.
- **Leads link scenes.** Each scene after the plan has a `lead:`: one short line that ties it to the last. Read the leads in order; they should tell the story alone.
- **Hard steps get a think stop before them.** Where the learner is most likely to get lost (a sign that flips, a division that seems arbitrary), ask first.

Expect `by-hand` to be the longest scene, or two scenes.

## 7. Series
A topic becomes a series of 2–3 lessons when it has more than about 7 new ideas, or one lesson would need more than 14 scenes.

- **Split by What / How / Why.** Lesson 1: what the thing is and what it gives you, worked by hand once. Lesson 2: how it is computed, in full, on the same table. Lesson 3: why it works (the geometry, the derivation, the assumptions) and where it breaks. Some topics split better by sub-question; keep each lesson's question answerable on its own.
- **Write all the questions first**, show them to the user, and wait for an OK before building lesson 1.
- **Same data, same layout.** Every lesson reads the same home table (`home:`), the same rows, in the same orientation.
- **Number the lessons.** Each lesson has `series: <name>` and `episode: <n>` at the top.
- **Lesson 2 onward reaches back.** A lesson has no quiz or recall cards. It continues through memory (`memory.py show`), its `lead` lines and the last lesson's `next` scene, plus one think stop near the start that asks about the last lesson. That stop uses only numbers in this lesson's own data. (A sketch page keeps its own cards: see its `page.md`.)
- **Close each lesson with the next one's question** (the `next` scene), and record any question it raised and did not answer as an open loop (`memory.py loop`). Start the next lesson by closing one.

## 8. The review (gates 4 and 5)
Open `snaps/desktop.png` (one photo per scene, each at its last step) and `snaps/numbers.txt` (every number the page drew). Then answer each question below with yes, or fix the YAML and rebuild.

**Eyes**
1. Did you look at every scene, full? Nothing cut off, nothing overlapping, every table and figure readable.
2. Is the orange accent on the thing that matters, and on little else?
3. Does every picture with geometry have equal scales on both axes, and does every point sit inside its box?
4. Do the numbers in `numbers.txt` match `verify_data.py`'s output?

**Pedagogy**
5. Read only the scene titles and leads, in order. Do they tell the story: question, plan, problem, work, formula, picture, limits, answer, next?
6. Pick the formula scene. For each term, can you find the by-hand scene and step where that number was worked?
7. Is there a think stop before the hardest step? Does each think answer give a reason?
8. Does the limits scene use the lesson's own data?
9. Does the summary answer the opening question in the opening question's words?
10. Does at least one question come from an angle the lesson did not take: an interview question, a different field, a reversed question?
11. Could a learner redo the by-hand scene on a new table of 3 rows, from the page alone?

If question 6 or 11 fails, the lesson does not teach yet: add the missing by-hand step, not more prose.
