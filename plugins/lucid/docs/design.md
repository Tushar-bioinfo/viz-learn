# Lucid: design notes

For people working on the plugin. The skill files never point here: rules an agent needs live in `skills/deck/`.

## Decisions (and why)
| Decision | Why | Where |
|---|---|---|
| The agent writes only `deck.yaml`; one kit draws everything | Style drift in long outputs comes from hand-written HTML/CSS. If design is not in the model's output, it cannot drift. It also saves tokens: a 21-slide deck is about 4k tokens of YAML, against tens of thousands for hand-written HTML. | `kit/`, `SKILL.md` |
| Rules that long outputs forget are lint checks, not prose | Prose rules decay with output length; a linter does not. The checks: every displayed symbol has a meaning, the ladder order, derived columns have formulas, text budgets, checkpoint spacing, abbreviations. | `scripts/build.py` |
| One expression language for derive, tables, calc, equations, chart functions and `{{text}}` | The formula that computes a number is the formula shown to the learner, so the two cannot disagree; numbers are never typed. | `kit/core.js` |
| Aggregates show their recipe (`mean(x)` → (1/n)Σxᵢ → (8+34+…)/6) | The failure in earlier decks was "x̄ = x̄ = 22.5": a number with no visible logic. | `L.tex` in `core.js` |
| Numbers in worked lines carry their names underneath, once per slide | Anonymous numbers ("0.05152 − 0.009313") were the core complaint about earlier calc pages. Labelling once per slide keeps the clutter down. | `opLabels` in `slides.js` |
| Probe before building: goal, pretest, prerequisites, anchors, length | Prior knowledge decides the entry rung (expertise reversal); a pretest helps memory of the questioned material; anchors make the bridges personal. | `probe.md` |
| A `lead` line on each slide ("But…", "So…") | It makes the causal chain visible and catches "and then" gaps. The lint warns when fewer than half the slides have one. | `story.md` §4 |
| Glass for cards, darker plates for data, one warm accent | Apple keeps Liquid Glass for the control layer and dims clear glass over busy content. Learning content needs legibility first, so data sits on plates, and the lantern accent marks only what matters now. | `lucid.css` |
| No SVG refraction filter | `backdrop-filter: url(#svg)` works in Chromium and Firefox but not Safari (WebKit bug 245510), and the user views decks on an iPhone. Blur, rim light, sheen and depth carry the look everywhere. | `lucid.css` |
| Two stages: 1600×900 landscape and 720×1280 portrait | Phones are a main viewing device. One scaled 16:9 stage makes text about 7px on a phone; a portrait stage keeps body text at 16px or more. | `deck.js`, `lucid.css` |
| Content that runs long is zoomed down (never below 70%) and the audit reports below 80% | Robust to slightly-too-long slides without hiding the problem. | `fitSlide` in `deck.js` |
| Contrast is measured on pixels, against a screenshot with the text hidden | Glass over a moving wallpaper is exactly where legibility fails (Apple's own Liquid Glass backlash). Per-line fragments avoid false readings from chips beside the text. | `scripts/check.py` |
| YAML 1.2 booleans (`No` stays text) and one-line YAML errors with a fix hint | Both were hit while writing the example deck: `[Yes, about 2×, No, …]` split on commas, `No` became `false`, and a `?` broke a flow map. | `build.py`, `spec.md` |
| Categorical palette chosen by search and judged by the dataviz validator | Teal/blossom/periwinkle pass all-pairs on the plate surface (CVD ΔE 8.8, normal ΔE 18.4, ≥ 3:1). The lantern accent and mist are not categorical slots. | `lucid.css`, chart defaults |

## Evidence behind the story rules
Sources were checked by web search this session; effect sizes are as reported by those sources.
- **Pretesting / prequestions.** St. Hilaire, Chan & Ahn (2024), *Psychonomic Bulletin & Review*, preregistered meta-analysis: specific effect g = 0.54 (k = 97), general effect g ≈ 0.04 (k = 91). Guessing helps memory of the questioned material, not the rest. Narrative review: Pan & Carpenter (2023), *Educational Psychology Review* 35:97. Hence the pretest is about the core mechanism, and the deck reveals it.
- **Comparison and analogy.** Alfieri, Nokes-Malach & Schunn (2013), *Educational Psychologist* 48(2): case comparison beats single-case study (reported d ≈ 0.50; one summary says 0.60). Bridging analogies and "anchoring intuitions": Clement (1993), *Journal of Research in Science Teaching* 30(10). Hence `bridge` slides with explicit pairs and `breaks`.
- **Concrete to abstract.** Fyfe, McNeil, Son & Goldstone (2014), *Educational Psychology Review* 26: start concrete, fade to abstract. A 2020 review questions how far this carries into advanced science (*Educational Psychology Review*, 10.1007/s10648-020-09581-7). Hence numbers before symbols, without dropping the general form.
- **Prior knowledge.** Expertise reversal effect: Kalyuga, Ayres, Chandler & Sweller (2003), *Educational Psychologist* 38. Hence the probe sets the entry rung and skips known rungs.
- **Names first.** Mayer's pre-training principle: learning improves when the names and characteristics of key concepts come first. Hence the `name` move and `symbols` with meanings.
- **Signalling.** Schneider, Beege, Nebel & Rey (2018), *Educational Research Review* 23 (103 studies): signalling helps retention and transfer, more for low prior knowledge. Hence colour-linked terms, the lantern accent and the "Look:" captions.
- **Narrative.** Dahlstrom (2014), *PNAS* 111 (Suppl. 4): narrative raises comprehension and engagement for non-experts. Hence the spine and the but/so chain.
Uncertainty: these are lab and classroom effects on average; none tested Lucid itself. The honest test is whether decks built with the probe and bridges beat decks without them for this learner, with the same topics.

## Token budget (measured)
`SKILL.md` ≈ 1.4k tokens (every time) · `probe.md` ≈ 1.1k (first turn) · `story.md` + `spec.md` ≈ 5k (build turn) · the example deck ≈ 4.1k tokens of YAML for 21 slides. The kit (≈ 190 KB) is never read by the agent. Build and check print one line per problem.

## Backlog
- Light ("dawn") theme and a `dusk` tint: tokens are ready, but each needs a palette validation and a full check run.
- Animated transitions between two states of the same chart (morphing marks), not just fades.
- Speaker notes / narration export, and an Obsidian companion note writer (the user's vault has an ingest script).
- Calc steps that follow sliders already recompute; tables do not yet take slider-driven rows.
- A tiny Python port of the expression language, so build-time lint can evaluate values (today it checks names and functions only; values are checked in the browser).
