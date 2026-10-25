# Probe: ask before you build

One message, 3–4 questions, every answer a letter. The learner should answer in one short line, such as `1b 2c 3ad 4a`. Then **stop and wait**.

The probe does four jobs:
1. **Entry rung and footholds.** Which prerequisites, and which related formulas and ideas, does the learner already have? Skip the known rungs and build the rest from the ground. (Too much guidance for someone who knows it hurts too: the expertise reversal effect.) The known formulas are the footholds: each new formula is shown growing from one of them (`from:`), and its relatives come from them too (`kin:`).
2. **Connections.** Which comparison makes the core idea click for this learner? Offer real candidate analogies, not just worlds, so the answer picks the bridge itself.
3. **Goal.** Is the goal intuition, doing it by hand, reading papers, or writing code?
4. **Pretest.** One quick prediction about the topic. Guessing before a lesson improves memory of the questioned material, even when the guess is wrong. The deck reveals the answer early (slide 2 or the first slide of its chapter).

## The message (fill the brackets; drop any question the profile already answers)
```
Before I build the deck: 4 quick ones. Answer like "1b 2c 3ad 4a", or say "just build".

1. Goal: what should you leave with?
   a) the intuition   b) intuition + do it by hand   c) read it in papers   d) write the code
2. Quick guess (no looking up): [one prediction question about the core mechanism]
   a) …  b) …  c) …  d) not sure
3. Which of these do you already know? (pick all)
   a) [prerequisite 1]  b) [prerequisite 2]  c) [a formula the topic grows from]  d) [a cousin idea]  e) none yet
4. Which comparison clicks for [the core idea]?
   a) [one-line mapping from anchor 1]  b) [one-line mapping from anchor 2]  c) your lab or coding work  d) surprise me
```
Add a 5th question only when the request does not say how long: `5. Length: a) quick (~8 slides) b) standard (~15) c) deep (25+, in chapters)`.

## Writing the questions
- **Q2, the pretest.** Ask about the mechanism, not a definition. Pick something a novice gets wrong for an instructive reason. Make the options parallel, with one right answer and one tempting wrong answer. Never reveal the answer in the probe.
  - Good: "A guide has 400 reads in the control and 200 in the treated sample, at equal depth. Is the drop real? a) yes, it halved b) no, 200 is still a lot c) it depends on how much guides near 400 reads normally wobble d) not sure"
  - Bad: "What is a negative binomial?" (recall, not prediction)
- **Q3, what they know.** Two of the lowest rungs of the ladder (`story.md` §2) in plain words ("mean and variance", "log scale"), then one formula the topic's main equation can grow from ("the binomial", "a percentage", "a weighted average") and one cousin idea from a nearby field ("the t-test", "compound interest"). The picks become `learner.knows`, and they decide each equation's `from:` and `kin:`. Keep the "none" option.
- **Q4, connections.** Write each option as a one-line mapping onto the core idea, from the profile's anchors first: "a batter's form that changes day to day ≈ a sample's true level". If there is no profile, offer one sport and one money example. Never invent a hobby the user has not mentioned. The pick becomes the main `bridge`; an option they skip is not used.
- Keep the message under 120 words. No preamble, no explanation of why you ask.

## Using the answers
| Answer | Decision |
|---|---|
| Goal a | intuition first: pictures, bridges, few formulas; at most one `equation` slide |
| Goal b | add `calc` and `ops` slides and a worked `table`; every formula gets plugged with numbers |
| Goal c | add notation: an `equation` slide in paper notation (`tex` with `[terms]`), then the same thing in plain words; keep the notation chips on |
| Goal d | add `code:` to equation slides and a `code` visual; keep the variable names the same as in the formulas |
| Q2 right | open with a harder version of the puzzle; the predict slide confirms the guess, then pushes further |
| Q2 wrong or "not sure" | keep the pretest early; the deck must make the right answer visible, not just tell it |
| Q3 picks | those rungs become `learner.knows`: one recap line, no full slide. A picked formula is the `from:` of the equation that grows from it; a picked cousin goes in `kin:` and on the closing `map` |
| Q3 "none" | start one rung lower than planned; add a small worked example before each new symbol |
| Q4 | the picked mapping is the main `bridge`; its world joins `learner.anchors`, and later bridges and `kin:` relatives come from these worlds only (`story.md` §6) |
| Length | quick = 6–9 slides, one arc; standard = 12–18; deep = 25+ in chapters, and show the beats first. Unasked: a method or pipeline is deep, a single formula is standard |

## Skipping the probe
- The user says "just build", "no questions" or "quick": skip it, take the profile defaults (or goal b, standard length), and put your assumptions in one line at the top of your reply.
- The user is in the middle of a topic you have already probed this session: do not probe again. Ask at most one question, and only if the new part of the topic changes the entry rung.

## After the answers
Write them into `deck.yaml` under `learner:` (`goal`, `knows`, `anchors`) so the linter can check the ladder against them, and keep the raw answer line in a comment at the top of the file. Then update the profile:
```yaml
# ~/.viz-os/learner.yaml (create from profile.example.yaml if missing)
anchors: [cricket, stock returns]          # add new ones, strongest first
knows: {mean: 3, variance: 3, poisson: 1, binomial: 2}  # 0 new · 1 heard of it · 2 can use it · 3 can teach it
connections: ["run rate ≈ CPM"]            # comparisons that clicked: reuse them as bridges and `kin:`
confusions: ["tables with numbers but no formula", "formulas from nowhere"]
```
