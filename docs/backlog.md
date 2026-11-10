# Backlog

Open work is indexed below; each detail file keeps the original source labels and numbers. For planned changes and their approval loops use [todo-draw-math.md](todo-draw-math.md) or [c10-visuals.md](c10-visuals.md). This index does not authorize starting a release or a live plan block.

## Update workflow

`tools/update.py` now automates pinned release checks, scoped publication and supported installation updates. Personal update targets include Grok and exclude Cursor at the user's request. Fresh T3 model loading remains a separate runtime check. The installer reports that qualification rather than claiming runtime discovery. Live mutation paths have fixture coverage; the new adapters have not yet been exercised on a new live release.

## Open issues by task
| Task | Read only this detail file |
|---|---|
| Class teaching, board layout, controls, symbol lints, learner memory and resizing | [issues/class.md](issues/class.md) |
| Deck/shared arithmetic, chart marks, number audits and longer-term ideas | [issues/deck.md](issues/deck.md) |
| Sketch parts, anchors, page size, facts/quotes and misleading biology pictures | [issues/sketch.md](issues/sketch.md) |

## Harness follow-up
40. **Harness: `muse plugins marketplace update` reports success but keeps the old snapshot** (2.0.0 stayed after 2.1.0 was pushed; `install` then says "already installed from a different source"). Seen again on 2.1.0 → 2.1.1. Fix used both times: `muse plugins remove viz-os`, `marketplace remove viz-learn`, `marketplace add …`, `install viz-os@viz-learn`.

## Recording and history
Add a problem to its detail file with its trigger and evidence. Keep the source label with an old number: board/Moran 1–8 and learner/scroll 78–79 overlap. When fixed, move its record to the archive and add a changelog line for a shipped fix; keep any unresolved follow-up live.

[archive/README.md](archive/README.md) indexes original wording, fixed records and past test results. Scroll 84/85 are closed by 88; partial fixes Sketch 46/55 still have class follow-ups. Unconfirmed reports are kept as unconfirmed in history.
