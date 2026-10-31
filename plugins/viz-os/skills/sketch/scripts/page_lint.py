"""The rules of a sketch page (page.md). The teaching rules' numbers live in class/lesson_lint.py, so one fix reaches both."""
import re
from pathlib import Path

from lesson_lint import BEATS, CARDS, LINE_WORDS, SCENES, THINK_GAP, as_list, lint_cards, lint_controls, lint_order, lint_recall, lint_typed

SHEET = {"beat", "paper", "ratio", "width", "tall", "stop", "note", "figure", "label", "frames", "cols", "think", "more", "break", "alt"}
NOTE = {"shown": "what is shown", "read": "how to read it", "why": "why we do this", "changed": "what changed since the last sheet"}
PAPERS = ("cream", "graph", "navy")
FIGS = {"table", "matrix", "plot", "eqn", "calc", "assemble", "part", "code", "text"}
PARTS = {"cell": {"plain", "dividing", "dead"}, "nucleus": set(), "dna": {"open"}, "chromosome": {"single"}, "tissue": {"regions"}, "spots": {"empty", "captured"},
         "tube": {"empty", "filled"}, "plate": {"empty", "filled"}, "gene": {"on", "off"}, "read": {"short"}, "droplet": {"empty", "cell", "bead", "both"},
         "arrow": {"bent"}, "bracket": set(), "lens": set()}
SHUT = re.compile(r"\b(window|document|globalThis|fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|navigator|location|eval|Function|constructor|import|require|setTimeout|setInterval)\b")
QUOTED = re.compile(r"""(["'`])((?:\\.|(?!\1).)*)\1""")
NUMBER = re.compile(r"(?<![\w.#])\d+(?:\.\d+)?(?![\w])")
CUSTOM_LINES, CUSTOM_BLOCKS, CUSTOM_SHARE = 40, 3, .2
RATIO = re.compile(r"^\d+(\.\d+)?:\d+(\.\d+)?$")
CODE = re.compile(r"\b[A-Za-z]+_[A-Za-z0-9_]*\b|\b[a-z]+[A-Z][A-Za-z]*\b|\w\(\)|[=<>]{2}|\bdf\b|\bnp\.")   # pc_scores, pcScores, fit(), ==, np.
HIDE = re.compile(r"\{\{[\s\S]*?\}\}|\$[^$]*\$")
CHARS = set((Path(__file__).resolve().parent.parent / "kit" / "fonts" / "kevin-chars.txt").read_text(encoding="utf-8")) | {" "}
SAME = .8      # two answers sharing this much of their words say the same thing
THREADED = ("by-hand", "run")


def where(i, s):
    title = str(s.get("title") or "")[:38]
    return f"sheet {i + 1} ({s.get('beat', '?')}{' “' + title + '”' if title else ''})"


def sheet_names(s):
    """Names a sheet makes as it goes (worked lines), so `{{}}` in its text may use them."""
    out = set()
    for it in figures(s):
        for k in ("calc", "assemble", "eqn"):
            v = it.get(k)
            if isinstance(v, dict):
                out |= {x for x in (v.get("name"), v.get("lhs")) if x}
    return out


def figures(s):
    """Every figure item on a sheet, frames included."""
    for it in as_list(s.get("figure")):
        if isinstance(it, dict):
            yield it
    for f in as_list(s.get("frames")):
        if isinstance(f, dict):
            for it in as_list(f.get("add")):
                if isinstance(it, dict):
                    yield it


def thinks(s):
    """Think stops in reading order: the frames', then the sheet's."""
    out = [f["think"] for f in as_list(s.get("frames")) if isinstance(f, dict) and f.get("think")]
    return out + as_list(s.get("think"))


def words_of(x):
    return {w for w in re.findall(r"[a-z0-9]+", HIDE.sub(" ", str(x)).lower())}


def lettered(s):
    """(field, text) for everything drawn in Kevin Sans."""
    if isinstance(s.get("title"), str):
        yield "title", s["title"]
    st = s.get("stop")
    if isinstance(st, dict):
        for k in ("say", "shape"):
            if isinstance(st.get(k), str):
                yield f"stop {k}", st[k]
    for lb in as_list(s.get("label")):
        if isinstance(lb, dict) and isinstance(lb.get("say"), str):
            yield "label", lb["say"]
    for it in figures(s):
        for k in ("name", "title"):
            if isinstance(it.get(k), str):
                yield f"figure {k}", it[k]


def lint_sheet(B, Lx, i, s, first):
    w = where(i, s)
    if s.get("beat") not in BEATS:
        Lx.err(w, f"beat `{s.get('beat')}` is not one of: {', '.join(sorted(BEATS | {'review'}))}")
    if s.get("paper") is not None and s.get("paper") not in PAPERS:
        Lx.err(w, f"paper `{s['paper']}` is not one of: {', '.join(PAPERS)}")
    if s.get("ratio") is not None and not RATIO.match(str(s["ratio"])):
        Lx.err(w, f"ratio `{s['ratio']}`: write width:height in quotes, like \"16:7\"")
    if s.get("width") is not None and not (isinstance(s["width"], (int, float)) and 40 <= s["width"] <= 100):
        Lx.err(w, f"width `{s['width']}`: give a percent of the full sheet, from 40 to 100")
    note = s.get("note") if isinstance(s.get("note"), dict) else {}
    for k in set(note) - set(NOTE):
        Lx.err(w, f"note `{k}` is not one of: {', '.join(NOTE)}")
    for k, ask in NOTE.items():
        if k == "changed" and first:
            continue
        if not note.get(k):
            Lx.err(w, f"no `note.{k}`: every sheet answers {ask}")
        elif B.words(note[k]) > LINE_WORDS:
            Lx.err(w, f"`note.{k}` has {B.words(note[k])} words (≤ {LINE_WORDS}): one short answer; move the rest to `more`")
    ks = [k for k in NOTE if note.get(k)]
    for a in range(len(ks)):
        for b in range(a + 1, len(ks)):
            x, y = words_of(note[ks[a]]), words_of(note[ks[b]])
            if x and y and len(x & y) / len(x | y) >= SAME:
                Lx.warn(w, f"`note.{ks[a]}` and `note.{ks[b]}` say the same thing: each answers its own question")
    for name, text in lettered(s):
        bad = sorted(set(HIDE.sub("", text)) - CHARS)
        if bad:
            Lx.err(w, f"{name} “{text[:30]}” has {' '.join(bad)}, which the lettering font lacks: write the symbol as maths, in $...$, or use a word")
    st = s.get("stop")
    if st is not None and not (isinstance(st, dict) and st.get("say")):
        Lx.err(w, "`stop` needs `say`: what the reader sees at this stop")
    if isinstance(st, dict):
        for k in ("say", "shape"):
            m = CODE.search(HIDE.sub(" ", str(st.get(k) or "")))
            if m:
                Lx.err(w, f"stop {k} reads like code (“{m.group(0)}”): write what the reader sees, not a variable name")
    if s.get("beat") in THREADED and not st:
        Lx.warn(w, "no `stop`: the gold thread carries the data through every method sheet, so say what the data looks like here")
    for j, f in enumerate(as_list(s.get("frames"))):
        if not isinstance(f, dict) or not f.get("say"):
            Lx.err(w, f"frame {j + 1} needs `say`: one line on what this frame adds")
        elif B.words(f["say"]) > LINE_WORDS:
            Lx.err(w, f"frame {j + 1} `say` has {B.words(f['say'])} words (≤ {LINE_WORDS})")
    for t in thinks(s):
        if not isinstance(t, dict) or not t.get("q") or not t.get("a"):
            Lx.err(w, "a think stop needs `q` and `a`")
            continue
        for k in ("q", "a"):
            if B.words(t[k]) > LINE_WORDS:
                Lx.err(w, f"think `{k}` has {B.words(t[k])} words (≤ {LINE_WORDS})")
    for k, m in enumerate(as_list(s.get("more"))):
        if not (isinstance(m, dict) and m.get("ask") and m.get("answer")):
            Lx.err(w, f"fold-out {k + 1} needs `ask` and `answer`")
    b = s.get("break")
    if b is not None and not (isinstance(b, dict) and b.get("rule") and b.get("path")):
        Lx.err(w, "`break` needs `rule` (the broken rule, as a sentence) and `path` (the shortest way to reach it)")
    a = s.get("alt")
    if a is not None and not (isinstance(a, dict) and a.get("say")):
        Lx.err(w, "`alt` needs `say`: the other path, in the reader's words")
    if (b or a) and not st:
        Lx.err(w, "a branch leaves the thread at a stop: give this sheet a `stop`")
    if b and a:
        Lx.err(w, "one branch per sheet: move the `alt` to another sheet")
    for lb in as_list(s.get("label")):
        if not (isinstance(lb, dict) and lb.get("on") and lb.get("say")):
            Lx.err(w, "a label needs `on` (the named part it attaches to) and `say`")
    if not any(True for _ in figures(s)):
        Lx.warn(w, "no figure: every sheet carries a drawing; words alone belong in a fold-out")
    for it in figures(s):
        kinds = sorted(set(it) & FIGS)
        if len(kinds) != 1:
            Lx.err(w, f"a figure needs one of {', '.join(sorted(FIGS - {'code'} | {'draw'}))}; this one has {kinds or 'none'}: {str(it)[:60]}")
        if "part" in it:
            if it["part"] not in PARTS:
                Lx.err(w, f"no part `{it['part']}`; the box has: {', '.join(PARTS)}")
            elif it.get("state") is not None and it["state"] not in PARTS[it["part"]]:
                Lx.err(w, f"part `{it['part']}` has no state `{it['state']}`; it has: {', '.join(sorted(PARTS[it['part']])) or 'none'}")


def lint_shape(Lx, deck, slides):
    """The beats a page must have, the think stops, the red branch."""
    sheets = [(i, s) for i, s in enumerate(slides) if s.get("type") == "sheet"]
    if not sheets:
        Lx.err("page", "no sheets: write `sheets:`")
        return
    lo, hi = SCENES
    if not lo <= len(sheets) <= hi:
        Lx.warn("page", f"{len(sheets)} sheets; a page is {lo}–{hi}: " + ("split it into a What / How / Why series" if len(sheets) > hi else "add the beats it is missing"))
    beats = [s.get("beat") for _, s in sheets]
    if beats[0] != "plan":
        Lx.err(where(*sheets[0]), "the first sheet is a `plan` sheet: say what we will do, in order")
    for b, why in (("limits", "show where the method breaks"), ("next", "tease the next question")):
        if b not in beats:
            Lx.err("page", f"no `{b}` sheet: {why}")
    if "limits" in beats and "next" in beats and len(beats) - 1 - beats[::-1].index("limits") > beats.index("next"):
        Lx.warn("page", "the `limits` sheet comes after `next`: limits go before the tease")
    if "summary" not in beats:
        Lx.warn("page", "no `summary` sheet: before the tease, answer the opening question")
    if not any(s.get("break") for _, s in sheets):
        Lx.err("page", "no red branch: every page shows at least one place the method breaks (`break:` on a sheet)")
    last = slides[-1]
    if last.get("type") != "quiz":
        Lx.err("page", f"end with the review cards: a last sheet `beat: review` with {CARDS[0]}–{CARDS[1]} `cards`")
    elif not CARDS[0] <= len(as_list(last.get("cards"))) <= CARDS[1]:
        Lx.warn("page", f"{len(as_list(last.get('cards')))} review cards; use {CARDS[0]}–{CARDS[1]}")
    gap = 0
    for i, s in enumerate(slides):
        if s.get("type") == "quiz":
            gap = 0
            continue
        frames = [f for f in as_list(s.get("frames")) if isinstance(f, dict)] or [s]
        for j, f in enumerate(frames):
            gap = 0 if f.get("think") else gap + 1
            if gap >= THINK_GAP:
                Lx.err(where(i, s) + (f" frame {j + 1}" if f is not s else ""), f"{THINK_GAP} frames or sheets in a row with no think stop: ask the learner something before going on")
                gap = 0
        if s.get("think"):
            gap = 0


def as_board(s):
    """A sheet in the class lint's terms: the order numbers and symbols show in is one rule, so it reads the sheet as a board."""
    if s.get("type") != "sheet":
        return s
    add = lambda items: [x for x in as_list(items) if isinstance(x, dict)]
    frames = [f for f in as_list(s.get("frames")) if isinstance(f, dict)]
    note = s.get("note") if isinstance(s.get("note"), dict) else {}
    steps = [{"say": " ".join(str(v) for v in note.values()), "add": add(s.get("figure")) + add(s.get("label"))}]
    steps += [{"say": f.get("say"), "add": add(f.get("add")), **({"think": f["think"]} if f.get("think") else {})} for f in frames]
    if isinstance(s.get("think"), dict):
        steps.append({"think": s["think"]})
    tb = next((x["table"] for x in figures(s) if isinstance(x.get("table"), dict)), None)
    return {"type": "board", "beat": s.get("beat"), "title": s.get("title"), "lead": s.get("lead"), "table": tb, "steps": steps}


def as_prose(s):
    """A sheet as one list of learner's text, for the typed-number rule."""
    if s.get("type") != "sheet":
        return s
    strs = []
    def walk(n, key=None):
        if isinstance(n, dict):
            for k, v in n.items():
                if k not in ("at", "width", "on", "paper", "ratio", "beat", "type", "from", "x", "y", "tex", "expr", "cols", "rows", "mark", "layers", "lhs", "name", "use", "part", "plug", "code", "fmt", "derive", "controls", "state", "color", "other", "values", "scale", "rotate"):
                    walk(v, k)
        elif isinstance(n, list):
            for v in n:
                walk(v, key)
        elif isinstance(n, str):
            strs.append(n)
    walk({k: v for k, v in s.items() if k != "title"})
    return {"type": "sheet", "title": s.get("title"), "text": strs}


def flat_numbers(name, v):
    """(path, value) for every number in the data."""
    if isinstance(v, bool):
        return
    if isinstance(v, (int, float)):
        yield name, v
    elif isinstance(v, list):
        for i, x in enumerate(v):
            yield from flat_numbers(f"{name}[{i}]", x)
    elif isinstance(v, dict):
        for k, x in v.items():
            yield from flat_numbers(f"{name}.{k}", x)


def lint_custom(Lx, deck, data, sheets, size):
    """A custom drawing gets pens, scales and data, and nothing else: no browser, no network, no typed numbers."""
    pool = [x for src in (deck.get("data") or {}, data) for k, v in src.items() for x in flat_numbers(k, v)]
    blocks = 0
    for i, s in sheets:
        w = where(i, s)
        for it in figures(s):
            code = it.get("code")
            if not isinstance(code, str):
                continue
            blocks += 1
            lines = len([ln for ln in code.splitlines() if ln.strip()])
            if lines > CUSTOM_LINES:
                Lx.err(w, f"custom drawing has {lines} lines (≤ {CUSTOM_LINES}): use the parts, or split it")
            for m in sorted(set(SHUT.findall(code))):
                Lx.err(w, f"custom drawing uses `{m}`: a drawing gets pens, scales and data, and nothing else")
            for _, text in QUOTED.findall(code):
                for ch in sorted(set(HIDE.sub("", text)) - CHARS):
                    Lx.err(w, f"custom drawing text “{text[:30]}” has {ch}, which the lettering font lacks: write the symbol as maths, in $...$")
                for n in NUMBER.findall(HIDE.sub(" ", text)):
                    hit = next((k for k, v in pool if f"{v:.{len(n.partition('.')[2])}f}" == n), None)
                    Lx.err(w, f"custom drawing types the number {n}" + (f": that is `{hit}`; read it from `data` and print it with `fmt`" if hit else ": compute it and print it with `fmt`"))
    if blocks > CUSTOM_BLOCKS:
        Lx.warn("page", f"{blocks} custom drawings (≤ {CUSTOM_BLOCKS}): a page should mostly compose parts")
    used = sum(len(it["code"]) for _, s in sheets for it in figures(s) if isinstance(it.get("code"), str))
    if size and used / size > CUSTOM_SHARE:
        Lx.warn("page", f"custom drawing is {used / size:.0%} of the page's words (≤ {CUSTOM_SHARE:.0%}): a page should mostly compose parts")


def make_lint(B, data, state):
    def page_rules(Lx, deck, glob):
        Lx.out[:] = [x for x in Lx.out if "no `recap` near the end" not in x[2] and "start with a `title` slide" not in x[2]]   # a page's first and last sheets have their own rules, below
        if not deck.get("goal"):
            Lx.err("page", "no `goal`: say at the top what the page is for; each sheet's `why` ties back to it")
        slides = [s for s in deck.get("slides") or [] if isinstance(s, dict)]
        sheets = [(i, s) for i, s in enumerate(slides) if s.get("type") == "sheet"]
        if state.get("raw_slides"):
            Lx.err("page", "a page has `sheets:`, not `slides:`")
        for k, (i, s) in enumerate(sheets):
            lint_sheet(B, Lx, i, s, k == 0)
            lint_controls(Lx, where(i, s), s, [])
        lint_shape(Lx, deck, slides)
        own = [s if s is not state.get("slide") else {"type": "quiz"} for s in slides]
        lint_order(B, Lx, {**deck, "slides": [as_board(s) for s in own]})
        lint_typed(Lx, {**deck, "slides": [as_prose(s) for s in own]}, data)
        lint_cards(B, Lx, deck, data)
        lint_recall(Lx, deck, state)
        lint_custom(Lx, deck, data, sheets, state.get("size"))
        # the deck's and class's rules say "slide N (type"; here that is a sheet
        Lx.out[:] = [(lvl, re.sub(r"^slide (\d+) \((?:sheet|board|quiz) ?", r"sheet \1 (", w), msg) for lvl, w, msg in Lx.out]
    return page_rules
