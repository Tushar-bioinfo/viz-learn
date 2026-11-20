# Token cost of a class build: what wastes it, and what to do instead

Read this before you change what a building agent reads, how it checks, or how it looks. It records what the 17 Nov study measured, so the same waste does not come back. The rules the building agent follows live in `plugins/viz-os/skills/class/SKILL.md` (Token discipline); this file says why.

## How the cost works
- **Every call re-reads the whole context.** A cache read costs $0.20 per million tokens on Opus 5.5. New content is written to the cache once ($8/M for the 1-hour cache), and output costs $20/M.
- **So a page is paid for every call after it.** The lifetime cost of a tool result = tokens added × (write price + read price × later calls). A 10k-token file read at call 5 of a 90-call build costs about $0.25. Read at call 85, it costs $0.09.
- **Context size is the lever, not call count alone.** The 16 Nov contrastive run (desktop app, two requests in one chat) cost $11.00 over 99 calls at a mean context of 207k tokens, peak 288k. Two older lessons cost $4.84 (56 calls, mean 140k) and $4.72 (53 calls, mean 172k).
- **Measure, do not guess:** `python3 tools/session_cost.py <transcript.jsonl> --top 15` splits a session's cost by what each call did. Transcripts are in `~/.claude/projects/<folder>/`.

## Waste we found (W) and where it stands
| # | Waste | Evidence | Status |
|---|---|---|---|
| W1 | **Whole files read when one section was needed**: `board.md`, `adv.md`, deck `spec.md`, a whole example lesson | Shell reads were 31% of the $11.00 run; cold runs read `lint.md` and `spec.md` whole before any error | Fixed: `scripts/docs.py <file> <heading>`; SKILL.md says what to read whole and what by section |
| W2 | **A long shell output paid twice.** A `cat` over about 30k characters is cut and saved to a file, which the agent then reads again | $11.00 run, calls 1–4 | Fixed: one file per read, no `cat` of two skill files or of a file over 25 KB |
| W3 | **Hunting for a rule in code**: reading `lesson_lint.py` or `board.js` to find a word limit | cold runs grepped the lint for `SAY_WORDS` and others | Fixed: `lesson.py --limits` prints every limit from the lint's own constants |
| W4 | **A false or vague check message**: the agent wrote its own measuring script | formula-width warning fired on a formula that fitted, and did not say which formula | Fixed: the check measures the formula's real box and quotes its TeX |
| W5 | **An error that shows only in the browser**: build passes, check.py crashes or warns, a whole round is lost | slider `value` as a name crashed check.py; unknown names in table `col` fills | Partly fixed: `value` is linted. Open: `col` and some text fills (`docs/issues/class.md`) |
| W6 | **Context reset loses the brief**: after compaction the agent searched the old chat | $11.00 run, reset at call 43 | Fixed: the brief is saved to `lessons/<slug>/brief.md` and re-read |
| W7 | **The story counted twice**: a story passed as slash-command arguments enters context as the command text and as the skill's `ARGUMENTS:` | desktop runs | Not fixable in the skill. Put a long story in a file and name the file |
| W8 | **Long single-chat sessions**: the second lesson pays for the first lesson's whole context | the user's contrastive chat: about $6 after the first lesson, $11–12 after the second (the user's figures); the $11.00 run's mean context was 207k | Fixed in the skill: "one lesson per chat"; the reply ends with the line to start the next |
| W9 | **Re-writing large blocks**: a whole scene or file rewritten through a script to change one line | output tokens cost 100 times a cache read | Fixed: write once, edit small; never re-read your own `lesson.yaml` whole |
| W10 | **Harness baseline**: a desktop app session starts at 76–96k tokens, a CLI run at about 22k | first call of each run | Not in the skill's control. Use the CLI, or a workspace with few skills and connectors |

## The trade-off that went wrong once
The first fix also said "open the contact sheet once a round". The cold agents then opened 2 and 3 images instead of 8 and 14. One shipped a raw `==T cell:T cells==` on three scenes that a look would have caught. The images were cheap (under 5% of cost); the missed defect was not.
- **Keep the Eyes gate.** Look at every scene's still once, and again only after it changes.
- **Move a check into the lint instead of cutting a look.** The link-key fault is now a lint warning (case `link-spaced-key`).

## Good practice
**For the building agent** (already in SKILL.md; keep it there, not here):
- Read `lesson.md` whole; read the rest by section with `docs.py`; grep examples.
- Get limits from `lesson.py --limits` and message meanings from `lint.md` by grep.
- Write once, fix with small edits, check changed scenes with `check.py --slides`.
- Look at every scene once; reopen only what changed.

**For maintainers:**
- Before adding prose to a skill file, ask whether a lint or check can carry the rule. Prose in a long context is read once and forgotten.
- Make every check message name the item and the fix. A vague message costs a round of the agent measuring by itself.
- Catch at build time what you can: each fault that shows only in the browser costs a full build-check round.
- Keep skill files short and sectioned so `docs.py` can serve one part. A new big section needs a heading.
- After a change to what the agent reads, benchmark it on a cold run and compare with `session_cost.py`. Check quality too: lower cost with a missed defect is not a win.

**For the user:**
- Put a long story or outline in a file and point the request at it.
- One lesson per chat. Start the next lesson in a new chat with "next lesson".
- The CLI starts lighter than the desktop app (about 22k against 76–96k tokens).

## Benchmark, 17 Nov
Same prompt (InfoNCE on the learner's cells, one lesson, "just build"), Opus 5.5 medium, Claude CLI, fresh workspace each run.

| Plugin | Run | Cost | Calls | Mean context | Images opened | Gates |
|---|---|---|---|---|---|---|
| before (5.1.0) | base-1 | $3.57 | 42 | 130k | 8 | lint 0/0, check 0 |
| before (5.1.0) | base-2 | $4.00 | 44 | 135k | 14 | lint 0/0, check 0 |
| first fix ("look once a round") | after-1 | $2.95 | 35 | 94k | 2 | lint 0/0, check 0 |
| first fix ("look once a round") | after-2 | $2.59 | 38 | 85k | 3 | lint 0/0, check 0; raw link text shipped |
| final (look at every scene) | final-1 | $4.46 | 67 | 118k | 14 | lint 0/0, check 0; 12 scenes |
| final (look at every scene) | final-2 | $3.99 | 62 | 108k | 16 | lint 0/0, check 3 (scene 4, a kit bug); 11 scenes |

Gates were rerun on the repo plugin in `~/viz-os-bench/judge/` (images and check counts from `session_cost.py` and check.py output, 17 Nov).

**What the numbers say (two runs per arm, so read them as a direction, not a measure):**
- **Reading less works.** Context when the agent first writes `lesson.yaml` fell from 120–129k (before) to 76–79k (all four later runs). Cost per call fell from about $0.085 to $0.067.
- **Looking costs rounds, not images.** With every scene looked at, the final agents found and fixed more (final-1 made 33 small edits), so calls rose from 42–44 to 62–67 and output from 55–64k to 71–74k tokens. The lessons are fuller (11–12 scenes, more worked lines) than after-2's 10. Total cost came back to the before level: $4.23 mean against $3.79.
- **The next saving is in the fix loop.** Both final runs hit the same kit bug: a `product` worked line prints its scaled columns at 2 decimals whatever the `fmt`, so check.py reads it as ≈. final-2 spent about 8 check rounds on it and still failed. Each kit bug or browser-only error an agent cannot fix from the YAML costs rounds at full context. Fix those (`docs/issues/class.md`) before cutting reads further.
