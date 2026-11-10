# C10 design, version 2 (approved by the user, 9 Nov 2026)

The design for the rest of change 10: what is wrong, the chooser, the look, the new picture families. Nothing here is built yet. Block status, order and decisions live in the ledger, [c10-visuals.md](c10-visuals.md); who runs what lives in [c10-handoff.md](c10-handoff.md). A block's orchestrator reads only its own block's rows here (§3 for C10g, §4 for C10i, §5 for its row, §6 for its pictures).

Inputs read for this plan: the handoff, the ledger, [learner.md](learner.md), `out/c10/inspire/notes.md`, `gptchat.md`, `out/c10/plan.md`, the contact sheet `out/check/class-pca-2-how/desktop.png`, the bench shot `out/c10/bench/shots/1-default.png`, the user's 9 images, and three helper reports in `out/c10/plan2/` (`inventory.md` and `refs.md` by Terra 6.1 high, `argon.md` by Gemini 4 Argon high).

## 1. What is wrong today (evidence)
1. **The picture follows the beat, not the idea.** `lesson.md` §2 pairs each beat with the same few items (`picture` → plane or chart). Nothing maps a kind of idea to a kind of picture, and no lint looks at fit or variety (`inventory.md`, "Selection guidance").
2. **The vocabulary is narrow and half unused.** Across the 6 shipped lessons: `plane` 33 uses, `table` 18, `chart` 14; `dist` and `units` 0. The kit cannot draw a specimen, a branching outcome, a linked input → output, or a mark the learner drags.
3. **Every scene has the same stage.** Same two columns, figure at about half its plate, thin marks, orange on titles, sliders, tags and marks alike. No scene changes scale, so nothing reads as the main event.
4. **Taste never reached the builders.** Briefs held words, not pictures or numbers. Reviewers checked code; only the user checked the look.

## 2. The design in one paragraph
`adv` stays opt-in (the user, 9 Nov). **What goes where:** a feature reaches every lesson when the lesson agent reads nothing more and writes nothing more for it (kit defaults: the look, the camera glide, the smooth run, the shared pointer). It is adv-only when the agent must read or write more, or when it needs an image (the chooser fields, `guess`, `patch`, `span` and `ruler`, `fork`, drawn parts, the `wide` and `strip` stages). So a plain lesson costs the same tokens and still looks better. With `adv`, the lesson agent (a) names the **kind of idea** in each scene and takes the picture from a short table, (b) keeps a three-part **contract** per figure, and (c) draws with a few **new picture families**. The **look** is fixed in the kit as numbers and enforced by the browser check, so a mid-level agent cannot dilute it. Everything `adv` needs lives in one file, `class/adv.md`, with one copy-ready scene per family in an `adv-gallery` example.

## 3. The chooser (adv only)
*As built in C10g (9 Nov), three things differ from this section: a third field `shows`; `idea` may be the learner's own question; a depth budget replaces check 4. See the ledger's Decisions.*

Each scene adds two short fields. The lint checks them; the same fields are the picture plan the user approves before any scene is written.

```yaml
- beat: picture
  idea: closest      # the kind of idea, from the table below
  see: residual      # the one mark that must carry the point
```

| `idea` | The learner is stuck on | Picture family | Kit today |
|---|---|---|---|
| `made-of` | where does this number come from? | loupe: whole → one part → its numbers | block J (`patch`) |
| `amount` | how much, what share? | countable units, a level that fills | has `units`, `parts` (never used) |
| `cause` | what happens if I change this? | one handle moves one mark | has sliders; block C adds drag |
| `closest` | which choice is best? | drag your guess, see the error, then the answer | block C |
| `shortcut` | why not the easy way? | the wrong way as a ghost on the same frame | has `when:`; block C adds `decomp` |
| `process` | how does it move, step by step? | run with stops and a trail | has `run`; block C smooths it |
| `connect` | how do the pieces feed each other? | linked strip: input, operation, output light together | block J |
| `outcomes` | what can happen? | one start, 2–3 aligned ends | block F (`fork`) |
| `chance` | is this difference real? | dots as draws, the gap measured in noise units, draw again | has `dist`, `run`; block K adds `span`, `ruler` |
| `angle` | what does it look like from the right side? | a named view the camera glides to | block C |
| `like` | what is it like? | two pictures with matching colours, and where the match breaks | has `compare` + word links |

**The contract for every adv figure**
- **Witness:** the mark named in `see:`. Its shape shows the point without reading text. It stands out by weight and glow (§4), not by owning the orange.
- **Handle:** at most one control per figure, and it moves the witness. The handle wears the colour of the thing it moves.
- **Foil:** a `shortcut`, `misconception` or `limits` scene draws the wrong way and the right way on one frame.

**Checks (lint unless marked browser)**
1. `idea` is in the table, and the scene's figure belongs to that idea's family.
2. `see` names a mark in the scene, and that mark has its linked word in a teacher line.
3. A `shortcut`, `misconception` or `limits` scene holds two states on one frame.
4. Warning: one family fills more than 3 scenes, or a lesson of 8+ scenes uses fewer than 4 families.
5. Browser: sweep each control end to end; the witness must move or change size. A control that does not move the witness fails.
6. Browser: the look gates in §4.

**Picture plan the user sees.** A script renders the spine (titles, leads, `idea`, `see`) as one storyboard image: a family icon per scene. No model call. Ten identical icons show sameness before a single scene is written.

## 4. The look, as numbers (first draft; settled in the block I playground)
| What | Rule | Checked by |
|---|---|---|
| Fill | the drawing covers ≥ 60% of its plate's width or height | browser |
| Stage | `split` (today), `wide` (figure takes the full width; at most 2 per lesson, for the main event), `strip` (three linked columns) | lint |
| Lines | three weights only: 1 px guides at low contrast, 2 px data, 3.5 px witness | kit |
| Dots | ≥ 9 px across when a figure holds ≤ 50 | kit |
| Colour | the theme stays black and orange (the user, 9 Nov): orange keeps its jobs (titles, tags, controls, think stops). ≤ 4 mark hues per figure plus greys; the witness is the heaviest mark and takes the legend glow | lint + browser |
| Text on the figure | axis names and tick numbers only; names live in linked words; no boxes | lint (exists in part) |
| Clearance | every label ≥ 8 px from every mark at both ends of each control | browser |
| Controls | outside the drawing; view buttons on the figure's top rule, not stacked over it | kit |
| Motion | hover 180 ms, a state change 450 ms, a camera glide 700 ms, one easing curve; a mark moves only when its number changed or the camera did; honours reduced motion | kit + browser |
| Depth (3D) | soft shadows on the floor, a crisp sheet edge, a right-angle tick on the drop | kit |

## 5. Blocks, in the new order
Done blocks (C10a, b, d, e) stay as they are. Each block still follows the ledger's loop. Every mock-up ships as a **playground**: the figure, an options panel, and a settings line the user sends back (as in C10a).

| Block | What it adds | The user picks, in the playground | Needs | Signature moment |
|---|---|---|---|---|
| **C10i. Look and playground shell** | Half 1, mock-up only: the §4 numbers as one stylesheet and one reference page (the bench scene and one pca-2 scene restyled), plus a reusable playground shell made from `out/c10/h3d/src/play.js`. Half 2: the picked look goes into the kit as defaults for every lesson | fill, line weights, the witness's weight and glow, `split` / `wide`, control placement | — | the same scene, before and after, side by side |
| **C10g. Chooser** | `class/adv.md` (≤ 80 lines): the idea table, the contract, the plan format; lint checks 1–4; the storyboard script; `SKILL.md` +2 lines. Uses only items the kit already has | the storyboard look; the plan format | — (runs beside C10i half 1) | a plain and an adv storyboard of one topic, side by side |
| **C10k. Proportions bench and chance** | a second bench: a test of proportions (the user's topic, 9 Nov; the block opens by settling one group against a fixed share, or two groups). Counts as `units`; `span` and `ruler` marks (the gap between two shares, measured in steps of the noise); "draw again" as a run over seeded draws | the exact question and toy table; the ruler look | C10g | press "draw again": the gap wobbles, the ruler shows how much wobble is normal |
| **C10c. Motion and hands-on** | named view per step, camera glide, smooth run (as planned); plus a guess the learner drags on the sheet or plane, a predict stop that waits for the drag, `decomp` (the slanted split), and the edge-view tick clash from `c10b/report.md` | glide feel, handle look, how the answer is revealed | C10i | hunt for the smallest residual by hand, then the true drop appears with the gap |
| **C10j. Linked strip** (pulled forward from "later") | one shared pointer: a table row, its dot, its product row and its patch cell light together (no new YAML: the ids exist); `patch`, a grid of cells in their computed colours with one pickable; the `strip` stage | patch size and cell look, strip layout | C10e, C10i | tissue patch → one pixel → its 3D point → edge-on right angle |
| **C10f. Drawn parts** (replaces the pictures fix as the main route) | the sketch skill's parts (cell, nucleus, chromosome, tissue, tube, plate, read, droplet, lens) usable on a board; `fork` for 2–3 aligned outcomes; `image.py` refuses maths subjects (small lint). Image-model anchors wait until the user asks for image-model pictures | dark-ink look or a paper plate set into the board; 2–3 layouts | C10i | one cell splits into three aligned outcomes, like the user's image 3 |
| **C10h. Cold-start exam** | a cold Opus 5.5 medium agent builds two adv lessons from `plugins/` only: H&E and the proportions test. Report: families used, checks passed, tokens in and out, comparison with the study chat | judge both lessons | the blocks the user wants in | — |

Order, chosen for cost (the user, 9 Nov: "whichever is more efficient"): C10i half 1 beside C10g → C10i half 2 → C10k → C10c → C10j → C10f → C10h. Why: the first two need no new figure kind, so adv lessons look better and vary more at once. C10k is small and tests the chooser on a non-geometry topic before more is built on it. C10f is the largest and gains from every earlier pick. The user can stop after any block. Still parked: short films, generative art, image-model illustrations, agent-written widgets.

A stretch for C10j, to try as a mock-up before promising it: a 40 × 40 patch split live into H only, E only and leftover as the learner flips "shortcut" and "joint" (`argon.md` D2).

## 6. How we work: what changes
| Change | Why |
|---|---|
| **Design gate before the user.** The orchestrator opens the screenshots and holds them against §4 and the named references; one send-back to the builder is allowed before the user looks | today only the user reviews the look |
| **Every brief has a "Look at" part:** the look file, plus 2–4 pictures by path, each with one line to borrow and one not to copy (list below) | the first plan's builders never saw a reference |
| **Mock-ups import the look stylesheet.** Options differ in structure and behaviour, never in private styling | keeps Opus medium's options comparable and on-style |
| **Playground, not a GIF,** for every choice with more than one setting | the user's wish; the C10a settings line worked |
| **Two benches:** H&E (geometry) and the counts topic (chance) | one geometry topic cannot show variety |
| **Review in proportion:** mock-up blocks get no code review; a kit change under about 150 lines gets one Terra reviewer, one round, plus the orchestrator's probe; larger changes keep two reviewers and two rounds | saves runs where risk is low. The user said yes (9 Nov); for C10 blocks this replaces "How we work" rule 2 |
| **Trial:** in C10i, Argon high also critiques the same screenshots. If it catches what the orchestrator catches, it can hold the design gate in chats run by a cheaper orchestrator | untested; decided by the trial |

**Who does what.** The strong model plans the design, writes the look numbers and holds the gate. Opus 5.5 medium builds mock-ups and kit changes. Terra reads, hunts and reviews code. Argon is the second eye on design. The strong model builds by hand in two cases only: the look page of C10i (a look described in words is where a builder loses it), and any mock-up that fails the gate twice. The routing table is in the handoff.

**Pictures to name in briefs** (paths under `out/c10/inspire/`; rows I, C, J, K, F are blocks C10i, C10c, C10j, C10k, C10f)
| Block | Borrow | Do not copy |
|---|---|---|
| I | `shots/bicycle-03.png`, `bicycle-04.png`: controls outside, one coloured cause. `user-shots/2.webp`: one orange on greys. `shots/pele-01.png`: label space kept before drawing | `user-shots/6.webp`, `7.webp`: dark boxes over the geometry |
| C | `user-shots/9.webp`: a handle in the colour of its body. `video-sheet.png`: a fixed frame while one thing changes | a camera that moves by itself |
| J | `user-shots/8.webp`, `shots/cnn-03.png`, `cnn-04.png`: one window paired with one result. `user-shots/4.webp`: the bridge from tissue to one cell | `user-shots/5.webp`: a painted tissue whose pixels are not the data; hover as the only way in |
| K | `user-shots/2.webp`, `1.webp`: units you can count, a level that fills | a lone bell curve with a shaded tail |
| F | `user-shots/3.webp`: three ends on one baseline. `shots/pele-02.png`: named states and clear paths | labels that cross the drawing; paper texture as a default |

## 7. What a run pays
- **Plain lesson:** nothing new to read or write. `adv.md` and every adv-only YAML key stay out of `board.md` and `lesson.md`; `SKILL.md` gains 2 lines. The look and the motion arrive as kit defaults.
- **Adv lesson:** reads `adv.md` once (≤ 80 lines), copies scenes from the `adv-gallery` example by `idea`, and writes two short fields per scene. Token counts: **not measured**; C10g counts them on the bench.
- **Workshop cost:** not measured. C10h reports tokens per lesson; each block report lists its runs.

## 8. The user's answers (9 Nov)
1. Look: cheap things reach every lesson; only extra images and things that cost tokens to build are adv-only (the rule in §2).
2. Orange: the theme is black and orange, as today. Not witness-only.
3. Second bench: a test of proportions.
4. Lighter review for small changes: yes.
5. Order: the most efficient one (§5).
6. Each block runs in a new chat started with the strong model, which delegates as in the handoff.

## 9. Not tested, and limits
- No block here is built. Feasibility of drag on a 3D sheet, the live 40 × 40 unmixing and parts on a dark board is a mock-up question, not a fact.
- The look numbers are design judgment drawn from the references. They are not evidence of learning gains.
- Helper reports are static readings of files and screenshots. `refs.md` did not operate any control; `inventory.md` counts authored items in 6 examples and one bench, not what cold agents usually build.
- Argon's skill at critiquing screenshots is unknown until the C10i trial.
