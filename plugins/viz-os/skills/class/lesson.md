# How a lesson teaches

Read this at the spine (loop step 2) and at the review (step 6). `board.md` says how to write each scene; this file says what each scene is for and in what order.

A lesson is one question answered on a board that grows. The learner watches a teacher work a small table by hand, then sees the formula built from those same numbers, then sees the picture and the method running, then sees where it breaks. Nothing is said before it is needed, and nothing is shown that was not first worked.

## 1. The shape
A lesson has 8–14 scenes (not counting the title and the quizzes), each with at most 10 steps (clicks). Each scene carries one beat (`beat:`). The order is fixed at the ends and free in the middle:

```
title (asks the question)
[recall quiz, when this lesson continues a series; the build adds it]
plan
problem → data → by-hand → picture → formula → run → what-if    (the middle: any order the topic needs)
limits
summary (a `recap` slide that answers the question)
next (the tease)
quiz (5–8 review cards)
```

The lint checks the ends: `plan` first, a `problem` before any `formula`, `limits` before `next`, only the quiz after `next`, and the quiz last. It also checks the size of the lesson and of each scene.

## 2. The beats
| Beat | What the scene does | Usually holds |
|---|---|---|
| `plan` | Says the one question and the path in 3–4 stops. The learner knows where the board is going. | a `flow` of the stops |
| `problem` | Shows the need before the method: two things the obvious number cannot tell apart, a guess that fails, a question nobody can answer yet. | a chart, a compare, a think stop |
| `data` | Puts the learner's toy table on the board and points at what matters in it. | a `table`, a chart of it, a mark on a row or column |
| `by-hand` | Works the method on the table, one operation per click, and names each new number. The core of every lesson. | `table`, `calc` lines, new `col`s, `mark` |
| `picture` | Shows what the numbers look like: a distance as a drop, a square as an area, a weight as a slope. | `plane` (equal scales), chart, image |
| `formula` | Builds the formula from the by-hand numbers (`assemble`): our numbers on one click, the symbols on the next, each term named. | `assemble`, `eqn` |
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
2. **The formula is a summary of what was done.** The formula scene's `assemble` writes the formula once with our numbers in it, each tagged with its term (`[xbar:{{xbar|1}}]`). On the next click the symbols appear in the same places and colours, each with its plain name. The learner sees that `x̄` *is* the 5.70 they worked.
3. **A symbol never comes before its number.** The lint keeps a ledger: if `\bar{x}` appears on slide 4 but the mean's number first shows on slide 5, it is an error. Index letters and operators (`kind: index`, `kind: operator`) are exempt, but still give them a plain meaning under `symbols:`.
4. **One new symbol at a time.** More than 5 terms in one formula is a wall (the lint warns). Build a long formula over two scenes, or show it whole and point at the parts that matter (move 14).

The table keeps its source's shape through all of this. A cells × markers table has a row per cell; genes × samples has a row per gene, the way a count table does. If the method is usually written the other way round (a matrix with samples as rows), say so in a note and keep the table as it is.

## 4. The teaching moves
Pick the moves the topic needs; this is a menu, not a template. Each line says when to reach for it.

1. **Bookends.** Always: recap (or the recall quiz) and plan at the start; limits and next at the end.
2. **What / How / Why split.** The topic has more than about 7 new ideas, or one lesson would need more than 14 scenes (§7).
3. **Problem-first ladder.** The method has parts that each fix the last one's problem. Show the problem, add the part, show the next problem (distances cancel → square them → units are squared → take the root).
4. **Think like the algorithm.** The method works from local information (a gradient, a nearest neighbour, one misclassified point). Say what it can see from where it stands, and what it cannot: "it has no eyes for the whole curve, only the slope under its feet".
5. **Personification.** A point, a weight or a gene "wants" something. Use it once or twice per lesson to make a rule stick: "this wrong cell objects, and the line moves to quiet it".
6. **One running toy example.** Always. The learner's home table, the same rows, in every scene and every lesson of a series.
7. **A tiny table, then a slow hand calculation.** Always, for anything with arithmetic. 3–8 rows, one operation per click.
8. **Counterfactual flip.** The answer depends on one count or one value. Change it and redraw: "if c5 were 5.0 instead, the variance would drop to …". A slider or a toggle does this; compute both states in `make_data.py` or with an expression.
9. **Geometry reveal.** The method has a picture: a projection, a distance, a decision line, an area. Show it after the numbers, so the picture explains something already done.
10. **Watch it run.** The method repeats an update. Show the frames, with click stops on the first two and the last, and let the learner scrub the rest.
11. **Pause and think.** Always, at least once in any 6 steps. Ask the question the learner should be asking; answer it on the next click.
12. **Interview angle.** The topic is a common exam or interview question. Ask it the way an interviewer would, on a review card or in a think stop: "why n − 1 and not n?"
13. **Real product demo.** The method runs inside a tool the learner uses (a clustering in Seurat, a test in DESeq2). One scene that shows where the number appears in that tool's output. Do not invent the tool's output: show the shape, not made-up values.
14. **"Don't be afraid."** The real expression or diagram is big. Show it whole, say "most of this you can ignore", then mark only the 2–3 parts that matter.
15. **Labelled drawing.** Before writing a formula, name every part on the picture: inputs, weights, the constant 1.
16. **Dependency drawing and the chain rule.** One quantity depends on another through several steps. Draw the chain (`flow`), one factor per link, before the derivative.
17. **Board style.** Always: the board accumulates. Earlier items stay, in grey; the current one is in colour.
18. **Limitation as its own beat.** Always: one whole scene, on the same data.
19. **Simplify first.** The method has several parameters. Freeze all but one, learn that one, then free the rest ("fix the slope and learn only the offset").

## 5. Voice
You are a teacher at a whiteboard talking to one student. Each step's `say:` is the one line you would say while writing.

- **One breath per click**: at most 24 words. Short sentences. Active voice.
- **Say what you are doing, then why**: "Square each distance. Now every one counts, and far cells count most."
- **Use the learner's words**: "cells", "CD3 level", "counts", not "observations" or "the random variable".
- **Define a term once**, the first time, as plain words then the term: "how far a cell sits from the mean (its deviation)".
- **Read the board aloud**: name the cell, the column, the number on screen. "c5 sits 2.4 above the mean." Numbers come from `{{…}}`, never typed.
- **A think question is a real question**: it has one short answer the learner can reach from what is on the board. "Which cell sits farthest from the mean?" not "What do you think?".
- **A think answer gives the answer and its reason** in one or two sentences.
- **Colour the text that matters, a few words per scene.** Colour a term the same colour as its symbol and its table column (`==s1:CD3==`). Bold (`**…**`) a result. An underline (`==text==`) is rare: once or twice in a lesson, for the one line to remember. Never colour a whole sentence.
- **No hype, no filler**: no "amazing", "simply", "just", "as you can see".

## 6. Pacing
- **One new thing per click.** A click adds one item, or marks one part, or asks one question.
- **Two to four clicks per idea.** Show it, name it, check it with a think stop.
- **A scene is one idea.** If the lead line needs "and", split the scene.
- **Leads link scenes.** Each scene after the plan has a `lead:`: one short line that ties it to the last. Read the leads in order; they should tell the story alone.
- **Hard steps get a think stop before them.** Where the learner is most likely to get lost (a sign that flips, a division that seems arbitrary), ask first.

As a soft guide, the course this skill learned from spent its teaching time roughly like this (code segments removed; the beat labels are a model's reading of captions, so the shares are rough):

| Beat | Share of time (%) |
|---|---|
| formula | 15 |
| picture (geometry) | 13 |
| compare | 11 |
| algorithm (the steps of the method) | 9 |
| limits | 6 |
| motivation and problem | 10 |
| real example | 6 |
| animation (run) | 5 |
| by-hand, toy data and tables | 9 |
| plan, recap, summary, next | 9 |
| analogy, aside, misconception | 5 |

That course spent little time on the hand calculation. This skill spends more, because the learner asked for it: expect `by-hand` to be the longest scene, or two scenes. Never treat the table as a quota.

## 7. Series
A topic becomes a series of 2–3 lessons when it has more than about 7 new ideas, or one lesson would need more than 14 scenes.

- **Split by What / How / Why.** Lesson 1: what the thing is and what it gives you, worked by hand once. Lesson 2: how it is computed, in full, on the same table. Lesson 3: why it works (the geometry, the derivation, the assumptions) and where it breaks. Some topics split better by sub-question; keep each lesson's question answerable on its own.
- **Write all the questions first**, show them to the user, and wait for an OK before building lesson 1.
- **Same data, same layout.** Every lesson reads the same home table (`home:`), the same rows, in the same orientation.
- **Number the lessons.** Each lesson has `series: <name>` and `episode: <n>` at the top.
- **Lesson 2 onward opens with recall.** Put `recall: [../<earlier-slug>]` at the top (`board.md`, Series). The build copies the earlier lessons' review cards, with their numbers, into a quiz right after the title. Then the plan.
- **Close each lesson with the next one's question** (the `next` scene), and record any question it raised and did not answer as an open loop (`memory.py loop`). Start the next lesson by closing one.

## 8. Review cards
The last slide is a `quiz` of 5–8 cards. Each card is a question and a short answer.

- **Test the method, not the trivia.** "Why square the distances?" beats "What symbol is the mean?"
- **Mix kinds**: one card asks for a number from the lesson's table (computed, `{{…}}`); one asks why a step is there; one asks what breaks; one asks what changes if an input changes.
- **At least one card from an angle the lesson did not take**: an interview question, a different field, a reversed question ("a variance of 0 means what?").
- **Order them by importance.** A later lesson's recall quiz takes the first cards of this one, so put the one the learner must keep first.
- **A card may read data names** (`{{xbar|1}}`); a later lesson then shows this lesson's numbers. Every name a card reads must be in this lesson's `data.json` or inline `data:`.

## 9. The review (gates 4 and 5)
Open `snaps/desktop.png` (one photo per scene, each at its last click) and `snaps/numbers.txt` (every number the page drew). Then answer each question below with yes, or fix the YAML and rebuild.

**Eyes**
1. Did you look at every board, full? Nothing cut off, nothing overlapping, the table and the work area both readable.
2. Is the current item, and only it, in colour on each board? Is the orange accent on the thing in use?
3. Does every picture with geometry have equal scales on both axes, and does every point sit inside its box?
4. Do the numbers in `numbers.txt` match `verify_data.py`'s output?

**Pedagogy**
5. Read only the scene titles and leads, in order. Do they tell the story: question, plan, problem, work, formula, picture, limits, answer, next?
6. Pick the formula scene. For each term, can you find the by-hand scene and click where that number was worked?
7. Is there a think stop before the hardest step? Does each think answer give a reason?
8. Does the limits scene use the lesson's own data?
9. Does the summary answer the opening question in the opening question's words?
10. Do the review cards include one from an angle the lesson did not take?
11. Could a learner redo the by-hand scene on a new table of 3 rows, from the boards alone?

If question 6 or 11 fails, the lesson does not teach yet: add the missing by-hand step, not more prose.
