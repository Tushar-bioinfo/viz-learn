# Story from ChatGPT, lesson from `class` (any topic, adv, full voice)

Two parts. Paste **Part A** into ChatGPT with the blanks filled. Then start the agent with `/class`, paste **Part B**, and paste ChatGPT's answer under it.

This version is for an **adv** lesson (a picture plan for every scene, `skills/class/adv.md`) in the **full voice** (`learner.voice: full`), with every word cap doubled (see Notes). The limits below come from `plugins/viz-os/skills/class/lesson.md` §1–6, `board.md` (step fields) and `adv.md` §2–6. If those change, update this file.

---

## Part A: prompt for ChatGPT

Works for any topic. Fill the five lines under `== YOUR LESSON ==`; leave a line as `?` and ChatGPT proposes it.

```text
You are writing the spoken script for a lesson taught at a whiteboard, on any topic. Another tool will draw the board (tables, charts, formulas, pictures) and compute every number. Your job is the words: what the teacher says, why, the questions they ask, and, for each scene, the picture they want drawn, described in words. Write in your own natural, warm, explaining voice, in depth, with full reasons. Follow the format and caps below exactly, because your lines will be used word for word.

== YOUR LESSON ==
TOPIC: <the method or idea to teach>
QUESTION: <one question the lesson answers, or ? to propose one>
LEARNER: <who they are, what field they work in, what they already know, or ?>
DATA: <a small table from the learner's world: 3–8 rows, 2–4 columns; say what one row is and what each column measures; or ? to propose one>
DEPTH: <how many scenes may work on one idea: 4 for more worked cases (default), 2 for a lighter lesson>

If a line is ?, propose it at the top of your answer under PROPOSED, then write the lesson on it.
Pick a DATA table that fits both the topic and the learner's field, small enough to work by hand. Rows keep the same meaning in every scene.

== WORD CAPS (hard limits, never go past them) ==
- SAY: 100 words, with no sentence over 24.
- WHY: 48 words.
- THINK Q: 48 words.
- THINK A: 80 words.
- NOTE: 60 words.
- Every sentence, in every line: at most 24 words. Longer lines come from more sentences, never longer ones.  TITLE: 4–8 words.  TRANSFER field: 6 words.
These are caps, not goals: aim close to them (targets below). A line far under its target is too thin.

== RULES FOR NUMBERS (most important) ==
- Never write a number that comes from the data or from a calculation. You do not know the data values.
- Where a number belongs, write a slot: [[name: what it is]], e.g. [[mean_a: the mean of column A]], [[d1: how far row 1 sits from the mean]]. Reuse the same name every time you mean the same number.
- Where an answer depends on the data (which row is largest, which side wins), use a slot too: [[top_row: the row with the largest value]].
- You may name rows and columns, and use plain counts that define the setup (6 rows, 3 columns).
- In formulas, write symbols in LaTeX between $…$ (e.g. $\bar{x}$). A symbol may appear only after its number was worked in an earlier step.

== SHAPE OF THE LESSON ==
8 to 14 scenes. Each scene has one job (its beat). Order:
1. problem: show the need before the method, on the learner's data; end on a think stop.
2. The middle, in whatever order the topic needs, from:
   data (put the table up, point at what matters),
   by-hand (work the method on the table, ONE operation per step, name each new number; the longest part, may be 2 scenes). If the topic is not arithmetic (a pipeline, a model, a test), work one small concrete case through it, one move per step.
   picture (what the numbers look like: a distance, an area, a slope, a path),
   formula (only when the topic has one: build it from the by-hand numbers, our numbers first, then the symbols in their place, each term named in plain words),
   run (only if the method repeats an update: frame by frame),
   what-if (change one input, say what moves).
   Optional: analogy, compare, misconception (a wrong idea, why it fails, the right one), shortcut (the easy wrong way next to the right way), aside (2–3 steps).
3. limits: where the method breaks or what it assumes, on the same data.
4. next (last): first line answers the opening question in its own words; next line says what the answer leaves open; then the next lesson's question.
No plan scene, no summary scene, no quiz.
If the topic needs more than 14 scenes or about 7 new ideas, say so under PROPOSED and split it into a What / How / Why series of 2–3 lessons on the same DATA; write lesson 1 only.

== THE PICTURE PLAN: every scene except `next` ==
Each scene teaches one idea through one picture. Give each scene:
- IDEA: what the learner is stuck on. Pick one name from this list, or write the learner's own question ending in "?":
    made-of   (where does this number come from? whole → one part → its numbers)
    amount    (how much, what share? countable units, a level that fills)
    cause     (what happens if I change this? one handle moves one mark)
    closest   (which choice is best? your guess, its error, then the answer)
    shortcut  (why not the easy way? the wrong way as a ghost on the same frame)
    process   (how does it move, step by step? a run with stops and a trail)
    connect   (how do the pieces feed each other? input, operation, output, lit together)
    outcomes  (what can happen? one start, 2–3 ends side by side)
    chance    (is this difference real? dots as draws, the gap in noise units)
    angle     (what does it look like from the right side? a named view to turn to)
    like      (what is it like? two matched pictures, and where the match breaks)
- SHOWS: the picture in words, one line (e.g. "the six rows as dots on a line, the mean as a post, each row's distance as a drop").
- SEE: the one mark in that picture that carries the point, in 1–2 words (e.g. "deviation"). Its shape should show the point without any text. At least one SAY, LEAD or THINK Q in the scene must name it as ==word== (e.g. "Each ==deviation== is a row's distance from the post.").
- HANDLE (optional): at most one thing the learner can move, and it must move the SEE mark (e.g. "a slider on row 5's value").
Vary the ideas: ten scenes with the same idea teach the same way ten times. No idea may take more scenes than DEPTH.
A shortcut, misconception or limits scene shows the wrong way and the right way on one picture (the wrong one as a ghost, a before and after, or a toggle). Say both in SHOWS.

== EACH SCENE ==
- TITLE: the scene's claim, 4–8 words.
- LEAD: one short line tying it to the last scene (not for scene 1). Read in order, the leads should tell the story alone.
- STEPS: 6 to 10 in most scenes (the `next` scene 3–4). Each step adds ONE thing: one item, one mark, or one question. Depth comes from more steps and fuller lines, never from cramming two ideas into one step.

== EACH STEP: long, in-depth lines ==
Short lines are a failure here. Aim for each TARGET; never pass the cap.
- SAY: 4 to 6 sentences, TARGET 75–100 words (cap 100, no sentence over 24). The sentences do these jobs, in order:
    1. what we see or do, naming the row, column or slot on the board;
    2. a second look: one concrete row or case, read aloud;
    3. what it means, in plain words;
    4. the turn: the consequence, the catch, or what it sets up next ("But …", "So …", "Notice …").
  Join sentences with a word (So, But, Because, Notice), never with ";".
- WHY: 2 sentences, TARGET 32–48 words (cap 48). The deeper reason or the lesson's argument at this step, the line a good teacher adds after a pause. Not a repeat of SAY. Every step that computes something needs one; give one to most other steps too.
- THINK Q: TARGET 32–48 words (cap 48), 2 sentences or more. Give the setup the learner needs, then ask one question with one answer they can reach from the board.
- THINK A: TARGET 60–80 words (cap 80), 3 or 4 sentences. The answer first, then the reason, then what it means for the method, then a link back to the board.
- MORE: on at least half the steps. 3–5 sentences that answer the next question a curious learner would ask: an edge case, the history of a name, how real tools do it. Define any term again inside it, as if read alone. Each sentence under 24 words.
- NOTE: optional, a line written on the board itself (cap 60).
- BOARD: optional, one plain line saying what appears on the board at this step. A hint only.

== EXAMPLE OF THE LENGTH AND DEPTH WANTED (one topic among many; copy the length, not the content) ==
STEP 3
SAY: Each row's distance from the mean goes in a new column, right beside its value. Rows above the mean get positive distances, and rows below it get negative ones. Row 5 sits far above the others, so its distance is the largest in the column. Yet when we add all six distances, the total comes to [[d_sum: the sum of the distances]]. So the plain sum calls a widely scattered table perfectly still. A measure that says that about this table cannot be a measure of spread.
WHY: A spread score that comes out the same for every table cannot tell a tight table from a widely scattered one. So before we score spread, we need distances that add up instead of cancelling out.
BOARD: a new column, each value minus the mean, and its sum under it
MORE: The distances always cancel, for any table, because the mean is the balance point of the values. That is what a mean is: the place where the pull from above equals the pull from below. So any measure of spread must first stop the signs from cancelling. Squaring and taking absolute values are the two common ways.
STEP 4
THINK Q: Every distance in the new column is real, and some of them are large, like row 5's. Yet their sum is [[d_sum: the sum of the distances]], the same as for a table with no spread at all. What makes them cancel?
THINK A: The mean sits exactly where the pulls from above and below balance. So the positive distances and the negative distances always cancel, whatever the table holds. That is a property of the mean, not of this data. Any honest measure of spread must use a form of distance that cannot cancel, which is what the next step builds. Look at the signs in the column to see the balance.

== THINK STOPS ==
- At least one think stop in any 6 steps in a row.
- Put one right before the hardest step (a sign that flips, a division that seems arbitrary, a step that looks like a trick).
- One, in the last third, is a TRANSFER stop: mark it TRANSFER: <another field, at most 6 words>. It asks where the same move works in that field; the answer says what carries over and one place it breaks.
- At least one question comes from an angle the lesson did not take, such as the question an interviewer or a reviewer would ask.

== VOICE ==
- A teacher talking to one student at the board, explaining in depth: every step says what, why, and what follows. Active voice. Each sentence clear and complete, under 24 words. Keep lines about the same length, near their targets.
- Read the board aloud: name the row, the column, the slot. "Row 5 sits [[d5: row 5's distance]] above the mean."
- Use the learner's own words for their data (what a row is in their field), not textbook words like "observations" or "random variable".
- Define a term the first time, plain words first, then the term: "how far a value sits from the mean (its deviation)". Use the field's real term, never a nickname you made up.
- Show the need before the name, and the method by hand before its formula. Work one named case before any rule about every case.
- Say what just happened, not what to do: "The spread grows as row 5 moves out", not "Drag the slider and watch".
- Personify once or twice at most ("this point pulls the mean toward it").
- Banned: "amazing", "simply", "just", "as you can see", "Here is", "Now", "as we did", "Let's", semicolons, emojis, markdown bold.

== OUTPUT FORMAT (plain text, exactly this, nothing before or after) ==

PROPOSED: <only if a line above was ?: the question, learner, data or series split you chose, one line each>
LESSON: <title of the lesson>
QUESTION: <the lesson's question>
ANSWER: <one sentence answer, using slots for any number>
DATA: <what one row is, the columns, how many rows>
DEPTH: <the number>

=== SCENE 1 · problem ===
TITLE: ...
IDEA: ...
SHOWS: ...
SEE: ...
HANDLE: ...
STEP 1
SAY: ...
WHY: ...
BOARD: ...
STEP 2
THINK Q: ...
THINK A: ...
...

=== SCENE 2 · data ===
TITLE: ...
LEAD: ...
IDEA: ...
SHOWS: ...
SEE: ...
STEP 1
...

(continue to the last scene, `next`, which has TITLE, LEAD and steps only)

SLOTS
<list every slot once: name — what it is — how to compute it from the table, in plain words>

== BEFORE YOU ANSWER ==
- Count the words in every SAY. Rewrite any SAY under 75 words or with fewer than 4 sentences. Rewrite any over 100, or with a sentence over 24.
- Check every WHY is 32–48 words, every THINK Q 32–48, every THINK A 60–80, and at least half the steps have a MORE.
- Check no sentence anywhere is over 24 words.
- Keep the last scenes as full as the first. Do not shorten as you go.
- If the whole lesson will not fit in one answer at full length, write scenes 1–5, end with "CONTINUES", and write the rest when I say "continue". Never shorten lines to fit.
```

---

## Part B: note for the agent running `/class`

```text
adv. Full voice. Build this lesson with the class skill. The story below was written for it: use its words.

- Probe: answer it from the story (topic, learner, data, DEPTH, voice: full) and skip the questions it answers. Ask only what it leaves open, such as whose home table to use.
- Lines: use each SAY, WHY, THINK Q/A, MORE, NOTE, LEAD and TITLE as written. Allowed changes: trim a line to pass a lint word limit, fix a fact that is wrong, turn a [[slot]] into a {{name|fmt}} expression computed by make_data.py, write a symbol as $…$, adjust a ==word== so it names the mark you draw.
- Picture plan: copy IDEA, SHOWS and SEE into each scene's idea, shows and see fields. Choose the figure item yourself, by adv.md and board.md, so it draws what SHOWS says; HANDLE is the one control. If an IDEA cannot be drawn with today's items, say so and propose the nearest one.
- Order: keep the scenes and steps in this order. Add a step only when the board needs one the story lacks (a calc line, a new column); write it in the story's voice.
- BOARD lines are hints. The SLOTS list says what to compute: every slot becomes a computed number; never type one in.
```

---

## Notes

- **Why slots:** the lesson's numbers come from a seeded table that ChatGPT never sees. A number ChatGPT writes would be made up, and the lint would flag it as typed.
- **The caps match the lint:** the class lint's full voice allows `say` 100, `why` 48, think 48 and 80, note 60, each sentence at most 24 (`FULL` in `skills/class/scripts/lesson_lint.py`, raised 16 Nov from 50, 24, 24, 40, 30). With the limits in the prompt, ChatGPT writes to them, and the agent does not have to cut its style away.
- **Why targets, not only limits:** given only "at most 50 words", ChatGPT wrote 2 sentences of about 25 words (first trial, contrastive learning). A target range, a worked example and a self-check push it to the full length the lint allows.
- **Why ChatGPT writes the picture plan:** an adv lesson needs `idea`, `shows` and `see` on every scene before any scene is written (`adv.md` §2). ChatGPT plans the picture in words; the agent picks the figure that draws it.
- **Not tested:** no lesson has been built from this template yet.
