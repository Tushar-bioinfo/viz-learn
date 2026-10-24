# Probe: ask before you build

One message, 3–5 questions, every answer a letter. The learner should answer in one short line, such as `1b 2c 3ad 4a 5b`. Then **stop and wait**.

The probe does four jobs:
1. **Entry rung.** Which prerequisites does the learner already have? Skip those; build the rest from the ground. (Too much guidance for someone who knows it hurts too: the expertise reversal effect.)
2. **Anchors.** Which worlds should the analogies come from?
3. **Goal and depth.** Is the goal intuition, doing it by hand, reading papers, or writing code? How many slides?
4. **Pretest.** One quick prediction about the topic. Guessing before a lesson improves memory of the questioned material, even when the guess is wrong. The deck reveals the answer on slide 2.

## The message (fill the brackets; drop any question the profile already answers)
```
Before I build the deck: 5 quick ones. Answer like "1b 2c 3ad 4a 5b", or say "just build".

1. Goal: what should you leave with?
   a) the intuition   b) intuition + do it by hand   c) read it in papers   d) write the code
2. Quick guess (no looking up): [one prediction question about the core mechanism]
   a) …  b) …  c) …  d) not sure
3. Which of these do you already use comfortably? (pick all)
   a) [prerequisite 1]  b) [prerequisite 2]  c) [prerequisite 3]  d) none of these yet
4. Analogies from:
   a) [anchor from profile]  b) [anchor]  c) your lab or coding work  d) everyday life  e) surprise me
5. Length: a) quick (~8 slides)  b) standard (~15)  c) deep (25+, in chapters)
```

## Writing the questions
- **Q2, the pretest.** Ask about the mechanism, not a definition. Pick something a novice gets wrong for an instructive reason. Make the options parallel, with one right answer and one tempting wrong answer. Never reveal the answer in the probe.
  - Good: "A gene doubles its reads in every sample. What happens to its log fold change between groups? a) doubles b) unchanged c) +1 d) not sure"
  - Bad: "What is a negative binomial?" (recall, not prediction)
- **Q3, prerequisites.** List the 3 lowest rungs of the ladder (`story.md` §2) in plain words, such as "mean and variance", "what a p-value is", "log scale". Keep the "none" option.
- **Q4, anchors.** Offer 2 anchors from the profile first. If there is no profile, offer one sport, one money example (prices, returns), the learner's own work, and everyday life. Never invent a hobby the user has not mentioned.
- Keep the message under 120 words. No preamble, no explanation of why you ask.

## Using the answers
| Answer | Decision |
|---|---|
| Goal a | intuition first: pictures, bridges, few formulas; at most one `equation` slide |
| Goal b | add `calc` slides and a worked `table`; every formula gets plugged with numbers |
| Goal c | add notation: an `equation` slide in paper notation (`tex` with `[terms]`), then the same thing in plain words |
| Goal d | add `code:` to equation slides and a `code` visual; keep the variable names the same as in the formulas |
| Q2 right | open with a harder version of the puzzle; the predict slide confirms the guess, then pushes further |
| Q2 wrong or "not sure" | keep the pretest as slide 2; the deck must make the right answer visible, not just tell it |
| Q3 picks | those rungs become `learner.knows`: one recap line, no full slide |
| Q3 "none" | start one rung lower than planned; add a small worked example before each new symbol |
| Q4 | `learner.anchors`; pick bridges from these only (`story.md` §6) |
| Q5 | quick = 6–9 slides, one arc; standard = 12–18; deep = 25+ in chapters, and show the beats first |

## Skipping the probe
- The user says "just build", "no questions" or "quick": skip it, take the profile defaults (or goal b, standard length), and put your assumptions in one line at the top of your reply.
- The user is in the middle of a topic you have already probed this session: do not probe again. Ask at most one question, and only if the new part of the topic changes the entry rung.

## After the answers
Write them into `deck.yaml` under `learner:` (`goal`, `knows`, `anchors`) so the linter can check the ladder against them. Then update the profile:
```yaml
# ~/.lucid/learner.yaml (create from profile.example.yaml if missing)
anchors: [cricket, stock returns]          # add new ones, strongest first
knows: {mean: 3, variance: 3, poisson: 1}  # 0 new · 1 heard of it · 2 can use it · 3 can teach it
confusions: ["tables with numbers but no formula"]
```
