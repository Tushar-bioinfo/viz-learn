"""The lesson lint: the rules a viz-os class lesson keeps on top of the deck's own (lesson.md has the why).

lesson.py runs it through the deck build's lint hook. Scene rules check each board on its own; whole-lesson rules check
the beats in order, that every symbol shows after its number, that numbers are computed, and the review cards.
"""
import re

# beats a scene can carry (lesson.md); the last four are optional moves
BEATS = {"plan", "problem", "data", "by-hand", "picture", "formula", "run", "what-if", "limits", "summary", "next",
         "analogy", "compare", "misconception", "aside"}
STEP = {"say", "add", "mark", "think", "frame"}
# deck visuals placed in the picture column as they are
VIS = {"chart", "image", "dist", "stat", "units", "parts", "flow"}
ITEMS = {"calc", "plane", "note", "col", "params", "eqn", "assemble", "compare", "ops"} | VIS
# the fields each text item takes; anything else is usually a comma inside an unquoted `{ }` value that split it
FIELDS = {"calc": {"say", "why", "row", "expr", "name", "fmt", "id"}, "col": {"key", "label", "expr", "fmt"},
          "eqn": {"say", "lhs", "expr", "tex", "id"}, "assemble": {"say", "lhs", "expr", "tex", "plug", "fmt", "id"},
          "params": {"say", "names", "side", "id"}}
TERM = re.compile(r"\[([A-Za-z_]\w*)\]")
TAGGED = re.compile(r"\[([A-Za-z_]\w*):([^\]]*)\]")
# what a step can light for one click: a table row, column or cell (rows count from 0, as in at()), or an item by id
MARK = re.compile(r"^(row:\d+|col:.+|cell:\d+:.+|#.+)$")


def as_list(x):
    return x if isinstance(x, list) else [] if x is None else [x]


def items_of(s):
    """Every item a board scene adds, in order, with the step that adds it."""
    for st in as_list(s.get("steps")):
        if isinstance(st, dict):
            for it in as_list(st.get("add")):
                if isinstance(it, dict):
                    yield st, it


def lint_controls(Lx, where, s, steps):
    """A run (frames you can scrub or play) and a toggle (two states), and the `frame:` a step sets."""
    runs = []
    for c in s.get("controls") or []:
        if not isinstance(c, dict):
            continue
        if "run" in c:
            if not isinstance(c["run"], int) or c["run"] < 2:
                Lx.err(where, f"control `{c.get('name')}`: `run` is the number of frames, a whole number of 2 or more")
                continue
            runs.append(c)
            bad = [f for f in as_list(c.get("stops")) if not isinstance(f, int) or not 0 <= f < c["run"]]
            if bad:
                Lx.err(where, f"control `{c.get('name')}`: stops {bad} are not frames 0..{c['run'] - 1}")
            if c.get("every") is not None and not (isinstance(c["every"], (int, float)) and 0.3 <= c["every"] <= 10):
                Lx.err(where, f"control `{c.get('name')}`: `every` is seconds per frame when playing, 0.3 to 10")
        if "toggle" in c and not (isinstance(c["toggle"], list) and len(c["toggle"]) == 2 and all(isinstance(x, str) for x in c["toggle"])):
            Lx.err(where, f"control `{c.get('name')}`: `toggle` is two labels, [off, on]: the name is 0 for the first and 1 for the second")
    if len(runs) > 1:
        Lx.err(where, "one run per scene: the clicks stop on its frames, so two would fight")
    framed = [st for st in steps if isinstance(st, dict) and "frame" in st]
    if framed and not runs:
        Lx.err(where, "a step sets `frame:` but the scene has no run control (`controls: [{name: t, run: 12}]`)")
    if runs:
        n = runs[0]["run"]
        for st in framed:
            if not isinstance(st["frame"], int) or not 0 <= st["frame"] < n:
                Lx.err(where, f"`frame: {st['frame']!r}` is not a frame of the run (0..{n - 1})")
        if not framed and len(steps) < len(as_list(runs[0].get("stops"))):
            Lx.err(where, f"the run stops on {len(as_list(runs[0].get('stops')))} frames, one per click, but the scene has {len(steps)} steps: add steps or give each its `frame:`")


# plane marks: what each takes (numbers or expressions; a point is [x, y])
PLANE = {"points": "{from, x, y, by, label, colors}", "shade": "[w0, w1, w2]", "line": "[w0, w1, w2]", "point": "[x, y]",
         "segment": "[[x1, y1], [x2, y2]]", "vector": "[dx, dy] (and from: [x, y])", "foot": "{from: [x, y], line: [w0, w1, w2]} or {from, dir: [dx, dy]}",
         "square": "[[x1, y1], [x2, y2]]", "text": "a label (and at: [x, y])", "ring": "[x, y]"}


def lint_plane(B, Lx, w, pl, names):
    """Each mark is one kind, with the right number of values, and every value is an expression the page can work out."""
    if not isinstance(pl, dict):
        Lx.err(w, "`plane` is a mapping with `x`, `y` and `marks`")
        return
    def ex(v):
        B.check_expr(Lx, w + " plane", v, names)

    def pts(v, n, what):
        if not isinstance(v, list) or len(v) != n:
            Lx.err(w, f"plane `{what}` takes {n} values, got {v!r}: quote an expression that has a comma in it ('at(xs, t)')")
            return
        for x in v:
            ex(x)
    for ax in ("x", "y"):
        for k in ("min", "max"):
            ex(((pl.get(ax) or {}) if isinstance(pl.get(ax), dict) else {}).get(k))
    for i, mk in enumerate(as_list(pl.get("marks"))):
        kind = [k for k in PLANE if isinstance(mk, dict) and k in mk]
        if len(kind) != 1:
            Lx.err(w, f"plane mark {i + 1} is one of {', '.join(PLANE)}; got {mk!r}")
            continue
        k, v = kind[0], mk[kind[0]]
        if mk.get("when") is not None:
            ex(mk["when"])
        if k in ("shade", "line"):
            pts(v, 3, k)
        elif k in ("point", "ring", "vector"):
            pts(v, 2, k)
            if k == "vector" and mk.get("from") is not None:
                pts(mk["from"], 2, "vector from")
        elif k in ("segment", "square"):
            if not isinstance(v, list) or len(v) != 2:
                Lx.err(w, f"plane `{k}` takes two points, {PLANE[k]}")
            else:
                for q in v:
                    pts(q, 2, k)
        elif k == "foot":
            if not isinstance(v, dict) or "from" not in v or ("line" in v) == ("dir" in v):
                Lx.err(w, f"plane `foot` takes {PLANE['foot']}")
            else:
                pts(v["from"], 2, "foot from")
                pts(v["line"], 3, "foot line") if "line" in v else pts(v["dir"], 2, "foot dir")
        elif k == "text":
            pts(mk.get("at"), 2, "text at")
        elif k == "points":
            if not isinstance(v, dict) or not all(v.get(q) for q in ("from", "x", "y")):
                Lx.err(w, f"plane `points` takes {PLANE['points']}")
            else:
                ex(v["from"])


def lint_formula(B, Lx, w, f, kind, names, symbols):
    """An `eqn` or `assemble`: an expression, or TeX with [name] terms (and, for assemble, a `plug` of tagged numbers)."""
    if f is None:
        return
    if not isinstance(f, dict) or not (f.get("expr") or f.get("tex")):
        Lx.err(w, f"`{kind}` needs `expr` (computed) or `tex` with [name] terms")
        return
    if f.get("expr"):
        B.check_expr(Lx, w, f["expr"], names)
        return
    terms = TERM.findall(str(f["tex"]))
    for n in terms:
        if not (isinstance(symbols.get(n), dict) and symbols[n].get("says")):
            Lx.err(w, f"`{kind}` term [{n}] has no meaning: add `{n}: {{tex: ..., says: ...}}` under symbols")
    if len(set(terms)) > 5:
        Lx.warn(w, f"{len(set(terms))} terms: more than 5 is a wall; build the formula over two scenes")
    if kind != "assemble":
        return
    plug = f.get("plug")
    if not plug:
        Lx.err(w, "an `assemble` with `tex` needs `plug`: the same formula with our numbers, each tagged [name:number]")
        return
    for n, _ in TAGGED.findall(str(plug)):
        if n not in terms and n != f.get("lhs"):
            Lx.warn(w, f"plug tag [{n}:…] names no [{n}] term in `tex` (nor the `lhs`): tag each number with the term it stands for")
    rest = TERM.sub("", TAGGED.sub("", str(plug)))
    if "{{" in rest or re.search(r"(?<![\\\w])\d+\.\d+", rest):
        Lx.warn(w, "a number in `plug` has no tag: write it as [name:number] so it takes its term's colour and the lint knows which worked number it is")


def lint_scenes(B, Lx, deck, glob):
    """Each board scene on its own: its fields, steps, items and controls."""
    symbols = deck.get("symbols") or {}
    for i, s in enumerate(deck.get("slides") or []):
        if s.get("type") != "board":
            continue
        where = f"slide {i + 1} (board “{str(s.get('title') or '')[:38]}”)"
        if s.get("beat") not in BEATS:
            Lx.err(where, f"`beat` is {s.get('beat')!r}; use one of {', '.join(sorted(BEATS))}")
        names = set(glob) | {c.get("name") for c in s.get("controls") or [] if isinstance(c, dict)}
        names |= set(s.get("derive") or {}) if isinstance(s.get("derive"), dict) else set()
        tb = s.get("table")
        tkeys = {c if isinstance(c, str) else c.get("key") for c in as_list((tb or {}).get("cols")) if isinstance(c, (str, dict))} if isinstance(tb, dict) else set()
        tkeys |= {it["col"].get("key") for _, it in items_of(s) if isinstance(it.get("col"), dict)}
        if tb is not None:
            if not isinstance(tb, dict) or not tb.get("from"):
                Lx.err(where, "`table` needs `from:` (a data name holding the rows) and `cols:`")
            elif isinstance(tb.get("from"), str):
                B.check_expr(Lx, f"{where} table", tb["from"], names)
        steps = as_list(s.get("steps"))
        if not steps:
            Lx.err(where, "a board needs `steps`: one teacher line per click")
        lint_controls(Lx, where, s, steps)
        if s.get("beat") == "what-if" and not any(k in it for _, it in items_of(s) if isinstance(it, dict) for k in ("chart", "plane", "compare", "image")):
            Lx.warn(where, "a what-if scene with no picture: add a `chart` or `plane` that the change moves, so the learner sees what moves")
        for j, st in enumerate(steps):
            w = f"{where} step {j + 1}"
            if not isinstance(st, dict):
                Lx.err(w, "each step is a mapping with `say` (and `add`, `mark` or `think`)")
                continue
            for k in set(st) - STEP:
                Lx.err(w, f"unknown step field `{k}` (use {', '.join(sorted(STEP))})")
            if not st.get("say") and not st.get("think"):
                Lx.err(w, "a step needs `say`: the teacher's one line for this click")
            for it in as_list(st.get("add")):
                kind = [k for k in it if k in ITEMS] if isinstance(it, dict) else []
                if len(kind) != 1:
                    Lx.err(w, f"each added item is one of {', '.join(sorted(ITEMS))}; got {it!r}")
                    continue
                body = it[kind[0]]
                if kind[0] in FIELDS and isinstance(body, dict):
                    for k in sorted(set(body) - FIELDS[kind[0]], key=str):
                        Lx.err(w, f"`{kind[0]}` has no field `{k}` (it takes {', '.join(sorted(FIELDS[kind[0]]))}); "
                                  "a comma inside an unquoted `{ }` value splits it: quote the value")
                pr = it.get("params")
                if pr is not None:
                    if not isinstance(pr, dict) or not as_list(pr.get("names")):
                        Lx.err(w, "`params` needs `names:` (the numbers to show, each a name in data or symbols)")
                    else:
                        for nm in as_list(pr["names"]):
                            if nm not in names and nm not in symbols:
                                Lx.err(w, f"`params` name `{nm}` is not in data, derive or the worked lines so far")
                if "plane" in it:
                    lint_plane(B, Lx, w, it["plane"], names)
                if VIS & set(it):
                    B.lint_visual(Lx, w, {x: y for x, y in it.items() if x != "id"}, names)
                lint_formula(B, Lx, w, it.get("eqn"), "eqn", names, symbols)
                a = it.get("assemble")
                if a is not None:
                    lint_formula(B, Lx, w, a, "assemble", names, symbols)
                    if j == len(steps) - 1:
                        Lx.err(w, "`assemble` shows its symbols row on the next click: add a step after it that says what the symbols are")
                    if isinstance(a, dict) and a.get("lhs"):
                        names.add(a["lhs"])
                cp = it.get("compare")
                if cp is not None:
                    if not isinstance(cp, dict) or not all(isinstance(cp.get(k), dict) and cp[k].get("title") for k in "ab"):
                        Lx.err(w, "`compare` needs `a:` and `b:`, each with a `title` (and `text`, `tone`, `visual` as on a deck compare slide)")
                    else:
                        for k in "ab":
                            if isinstance(cp[k].get("visual"), dict):
                                B.lint_visual(Lx, f"{w} compare {k}", cp[k]["visual"], names)
                op = it.get("ops")
                if op is not None:
                    if not isinstance(op, dict):
                        Lx.err(w, "`ops` is a mapping with `matrix:` and `steps:`, as on a deck ops slide")
                    else:
                        names |= B.lint_ops(Lx, f"{w} ops", op, names, {})
                        need = len(as_list(op.get("steps")))
                        if j + need >= len(steps):
                            Lx.err(w, f"`ops` has {need} steps and each one takes the next click: add {j + need + 1 - len(steps)} more board step(s) after it, one teacher line per matrix step")
                c = it.get("calc")
                if isinstance(c, dict):
                    row = c.get("row")
                    if row is not None and (not isinstance(row, int) or not tb):
                        Lx.err(w, "a `calc` with `row:` reads that row of the scene's table: give a row number (from 0) and a `table`")
                    if not c.get("expr"):
                        Lx.err(w, "a `calc` needs `expr` (computed from the data)")
                    else:
                        B.check_expr(Lx, w, c["expr"], names | (tkeys if row is not None else set()))
                    if c.get("name"):
                        names.add(c["name"])
            for mark in as_list(st.get("mark")):
                if not isinstance(mark, str) or not MARK.match(mark):
                    Lx.err(w, f"`mark: {mark!r}` is not a target: use row:<i>, col:<key>, cell:<i>:<key> or #<id> (rows count from 0)")




# ---- whole-lesson rules (lesson.md): the shape, the order numbers and symbols show in, typed numbers, and the cards

EXEMPT = ("operator", "index")   # a symbol of this `kind` has no number to show first
LINE_WORDS = 24                  # one teacher line, one breath
STEP_CAP, THINK_GAP = 10, 6      # steps in one scene; steps in a row with no think stop
SCENES = (8, 14)
CARDS = (5, 8)
# keys whose text the learner reads; a number typed here goes stale when the data changes
PROSE = {"say", "q", "a", "text", "note", "title", "lead", "subtitle", "question", "answer", "caption", "label", "sub",
         "value", "alt", "points", "breaks", "why", "read", "more", "verdict", "next"}
TYPED = re.compile(r"(?<![\w.])([-−]?)(\d+\.\d+|\d{2,})(?![\w]|\.\d)")
HIDE = re.compile(r"\{\{[\s\S]*?\}\}|\$[^$]*\$|`[^`]*`")
EXPRS = re.compile(r"\{\{([\s\S]+?)\}\}")
FMT = re.compile(r"\|\s*(\d+|s\d+|%\d*|e\d*|,|int)\s*$")


def beat_of(s):
    t = s.get("type") or "idea"
    return s.get("beat") if t == "board" else {"recap": "summary", "bridge": "analogy"}.get(t)


def at(i, j=0):
    return f"slide {i + 1} step {j + 1}"


def slide_where(i, s):
    t = s.get("type") or "idea"
    title = str(s.get("title") or s.get("q") or s.get("text") or "")[:38]
    return f"slide {i + 1} ({t}{' “' + title + '”' if title else ''})"


def lint_shape(B, Lx, slides):
    """R1, R2, R6 and the lead rule: the beats in order, the size of the lesson, and a think stop every few steps."""
    scenes = [(i, s, beat_of(s)) for i, s in enumerate(slides) if (s.get("type") or "idea") not in ("title", "quiz")]
    if not scenes:
        return
    lo, hi = SCENES
    if not lo <= len(scenes) <= hi:
        Lx.warn("lesson", f"{len(scenes)} scenes; a lesson is {lo}–{hi}, not counting the title and quizzes: "
                + ("split it into a What / How / Why series" if len(scenes) > hi else "add the beats it is missing (plan, problem, by-hand, formula, limits, summary, next)"))
    beats = [b for _, _, b in scenes]
    i0, s0, b0 = scenes[0]
    if b0 != "plan":
        Lx.warn(slide_where(i0, s0), "the first scene after the title (and any recall quiz) is a `plan` scene: say what we will do, in order")
    first = lambda b: next((k for k, x in enumerate(beats) if x == b), None)
    fo, pr, nx = first("formula"), first("problem"), first("next")
    if fo is not None and (pr is None or pr > fo):
        Lx.warn(slide_where(*scenes[fo][:2]), "a formula scene before any `problem` scene: show the problem the formula answers first")
    lim = [k for k, x in enumerate(beats) if x == "limits"]
    if not lim:
        Lx.warn("lesson", "no `limits` scene: before the next-lesson tease, show where the method breaks or what it assumes")
    elif nx is not None and lim[-1] > nx:
        Lx.warn(slide_where(*scenes[lim[-1]][:2]), "the `limits` scene comes after `next`: limits go before the tease")
    if "summary" not in beats:
        Lx.warn("lesson", "no `summary` scene: before the tease, answer the opening question on a `recap` slide")
    if nx is None:
        Lx.warn("lesson", "no `next` scene: after the summary, tease the next lesson's question in one scene")
    else:
        i = scenes[nx][0]
        for k, s in enumerate(slides[i + 1:], i + 1):
            if (s.get("type") or "idea") != "quiz":
                Lx.warn(slide_where(k, s), "after the `next` tease only the review cards follow: move this slide before it")
    last = slides[-1]
    if (last.get("type") or "idea") != "quiz":
        Lx.warn("lesson", f"end with the review cards: one `quiz` slide of {CARDS[0]}–{CARDS[1]} cards")
    elif not CARDS[0] <= len(as_list(last.get("cards"))) <= CARDS[1]:
        nc = len(as_list(last.get("cards")))
        Lx.warn(slide_where(len(slides) - 1, last), f"{nc} review card{'s' if nc != 1 else ''}; use {CARDS[0]}–{CARDS[1]}, one at least from an angle the lesson did not take")
    gap, planned = 0, False
    for i, s in enumerate(slides):
        t = s.get("type") or "idea"
        if t == "quiz":
            gap = 0
        if t != "board":
            continue
        w = slide_where(i, s)
        if planned and not s.get("lead"):
            Lx.warn(w, "no `lead`: one short line that links this scene to the last")
        planned = planned or s.get("beat") == "plan"
        steps = as_list(s.get("steps"))
        if len(steps) > STEP_CAP:
            Lx.warn(w, f"{len(steps)} steps (≤ {STEP_CAP}): a full board must fit the stage, so split the scene in two")
        for j, st in enumerate(steps):
            if not isinstance(st, dict):
                continue
            gap = 0 if st.get("think") else gap + 1
            if gap >= THINK_GAP:
                Lx.warn(f"{w} step {j + 1}", f"{THINK_GAP} steps in a row with no `think` stop: ask the learner something before going on")
                gap = 0
            lines = [("say", st.get("say"))]
            if isinstance(st.get("think"), dict):
                lines += [("think q", st["think"].get("q")), ("think a", st["think"].get("a"))]
            for k, v in lines:
                if isinstance(v, str) and B.words(v) > LINE_WORDS:
                    Lx.warn(f"{w} step {j + 1}", f"`{k}` has {B.words(v)} words (≤ {LINE_WORDS}): one teacher line is one breath; move the rest to the next step")


def prose(node, key=None):
    """(key, text) for every string the learner reads in a slide or item."""
    if isinstance(node, dict):
        for k, v in node.items():
            yield from prose(v, k)
    elif isinstance(node, list):
        for v in node:
            yield from prose(v, key)
    elif isinstance(node, str) and key in PROSE:
        yield key, node


def expr_names(B, text):
    return [n for x in EXPRS.findall(text) for n in B.idents(FMT.sub("", x))]


class Ledger:
    """R5: where each name's number first shows and where its symbol first shows, in click order."""

    def __init__(self, B, symbols):
        self.B, self.symbols = B, symbols
        self.num, self.sym, self.hand = {}, {}, set()
        tex = [(n, str(v.get("tex"))) for n, v in symbols.items() if isinstance(v, dict) and v.get("tex") and v.get("kind") not in EXEMPT]
        self.tex = sorted(tex, key=lambda x: -len(x[1]))   # longest first, so s^2 is read before s

    def number(self, names, pos, by_hand=False):
        for n in names:
            if n:
                self.num.setdefault(n, pos)
                if by_hand:
                    self.hand.add(n)

    def symbol(self, names, pos, what):
        for n in names:
            v = self.symbols.get(n)
            if isinstance(v, dict) and v.get("kind") not in EXEMPT:
                self.sym.setdefault(n, (pos, what))

    def text(self, s, pos, by_hand=False):
        """`{{x}}` shows x's number; a symbol's TeX inside $...$ shows its symbol."""
        self.number(expr_names(self.B, s), pos, by_hand)
        for m in re.findall(r"\$([^$]+)\$", s):
            for n, t in self.tex:
                pat = (r"(?<![A-Za-z\\])" if t[:1].isalpha() else "") + re.escape(t) + (r"(?![A-Za-z])" if t[-1:].isalpha() else "")
                if re.search(pat, m):
                    self.symbol([n], pos, "in the text")
                    m = re.sub(pat, " ", m)

    def walk(self, node, pos, by_hand, i):
        """Prose and plotted names in a visual; a mark with `step:` shows on that step."""
        if isinstance(node, dict):
            if isinstance(node.get("step"), int):
                pos = max(pos, (i, node["step"] - 1))
            for k, v in node.items():
                if isinstance(v, str) and k in PROSE:
                    self.text(v, pos, by_hand)
                elif isinstance(v, str) and k in ("x", "y", "from") and isinstance(node.get("kind") or node.get("from"), str):
                    self.number(self.B.idents(v), pos, by_hand)
                else:
                    self.walk(v, pos, by_hand, i)
        elif isinstance(node, list):
            for v in node:
                self.walk(v, pos, by_hand, i)


def scan(B, L, i, s):
    """Feed one slide to the ledger, click by click."""
    t = s.get("type") or "idea"
    hand = s.get("beat") == "by-hand"
    for k in ("title", "lead"):
        if isinstance(s.get(k), str):
            L.text(s[k], (i, 0), hand)
    if t != "board":
        for k, v in prose({x: y for x, y in s.items() if x not in ("title", "lead")}):
            L.text(v, (i, 0))
        if t == "equation":
            ids = B.idents(s["expr"]) if s.get("expr") else TERM.findall(str(s.get("tex") or ""))
            L.symbol(ids + as_list(s.get("lhs")), (i, 0), "an equation")
            if s.get("expr"):
                L.number(ids + as_list(s.get("lhs")), (i, 0))
        for ln in as_list(s.get("lines")) if t == "calc" else []:
            if isinstance(ln, dict) and ln.get("expr"):
                ids = B.idents(ln["expr"]) + as_list(ln.get("name"))
                L.number(ids, (i, 0))
                L.symbol(ids, (i, 0), "a worked line")
        if t == "table":
            L.number([c.get("key") if isinstance(c, dict) else c for c in as_list(s.get("cols"))], (i, 0))
        return
    tb = s.get("table")
    if isinstance(tb, dict):
        L.number(as_list(tb.get("from")) + [c.get("key") if isinstance(c, dict) else c for c in as_list(tb.get("cols"))], (i, 0), hand)
    for j, st in enumerate(as_list(s.get("steps"))):
        if not isinstance(st, dict):
            continue
        p = (i, j)
        for k, v in prose({x: st.get(x) for x in ("say", "think")}):
            L.text(v, p, hand)
        for it in as_list(st.get("add")):
            if not isinstance(it, dict):
                continue
            c, e, a, pr, op, col = (it.get(k) for k in ("calc", "eqn", "assemble", "params", "ops", "col"))
            if isinstance(c, dict) and c.get("expr"):
                ids = B.idents(c["expr"]) + as_list(c.get("name"))
                L.number(ids, p, hand)
                L.symbol(ids, p, "a worked line")
            if isinstance(e, dict):
                ids = (B.idents(e["expr"]) if e.get("expr") else TERM.findall(str(e.get("tex") or ""))) + as_list(e.get("lhs"))
                L.symbol(ids, p, "an equation")
                if e.get("expr"):
                    L.number(ids, p, hand)
            if isinstance(a, dict):   # numbers row on this click, symbols row on the next
                L.number([n for n, _ in TAGGED.findall(str(a.get("plug") or ""))] + as_list(a.get("lhs")), p, hand)
                L.symbol(TERM.findall(str(a.get("tex") or "")) + as_list(a.get("lhs")), (i, j + 1), "the formula strip")
            if isinstance(pr, dict):
                L.number(as_list(pr.get("names")), p, hand)
                L.symbol(as_list(pr.get("names")), p, "a parameter card")
            if isinstance(op, dict):
                m = op.get("matrix") if isinstance(op.get("matrix"), dict) else {}
                L.number(as_list(m.get("from")) + as_list(m.get("cols")) + [x.get("name") for x in as_list(op.get("steps")) if isinstance(x, dict)], p, hand)
            if isinstance(col, dict):
                L.number(as_list(col.get("key")), p, hand)
            L.walk({k: v for k, v in it.items() if k not in ("calc", "eqn", "assemble", "params", "ops", "col")}, p, hand, i)
            for k in ("calc", "eqn", "assemble", "col"):   # their say lines are prose too
                if isinstance(it.get(k), dict) and isinstance(it[k].get("say"), str):
                    L.text(it[k]["say"], p, hand)


def lint_order(B, Lx, deck):
    """R4 and R5: a symbol shows only after its number, and a formula scene is built from numbers worked by hand."""
    symbols = deck.get("symbols") or {}
    slides = deck.get("slides") or []
    L = Ledger(B, symbols)
    exempt = {n for n, v in symbols.items() if isinstance(v, dict) and v.get("kind") in EXEMPT}
    for i, s in enumerate(slides):
        if s.get("type") == "board":
            hand = set(L.hand)   # worked by hand in an earlier scene
            has = False
            for st, it in items_of(s):
                a = it.get("assemble")
                if not isinstance(a, dict):
                    continue
                has = True
                need = TERM.findall(str(a.get("tex") or "")) + [n for n, _ in TAGGED.findall(str(a.get("plug") or ""))] + as_list(a.get("lhs"))
                need += [n for n in B.idents(str(a.get("expr") or "")) if n in symbols]   # an expr assemble shows each symbol it names
                for n in dict.fromkeys(need):
                    if n not in exempt and n not in hand:
                        Lx.err(slide_where(i, s), f"`assemble` uses `{n}`, whose number was not worked in an earlier by-hand scene: "
                               "work it out by hand first, so the formula is built from numbers the learner made")
            if s.get("beat") == "formula" and not has:
                Lx.err(slide_where(i, s), "a formula scene builds its formula with an `assemble` item, from numbers worked by hand earlier")
        scan(B, L, i, s)
    for n, ((i, j), what) in sorted(L.sym.items(), key=lambda x: x[1][0]):
        p = L.num.get(n)
        if p is None or p > (i, j):
            tex = symbols[n].get("tex")
            first = f"its number first shows on {at(*p)}" if p else "its number never shows"
            Lx.err(slide_where(i, slides[i]), f"symbol `{n}` (${tex}$) shows on {at(i, j)} ({what}), but {first}: "
                   f"show the number first (a worked line, a table column or {{{{{n}}}}}), then its symbol")


def flat(data):
    """(how to write it, value) for every number in the data."""
    for k, v in (data or {}).items():
        if isinstance(v, bool):
            continue
        if isinstance(v, (int, float)):
            yield k, v
        elif isinstance(v, list) and all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in v):
            for j, x in enumerate(v):
                yield f"at({k}, {j})", x


def lint_typed(Lx, deck, data):
    """R16: a decimal, or a whole number of 10 or more, typed into lesson text. CD19, w1 and "6 cells" pass."""
    vals = list(flat({**(deck.get("data") or {}), **(data or {})}))
    def check(where, key, text):
        for m in TYPED.finditer(HIDE.sub(" ", text)):
            sign, num = m.groups()
            v = float(num) * (-1 if sign else 1)
            if "." not in num and abs(v) < 10:
                continue
            p = len(num.split(".")[1]) if "." in num else 0
            hits = [n for n, x in vals if abs(round(x, p) - v) < 1e-9]
            typed = sign + num
            if hits:
                f = "" if p == 0 and all(float(x).is_integer() for n, x in vals if n == hits[0]) else f"|{p}"
                more = f" (or {', '.join('`' + h + '`' for h in hits[1:3])})" if len(hits) > 1 else ""
                Lx.warn(where, f"typed number {typed} in `{key}` matches `{hits[0]}`{more}: write {{{{{hits[0]}{f}}}}}, so it follows the data")
            else:
                Lx.warn(where, f"typed number {typed} in `{key}`: compute it with a {{{{…}}}} expression over the data, so it cannot go stale")
    for k in ("title", "subtitle", "question", "answer"):
        if isinstance(deck.get(k), str):
            check("lesson", k, deck[k])
    for i, s in enumerate(deck.get("slides") or []):
        for k, v in prose(s):
            check(slide_where(i, s), k, v)


def lint_cards(B, Lx, deck, data):
    """KTD17: review cards travel into later lessons' recall quiz, where only data.json names exist."""
    slides = deck.get("slides") or []
    if not slides or (slides[-1].get("type") or "idea") != "quiz":
        return
    have = set(data or {}) | set(deck.get("data") or {}) | B.CONSTS
    for k, card in enumerate(as_list(slides[-1].get("cards"))):
        for _, txt in prose(card):
            for n in expr_names(B, txt):
                if n not in have:
                    Lx.err(slide_where(len(slides) - 1, slides[-1]), f"review card {k + 1} reads `{n}`, which is not in data.json: a later lesson's "
                           "recall quiz copies this card and has only data.json names, so write it in make_data.py")


def same(a, b):
    norm = lambda x: re.sub(r"[\s{}]", "", str(x))
    return norm(a) == norm(b)


def lint_known(B, Lx, deck, glob):
    """KTD13: three known deck failures, as lesson errors."""
    symbols = deck.get("symbols") or {}
    slides = deck.get("slides") or []
    made = {}   # a name a worked line makes -> the slide it lives on
    for i, s in enumerate(slides):
        t = s.get("type") or "idea"
        w = slide_where(i, s)
        if t == "table" and isinstance(s.get("rows"), str):
            Lx.err(w, f"`rows: {s['rows']}` names data, which a table cannot read (it crashes in the browser): write `from: {s['rows']}`")
        if t == "board" and isinstance(s.get("table"), dict) and "rows" in s["table"]:
            Lx.err(w, "a board table reads its rows from `from:` (a data name), not `rows:`")
        lines = [ln for ln in as_list(s.get("lines")) if isinstance(ln, dict)] if t == "calc" else []
        lines += [it["calc"] for _, it in items_of(s) if isinstance(it.get("calc"), dict)] if t == "board" else []
        steps = [x for x in as_list(s.get("steps")) if isinstance(x, dict) and x.get("op")] if t == "ops" else []
        steps += [x for _, it in items_of(s) if isinstance(it.get("ops"), dict) for x in as_list(it["ops"].get("steps")) if isinstance(x, dict)] if t == "board" else []
        for ln in lines + steps:
            n, e = ln.get("name"), ln.get("expr")
            if not (n and e):
                continue
            tex = ln.get("tex") or (symbols[n].get("tex") if isinstance(symbols.get(n), dict) else None)
            if same(n, e) or (tex and same(tex, e)):
                Lx.err(w, f"the line for `{n}` has its own name as its formula (`{e}`), so it draws a line that says nothing: write the formula from the names it is made of")
            if t == "board" and n not in glob:
                made.setdefault(n, i)
        for _, it in items_of(s) if t == "board" else ():
            for k in ("assemble", "eqn"):
                n = it.get(k).get("lhs") if isinstance(it.get(k), dict) else None
                if n and n not in glob:
                    made.setdefault(n, i)
    # a later scene that reads a worked name gets the deck's "unknown name" error; say why, and where the name lives
    for k, (lvl, where, msg) in enumerate(Lx.out):
        m = re.search(r"unknown name `(\w+)`", msg)
        i = made.get(m.group(1)) if m else None
        if i is not None and not where.startswith(f"slide {i + 1} "):
            Lx.out[k] = (lvl, where, msg + f": `{m.group(1)}` is made by a worked line on slide {i + 1}, and each scene has its own scope, "
                         "so put it in data.json (make_data.py) or the top-level `derive:`")


def lint_recall(Lx, deck, state):
    """R23: what `recall:` could not do, and a later episode that recalls nothing."""
    for msg in state.get("errs", ()):
        Lx.err("recall", msg)
    ep = deck.get("episode")
    if isinstance(ep, int) and ep > 1 and not deck.get("recall"):
        Lx.warn("recall", f"episode {ep} has no `recall:`: name the earlier lesson, so this one opens with its review cards")


def make_lint(B, data, state=None):
    state = state if state is not None else {}

    def lesson_lint(Lx, deck, glob):
        slides = deck.get("slides") or []
        own = {**deck, "slides": [s if s is not state.get("slide") else {"type": "quiz"} for s in slides]}   # recall cards were linted in their own lesson
        lint_scenes(B, Lx, deck, glob); lint_shape(B, Lx, slides); lint_order(B, Lx, own)
        lint_typed(Lx, own, data); lint_cards(B, Lx, deck, data); lint_known(B, Lx, deck, glob)
        lint_recall(Lx, deck, state)
    return lesson_lint
