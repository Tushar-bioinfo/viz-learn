"""The lesson lint: the rules a viz-os class lesson keeps on top of the deck's own (lesson.md has the why).

lesson.py runs it through the deck build's lint hook. Scene rules check each board on its own; whole-lesson rules check
the beats in order, that every symbol shows after its number, and that numbers are computed. A lesson has no quiz or
recall cards; `lint_cards` and `lint_recall` stay here for sketch, whose pages keep their review cards.
"""
import difflib
import math
import re

# beats a scene can carry (lesson.md); the last four are optional moves
BEATS = {"plan", "problem", "data", "by-hand", "picture", "formula", "run", "what-if", "limits", "summary", "next",
         "analogy", "compare", "misconception", "aside"}
LESSON_BEATS = BEATS | {"refresher"}   # a refresher is a class lesson's end scene; a sketch page has none
STEP = {"say", "why", "add", "mark", "think", "frame", "more", "refresh"}
# deck visuals placed in the picture column as they are
VIS = {"chart", "image", "dist", "stat", "units", "parts", "flow"}
ITEMS = {"calc", "plane", "space", "chance", "fork", "beads", "strip", "note", "col", "params", "eqn", "assemble", "compare", "ops", "matrix", "vec"} | VIS
# the fields each text item takes; anything else is usually a comma inside an unquoted `{ }` value that split it
FIELDS = {"calc": {"say", "why", "row", "expr", "name", "fmt", "id"}, "col": {"key", "label", "expr", "fmt"},
          "eqn": {"say", "lhs", "expr", "tex", "id", "_uses", "_draws"}, "assemble": {"say", "lhs", "expr", "tex", "plug", "fmt", "id"},
          "params": {"say", "names", "side", "id"}}
TERM = re.compile(r"\[([A-Za-z_]\w*)\]")
TAGGED = re.compile(r"\[([A-Za-z_]\w*):([^\]]*)\]")
MATREF = re.compile(r"\\mat\{([A-Za-z_]\w*)(?:\|\d)?\}")   # \mat{X} or \mat{X|2}: a matrix or vector drawn from the data
OBJ = {"matrix": "matrix", "vector": "vec"}   # symbol kinds drawn in brackets, and the item that draws each
# a bracket a worked product draws (product.py) is one object too; its numbers and sums are not terms
MATENV = re.compile(r"\\(begin|end)\{[bpvBV]?matrix\}|\\mat\{[^}]*\}|\\prodpart\{(?:[^}|]*\|){3}(?:row|col|sums|mcol|scaled|rcol)[|\d]*\}")
PRODPART = re.compile(r"\\prodpart\{[^}]*\}")
PRODREF = re.compile(r"\\prodpart\{([A-Za-z_]\w*)\|([A-Za-z_]\w*)\|([A-Za-z_]\w*)\|")


def bracket_objects(tex):
    """(tex with each outermost matrix or \\mat{NAME} blanked, how many there were): a matrix inside a matrix is part of it."""
    out, n, depth, start, last = [], 0, 0, 0, 0
    for m in MATENV.finditer(tex):
        if m.group(1) is None:              # \mat{NAME}
            if depth == 0:
                out.append(tex[last:m.start()] + " "); last = m.end(); n += 1
        elif m.group(1) == "begin":
            if depth == 0:
                start = m.start()
            depth += 1
        elif depth:
            depth -= 1
            if depth == 0:
                out.append(tex[last:start] + " "); last = m.end(); n += 1
    if depth:                               # an unclosed matrix: leave its terms to count one by one
        return tex, n
    return "".join(out) + tex[last:], n
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
        Lx.err(where, "one run per scene: Next stops on its frames, so two would fight")
    framed = [st for st in steps if isinstance(st, dict) and "frame" in st]
    if framed and not runs:
        Lx.err(where, "a step sets `frame:` but the scene has no run control (`controls: [{name: t, run: 12}]`)")
    if runs:
        n = runs[0]["run"]
        for st in framed:
            if not isinstance(st["frame"], int) or not 0 <= st["frame"] < n:
                Lx.err(where, f"`frame: {st['frame']!r}` is not a frame of the run (0..{n - 1})")
        if not framed and len(steps) < len(as_list(runs[0].get("stops"))):
            Lx.err(where, f"the run stops on {len(as_list(runs[0].get('stops')))} frames, one per step, but the scene has {len(steps)} steps: add steps or give each its `frame:`")


# plane marks: what each takes (numbers or expressions; a point is [x, y])
PLANE = {"points": "{from, x, y, by, label, colors}", "shade": "[w0, w1, w2]", "line": "[w0, w1, w2]", "point": "[x, y]",
         "segment": "[[x1, y1], [x2, y2]]", "vector": "[dx, dy] (and from: [x, y])", "foot": "{from: [x, y], line: [w0, w1, w2]} or {from, dir: [dx, dy]}",
         "square": "[[x1, y1], [x2, y2]]", "text": "a label (and at: [x, y])", "ring": "[x, y]", "quarters": "[cx, cy]"}


MARK_FIELDS = {"step", "color", "rgb", "label", "name", "says", "dash", "when", "side", "from", "at", "id", "centre"}   # what every mark may also take (board.md)
# legend limits and word counts (a {{number}}, $maths$ or `code` is one word) come from the deck: B.LEGEND_WORDS,
# B.LEGEND_MAX, B.name_words


def lint_plane(B, Lx, w, pl, names):
    """Each mark is one kind, with the right number of values, and every value is an expression the page can work out.
    The legend stays short. Returns the marks that carry a `name`, for the "say what it is" check."""
    if not isinstance(pl, dict):
        Lx.err(w, "`plane` is a mapping with `x`, `y` and `marks`")
        return []
    marks = [mk for mk in as_list(pl.get("marks")) if isinstance(mk, dict)]
    keys = [mk["label"] for mk in marks if mk.get("label") and "points" not in mk]
    for mk in marks:   # a points mark's legend holds one entry per colour group: its label, or the group's own name
        if isinstance(mk.get("points"), dict) and isinstance(mk["points"].get("colors"), dict):
            keys += [(v.get("label") if isinstance(v, dict) else None) or k for k, v in mk["points"]["colors"].items()]
    for t in keys:
        if B.name_words(t) > B.LEGEND_WORDS:
            Lx.warn(w, f"legend label “{t}”: legend labels are for a quick read: {B.LEGEND_WORDS} words at most; put the rest in says:")
    for mk in marks:   # a name on the plot is read at a glance too, beside its mark
        if mk.get("name") and B.name_words(mk["name"]) > B.LEGEND_WORDS:
            Lx.warn(w, f"name “{mk['name']}”: names on the plot are for a quick read: {B.LEGEND_WORDS} words at most; put the rest in says:")
    n = len(keys)
    if n > B.LEGEND_MAX:
        Lx.warn(w, f"{n} legend entries on one plane: more than {B.LEGEND_MAX} is too many for a quick read; name marks on the plot (name:) or split the plane")
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
        for x in sorted(set(mk) - set(PLANE) - MARK_FIELDS, key=str):
            prose = " " in str(x) or mk.get(x) is None   # a key with no value, or with spaces, is the tail of a cut-off sentence
            Lx.err(w, f"plane mark {i + 1} (`{k}`) has no field `{x}` (it takes {', '.join(sorted(MARK_FIELDS))})"
                      + ("; it looks like the end of a sentence: a comma inside an unquoted `{ }` value splits it, so quote that value" if prose else ""))
        if "centre" in mk and (k != "point" or mk["centre"] is not True):
            Lx.err(w, f"plane mark {i + 1}: `centre: true` goes on a `point` (a centre drawn as a ring with a cross, never like a data dot)")
        if pl.get("fill") and k in ("vector", "foot", "square"):
            Lx.err(w, f"a plane with `fill` stretches its axes, so a `{k}` would not read true: delete `fill`, or drop the mark")
        if mk.get("when") is not None:
            ex(mk["when"])
        if mk.get("rgb") is not None:   # a dot in its true colour: rgb: 10 (x = red, y = green), or {r, g, b, max}
            rg = mk["rgb"]
            if mk.get("color") is not None or (k == "points" and isinstance(v, dict) and v.get("colors")):
                Lx.err(w, f"plane mark {i + 1} (`{k}`) has both `rgb` and `{'color' if mk.get('color') is not None else 'colors'}`: use one")
            if k not in ("point", "points"):
                Lx.err(w, f"plane mark {i + 1} (`{k}`): `rgb` colours a `point` or `points` dot; give a `{k}` a `color`")
            elif isinstance(rg, dict):
                for x in sorted(set(rg) - {"r", "g", "b", "max"}, key=str):
                    Lx.err(w, f"plane mark {i + 1} `rgb` has no field `{x}` (it takes r, g, b, max)")
                ex(rg.get("max"))
                if k == "point":   # on a points mark r, g, b are row keys, like x and y
                    for q in ("r", "g", "b"):
                        ex(rg.get(q))
            else:
                ex(rg)
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
        elif k == "quarters":
            if not isinstance(v, list) or len(v) != 2 or any(isinstance(x, (list, dict, bool)) or x is None for x in v):
                Lx.err(w, f"plane `quarters` takes the point where the two zero lines cross, [cx, cy]: two numbers or expressions; got {v!r}")
            else:
                for x in v:
                    ex(x)
        elif k == "points":
            if not isinstance(v, dict) or not all(v.get(q) for q in ("from", "x", "y")):
                Lx.err(w, f"plane `points` takes {PLANE['points']}")
            else:
                ex(v["from"])
    return [mk for mk in marks if mk.get("name") is not None]


# space marks (board.md `space`): a position is a name or expression that gives 3 numbers, or a written triple [x, y, z]
SPACE = {"points": "{from, at}", "point": "a position", "ring": "a position", "vector": "a position (and from:)",
         "sheet": "[U, V] with max: [a, b] (and min:)", "foot": "{from: P, onto: U} or {from: P, onto: [U, V]}",
         "segment": "[P, Q]", "text": "a label (and at:)",
         "guess": "[a, b] on: [U, V] from: P (a hunt makes it)", "split": "[U, V] by: [a, b] (or the short {split: P, along: [U, V]})"}
NUMBER = re.compile(r"[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?")   # a bare number, where a position is needed
SPACE_FIELDS = {"step", "color", "rgb", "label", "says", "dash", "when", "from", "at", "min", "max", "ring", "centre", "id", "on", "was", "by", "to"}
ON_SPACE = "a space draws no names on its marks: give the mark `label:` (its legend entry) and `says:` (its card)"


def lint_space(B, Lx, w, sp, names, symbols, values):
    """A space has 3 axis names; each mark is one kind, its positions give 3 numbers, and its legend stays short.
    Returns each labelled mark as {name, says}, for the "say what it is" check."""
    if not isinstance(sp, dict):
        Lx.err(w, "`space` is a mapping with `axes: [x, y, z]` and `marks`")
        return []
    for k in sorted(set(sp) - {"axes", "marks", "max", "id", "views"}, key=str):
        Lx.err(w, f"`space` has no field `{k}` (it takes axes, marks, max, id, views)")
    ax = sp.get("axes")
    if not isinstance(ax, list) or len(ax) != 3 or not all(isinstance(a, str) and a.strip() for a in ax):
        Lx.err(w, f"space `axes` is 3 names, one per axis: [OD red, OD green, OD blue]; got {ax!r}")
    if sp.get("max") is not None and (not isinstance(sp["max"], list) or len(sp["max"]) != 3):
        Lx.err(w, f"space `max` is 3 numbers, one per axis (leave it out and the kit sizes the axes); got {sp['max']!r}")

    def ex(v):
        B.check_expr(Lx, w + " space", v, names)

    def three(v, what):
        """A position: a written triple, or a name or expression. A name in the data must hold 3 numbers."""
        if isinstance(v, list):
            if len(v) != 3 or any(isinstance(x, list) for x in v):
                Lx.err(w, f"space {what} is not 3 numbers: write [x, y, z], or a name that holds 3 numbers; got {v!r}")
            for x in v:
                ex(x)
            return
        if not isinstance(v, str) or NUMBER.fullmatch(v.strip()):
            Lx.err(w, f"space {what} is not 3 numbers: write [x, y, z], or a name that holds 3 numbers; got {v!r}")
            return
        ex(v)
        d = values.get(v) if isinstance(v, str) else None
        if d is not None and not (isinstance(d, list) and len(d) == 3 and all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in d)):
            Lx.err(w, f"space {what} `{v}` is not 3 numbers in the data ({str(d)[:40]})")

    def thin(names, what):
        """Two data vectors that nearly point the same way (sine of their angle under 1e-6, as the kit tests) span no plane."""
        U, V = (values.get(x) if isinstance(x, str) else None for x in names)
        if not all(isinstance(q, list) and len(q) == 3 and all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in q) for q in (U, V)):
            return
        uu, vv, uv = (sum(a * b for a, b in zip(q, r)) for q, r in ((U, U), (V, V), (U, V)))
        if uu == 0 or vv == 0 or max(0.0, 1 - uv * uv / (uu * vv)) ** 0.5 < 1e-6:
            Lx.warn(w, f"space {what} [{names[0]}, {names[1]}]: the two vectors are zero or nearly point the same way, so they span no plane; the kit draws {'no drop' if what == 'foot onto' else 'a line'}")

    marks = [mk for mk in as_list(sp.get("marks")) if isinstance(mk, dict)]
    keys = [mk["label"] for mk in marks if mk.get("label")]
    for t in keys:
        if B.name_words(t) > B.LEGEND_WORDS:
            Lx.warn(w, f"legend label “{t}”: legend labels are for a quick read: {B.LEGEND_WORDS} words at most; put the rest in says:")
    if len(keys) > B.LEGEND_MAX:
        Lx.warn(w, f"{len(keys)} legend entries on one space: more than {B.LEGEND_MAX} is too many for a quick read; drop a label or split the scene")
    out = []
    for i, mk in enumerate(as_list(sp.get("marks"))):
        m = f"space mark {i + 1}"
        kind = [k for k in SPACE if isinstance(mk, dict) and k in mk and not (k == "ring" and "point" in mk)]
        if len(kind) != 1:
            Lx.err(w, f"{m} is one of {', '.join(SPACE)}; got {mk!r}")
            continue
        k, v = kind[0], mk[kind[0]]
        if "name" in mk:
            Lx.err(w, f"{m} (`{k}`) has `name:`: {ON_SPACE}")
        for x in sorted(set(mk) - set(SPACE) - SPACE_FIELDS - {"name"}, key=str):
            prose = " " in str(x) or mk.get(x) is None
            Lx.err(w, f"{m} (`{k}`) has no field `{x}` (it takes {', '.join(sorted(SPACE_FIELDS))})"
                      + ("; it looks like the end of a sentence: a comma inside an unquoted `{ }` value splits it, so quote that value" if prose else ""))
        if mk.get("when") is not None:
            ex(mk["when"])
        if "centre" in mk and (k != "point" or mk["centre"] is not True):
            Lx.err(w, f"{m}: `centre: true` goes on a `point` (a centre drawn as a ring with a cross, never like a data dot)")
        if "ring" in mk and "point" in mk and mk["ring"] is not True:
            Lx.err(w, f"{m}: `ring` on a point is `true` (a ring round the dot); for a ring alone write {{ring: P}}")
        rg = mk.get("rgb", v.get("rgb") if k == "points" and isinstance(v, dict) else None)
        if rg is not None:
            if k not in ("point", "points"):
                Lx.err(w, f"{m} (`{k}`): `rgb` colours a `point` or `points` dot; give a `{k}` a `color`")
            elif mk.get("color") is not None:
                Lx.err(w, f"{m} (`{k}`) has both `rgb` and `color`: use one")
            elif isinstance(rg, dict):
                for x in sorted(set(rg) - {"r", "g", "b", "max"}, key=str):
                    Lx.err(w, f"{m} `rgb` has no field `{x}` (it takes r, g, b, max)")
            elif rg != "od":
                ex(rg)
        if k in ("point", "ring", "vector"):
            three(v, k)
            if mk.get("from") is not None:
                three(mk["from"], "vector from")
        elif k == "segment":
            if not isinstance(v, list) or len(v) != 2:
                Lx.err(w, f"space `segment` takes two positions, {SPACE['segment']}")
            else:
                for q in v:
                    three(q, "segment end")
        elif k == "sheet":
            if not isinstance(v, list) or len(v) != 2:
                Lx.err(w, f"space `sheet` takes two vectors, {SPACE['sheet']}; got {v!r}")
            else:
                for q in v:
                    three(q, "sheet vector")
                thin(v, "sheet")
            for b in ("max", "min"):
                bv = mk.get(b)
                if bv is None and b == "max":
                    Lx.err(w, f"space `sheet` needs `max: [a, b]`: how far it runs along each vector (min is 0 unless given)")
                elif bv is not None and (not isinstance(bv, list) or len(bv) != 2):
                    Lx.err(w, f"space `sheet` `{b}` is 2 numbers, one per vector; got {bv!r}")
                elif bv is not None:
                    for x in bv:
                        ex(x)
        elif k == "foot":
            onto = v.get("onto") if isinstance(v, dict) else None
            many = isinstance(onto, list) and len(onto) == 2
            vecs = isinstance(onto, list) and any(isinstance(values.get(x), list) or (isinstance(symbols.get(x), dict) and symbols[x].get("kind") == "vector") for x in onto if isinstance(x, str))
            if not isinstance(v, dict) or v.get("from") is None or onto is None:
                Lx.err(w, f"space `foot` takes {SPACE['foot']}")
            elif isinstance(onto, list) and not many and (len(onto) != 3 or vecs):
                Lx.err(w, f"space `foot.onto` is 1 vector (a line) or 2 vectors (a plane); got {onto!r}")
            else:
                three(v["from"], "foot from")
                for q in (onto if many else [onto]):
                    three(q, "foot onto")
                if many:
                    thin(onto, "foot onto")
        elif k == "text":
            if mk.get("at") is None:
                Lx.err(w, "space `text` needs `at:`, a position")
            else:
                three(mk["at"], "text at")
        elif k == "points":
            if not isinstance(v, dict) or not v.get("from") or not v.get("at"):
                Lx.err(w, f"space `points` takes {SPACE['points']}: a table, and the column whose cells are 3 numbers")
            else:
                for x in sorted(set(v) - {"from", "at", "rgb"}, key=str):
                    Lx.err(w, f"space `points` has no field `{x}` (it takes from, at, rgb)")
                ex(v["from"])
                rows = values.get(v["from"]) if isinstance(v["from"], str) else None
                if isinstance(rows, list) and rows and isinstance(rows[0], dict):
                    cell = rows[0].get(v["at"])
                    if not (isinstance(cell, list) and len(cell) == 3):
                        Lx.err(w, f"space `points` column `{v['at']}` is not 3 numbers in the first row of `{v['from']}`")
        if mk.get("label"):
            sym = symbols.get(v) if isinstance(v, str) and isinstance(symbols.get(v), dict) else {}
            out.append({"name": mk["label"], "says": mk.get("says") or sym.get("says"), "step": mk.get("step")})
    return out


def mark_symbol(mk, symbols):
    """The symbol a chart mark stands for: an hline's y, a vline's x or a point's y, when it is a bare symbol name."""
    k = mk.get("kind")
    v = mk.get("y") if k == "hline" else mk.get("x") if k == "vline" else (as_list(mk.get("at"))[1:2] or [mk.get("y")])[0] if k == "point" else None
    return v if isinstance(v, str) and isinstance(symbols.get(v), dict) else None


def charts_of(it):
    """Every chart an item draws on a board: its own, and one in each side of a `compare`. Yields (where, chart)."""
    if isinstance(it.get("chart"), dict):
        yield "", it["chart"]
    cp = it.get("compare")
    for k in "ab":
        v = cp.get(k) if isinstance(cp, dict) else None
        if isinstance(v, dict) and isinstance(v.get("visual"), dict) and isinstance(v["visual"].get("chart"), dict):
            yield f" compare {k}", v["visual"]["chart"]


def mark_color(mk, symbols, q):
    """The colour a mark draws in on a board: its own, else its symbol's, else its kind's default."""
    sc = symbols[q].get("color") if q else None
    return mk.get("color") or (sc if sc and sc != "ink" else None) or ("accent" if mk.get("kind") in ("point", "area", "arrow") else "mist")


ON_PLOT = "on a board a mark's name goes in the legend and its meaning in a card: use name: and says:, or a symbol as its value"


def board_chart(ch):
    """A chart as the board draws it (board.js `figure`): when every series name is one of the x-axis `cats`, the
    legend would only repeat the axis labels, so the board hides it."""
    cats = as_list((ch.get("x") or {}).get("cats")) if isinstance(ch.get("x"), dict) else []
    nm = [q["name"] for q in as_list(ch.get("series")) if isinstance(q, dict) and q.get("name")]
    return dict(ch, legend=False) if cats and nm and all(q in cats for q in nm) else ch


def mark_entry(mk, symbols):
    """The legend entry a chart mark adds on a board: its `name`, else its symbol value's `short`; None for none."""
    if not isinstance(mk, dict) or mk.get("kind") == "label":
        return None
    q = mark_symbol(mk, symbols)
    return mk.get("name") or (symbols[q].get("short") if q else None)


def mark_entries(ch, symbols):
    """How many legend entries a board chart's marks add (B.lint_visual adds the series and warns past the limit)."""
    return sum(1 for mk in as_list(ch.get("marks")) if mark_entry(mk, symbols)) if isinstance(ch, dict) else 0


def lint_chart_marks(B, Lx, w, ch, symbols):
    """A chart on a board draws no tag on its marks: a named mark takes a legend entry and a card. Returns the named
    marks with no card of their own, for the "say what it is" check."""
    out, seen = [], {}
    for i, mk in enumerate(as_list(ch.get("marks"))):
        if not isinstance(mk, dict):
            continue
        k, q = mk.get("kind"), mark_symbol(mk, symbols)
        if k == "label":
            Lx.err(w, f"chart mark {i + 1} is a `label` mark: {ON_PLOT}")
            continue
        for f in ("label", "text"):
            if mk.get(f) is not None:
                Lx.err(w, f"chart mark {i + 1} ({k}) has `{f}:`: {ON_PLOT}")
        name = mark_entry(mk, symbols)
        if mk.get("name") is not None and B.name_words(mk["name"]) > B.LEGEND_WORDS:
            Lx.err(w, f"chart mark {i + 1} ({k}): name “{mk['name']}” is {B.name_words(mk['name'])} words: a legend name is {B.LEGEND_WORDS} words at most; put the rest in says:")
        if q and mk.get("says") is not None:
            Lx.warn(w, f"chart mark {i + 1} ({k}): `says` is not shown: the symbol's card is used; delete it")
        if name:
            key = (k, mark_color(mk, symbols, q))
            if key in seen and seen[key] != name:
                Lx.warn(w, f"chart mark {i + 1} ({k}): the legend cannot tell {seen[key]} and {name} apart: give each its own color")
            seen.setdefault(key, name)
        elif k in ("point", "arrow"):
            Lx.warn(w, f"chart mark {i + 1} ({k}) has no name: give it name: and says:, or a symbol as its value, so the learner can find out what it marks")
        if mk.get("name") and not mk.get("says") and not (q and symbols[q].get("says")):
            out.append(mk)
    return out


GREEK = {g: chr(c) for g, c in zip("alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho varsigma sigma tau upsilon phi chi psi omega".split(), range(0x3B1, 0x3CA))}
GREEK |= {g: chr(c) for g, c in zip("Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho".split(), range(0x391, 0x3A2))}
GREEK |= {g: chr(c) for g, c in zip("Sigma Tau Upsilon Phi Chi Psi Omega".split(), range(0x3A3, 0x3AA))}
GREEK |= {"varepsilon": "ε", "vartheta": "θ", "varphi": "φ", "varrho": "ρ", "varpi": "π"}


def norm_greek(t):
    return re.sub(r"\\([A-Za-z]+)", lambda m: GREEK.get(m.group(1), m.group(0)), str(t))


def norm_name(t):
    """A name as the reader sees it: no `$`, Greek TeX commands as their letters (\\alpha is α), no spaces."""
    return re.sub(r"\s+", "", norm_greek(str(t).replace("$", "")))


def explained(name, lines, symbols):
    """Is a plane mark's on-plot name said in one of these teacher lines: as a word, or as its symbol in the maths?
    Both sides are compared as the reader sees them, so `$x$`, `\\alpha` and `α` match their plain forms."""
    raw = str(name).strip()
    if not raw or "{{" in raw:
        return True                          # a name that is a number explains itself
    t = norm_name(raw)
    if not t:
        return True
    sym = next((v for k, v in symbols.items() if isinstance(v, dict) and k in (raw, t)), None)
    texs = {t} | ({norm_name(sym["tex"])} if sym and sym.get("tex") else set()) | {norm_name(v["tex"]) for v in symbols.values() if isinstance(v, dict) and norm_name(v.get("tex", "")) == t}
    texs.discard("")
    word = re.compile(r"(?<![\w])" + re.escape(t) + r"(?![\w])")
    for ln in lines:
        ln = str(ln)
        if t not in PLAIN and word.search(norm_greek(HIDE.sub(" ", ln))):
            return True
        for m in re.findall(r"\$([^$]+)\$", ln):
            m = norm_name(EXPRS.sub(" ", m))
            for x in texs:
                if re.search((r"(?<![A-Za-z\\])" if x[:1].isalpha() else "") + re.escape(x) + (r"(?![A-Za-z])" if x[-1:].isalpha() else ""), m):
                    return True
    return False


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
    # a bracket object (a matrix, or \mat{NAME}) reads as one term, however many [name] tags it holds
    rest, objs = bracket_objects(str(f["tex"]))
    count = len(set(TERM.findall(rest))) + objs
    if count > 5:
        Lx.warn(w, f"{count} terms: more than 5 is a wall; build the formula over two scenes")
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


# chance (adv.md): two groups as units, their shares on one line, the gap and, with `step`, a ruler of noise steps
CHANCE = {"groups", "step", "tally", "axis", "gap_says", "step_says", "id", "ratio"}
CHANCE_GROUP = {"name", "n", "ill", "color", "says"}
CHANCE_MARKS = ("gap", "noise step")


CHANCE_MOST = 12  # the ruler counts at most this many noise steps past its 0 (board.js CH.most)
NUM = lambda q: isinstance(q, (int, float)) and not isinstance(q, bool)


# fork (adv.md): one start, 2–3 ends below it, drawn with the box of parts (board.js fork, parts.js)
FORK = {"start", "ends", "see", "id"}
FORK_START = {"name", "draw"}
FORK_END = {"name", "via", "num", "bad", "draw"}
FORK_PART = {"part", "state", "chroms", "color", "size", "turn"}
# the box of parts and the states each draws: a copy of kit/parts.js STATES, so change both together
PARTS = {"cell": ["plain", "metaphase", "dividing", "dead"], "nucleus": ["plain"], "chromosome": ["pair", "single"], "tissue": ["plain", "regions"],
         "tube": ["filled", "empty"], "plate": ["filled", "empty"], "read": ["full", "short"], "droplet": ["empty", "cell", "bead", "both", "two"], "lens": ["plain"]}
FORK_HUES = 4    # chromosome kinds one fork can colour apart (board.js FORK_HUES)
COLOR_NAMES = {"accent", "tint", "s1", "s2", "s3", "s4", "s5", "ink", "mist", "haze", "line", "good", "bad"}   # board.js COLOR
CHROM = re.compile(r"[A-Za-z][A-Za-z0-9]{0,2}\*?")


def lint_fork(Lx, w, fk, values):
    """A fork's shape, words and parts. Its ends' `via` (the path's word) and `name` (under the end) are what linked words and
    `see` name, so each is short and its own. `num` is text whose numbers come from `{{…}}`. A cell's `chroms` names a data list."""
    if not isinstance(fk, dict):
        Lx.err(w, "`fork` is a mapping with `start:` {name, draw} and `ends:` (2 or 3, each {via, name, num, draw})")
        return
    def unknown(keys, known, what):
        for k in sorted(set(keys) - known, key=str):
            hit = next(iter(difflib.get_close_matches(str(k), sorted(known), 1, .6)), None)
            Lx.err(w, f"{what} has no field `{k}`" + (f": did you mean `{hit}`?" if hit else f" (it takes {', '.join(sorted(known))})"))
    def words(t, most, what):
        if t is None:
            return
        if not isinstance(t, str) or not t.strip():
            Lx.err(w, f"{what} is {t!r}: write a few plain words")
        elif len(re.sub(r"\{\{[^}]*\}\}", "x", t).split()) > most:
            Lx.err(w, f"{what} “{t}” is more than {most} words: it sits under a drawing 300 px wide, so say it in {most} or fewer")
    kinds = []
    def draw(D, what):
        if not isinstance(D, list) or not 1 <= len(D) <= 3:
            Lx.err(w, f"{what} `draw` is a list of 1 to 3 parts, each {{part, state}}; got {D!r}")
            return
        for d in D:
            if not isinstance(d, dict) or "part" not in d:
                Lx.err(w, f"{what}: each part is a mapping with `part:` ({', '.join(PARTS)}); got {d!r}")
                continue
            unknown(d, FORK_PART, f"{what} part `{d.get('part')}`")
            pt, st = d.get("part"), d.get("state")
            if pt not in PARTS:
                hit = next(iter(difflib.get_close_matches(str(pt), list(PARTS), 1, .6)), None)
                Lx.err(w, f"{what}: no part named `{pt}`" + (f": did you mean `{hit}`?" if hit else f"; the box has {', '.join(PARTS)}"))
                continue
            if st is not None and st not in PARTS[pt]:
                Lx.err(w, f"{what}: a {pt} has no state `{st}` (it has {', '.join(PARTS[pt])})")
            if d.get("color") is not None and d["color"] not in COLOR_NAMES:
                Lx.err(w, f"{what}: `color: {d['color']}` is not a kit colour ({', '.join(sorted(COLOR_NAMES))})")
            for k, lo, hi in (("size", 40, 240), ("turn", -180, 180)):
                if d.get(k) is not None and not (NUM(d[k]) and lo <= d[k] <= hi):
                    Lx.err(w, f"{what}: `{k}: {d[k]!r}` must be a number from {lo} to {hi}")
            q = d.get("chroms")
            if q is None:
                continue
            if pt != "cell":
                Lx.err(w, f"{what}: `chroms` draws chromosomes inside a cell; a {pt} has none: delete it")
            elif not isinstance(q, str) or not isinstance(values.get(q), list):
                Lx.err(w, f"{what}: `chroms: {q!r}` names a list in the data, one letter a chromosome kind and `*` after a damaged copy (`[A, B, C*]`), made by make_data.py")
            else:
                lst = values[q]
                if not 1 <= len(lst) <= 8 or not all(isinstance(x, str) and CHROM.fullmatch(x) for x in lst):
                    Lx.err(w, f"{what}: the data list `{q}` holds {lst!r}; it must hold 1 to 8 entries, each a letter for a chromosome kind with `*` after a damaged copy")
                else:
                    kinds.extend(x.rstrip("*") for x in lst)
    unknown(fk, FORK, "`fork`")
    st = fk.get("start")
    if not isinstance(st, dict):
        Lx.err(w, "`fork` needs `start:` {name, draw}: what every end begins from")
    else:
        unknown(st, FORK_START, "`fork` start")
        words(st.get("name"), 5, "`fork` start `name`")
        draw(st.get("draw"), "`fork` start")
    ends = fk.get("ends")
    if not isinstance(ends, list) or not 2 <= len(ends) <= 3:
        Lx.err(w, f"`fork` compares 2 or 3 ends side by side: write `ends:` as a list of 2 or 3; got {len(ends) if isinstance(ends, list) else ends!r}")
        ends = [e for e in ends if isinstance(e, dict)][:3] if isinstance(ends, list) else []
    seen = {}
    for k, e in enumerate(ends):
        what = f"`fork` end {k + 1}"
        if not isinstance(e, dict):
            Lx.err(w, f"{what} is a mapping {{via, name, num, draw}}; got {e!r}")
            continue
        unknown(e, FORK_END, what)
        for f, most in (("via", 3), ("name", 4)):
            if e.get(f) is None:
                Lx.err(w, f"{what} needs `{f}:`" + (": the path's word, how this end comes about ('shared evenly')" if f == "via" else ": what the end is, under its drawing ('two healthy cells')"))
                continue
            words(e[f], most, f"{what} `{f}`")
            key = " ".join(str(e[f]).split()).lower()
            if key in seen:
                Lx.err(w, f"{what} `{f}` “{e[f]}” is also {seen[key]}: each end's `via` and `name` is its linked word, so give each its own")
            seen[key] = f"end {k + 1}'s `{f}`"
        num = e.get("num")
        if num is not None:
            if not isinstance(num, str):
                Lx.err(w, f"{what} `num` is {num!r}: write it as text with the number from the data in {{{{…}}}} ('{{{{n_even}}}} chromosomes each')")
            elif re.search(r"\d", re.sub(r"\{\{[^}]*\}\}", "", num)):
                Lx.err(w, f"{what} `num` “{num}” has a typed number: every number comes from the data, so write it as {{{{name}}}}")
            words(num, 6, f"{what} `num`")
        if e.get("bad") is not None and not isinstance(e["bad"], bool):
            Lx.err(w, f"{what} `bad: {e['bad']!r}` is true or false: true writes the end's name in red")
        draw(e.get("draw"), what)
    if len(set(kinds)) > FORK_HUES:
        Lx.err(w, f"the fork's cells hold {len(set(kinds))} chromosome kinds ({', '.join(sorted(set(kinds)))}); it colours {FORK_HUES} apart: use fewer kinds")
    see = fk.get("see")
    if see is not None and " ".join(str(see).split()).lower() not in seen:
        Lx.err(w, f"`fork` `see: {see}` names no end: write one end's `via` or `name`, the end lit at rest")


# beads (adv.md): one ring of beads per row of a data list, one bead per unit of the whole, the part's beads filled (board.js beads)
BEADS = {"from", "name", "part", "whole", "key", "colors", "id"}
BEADS_ROWS, BEADS_WHOLE = (1, 4), (4, 120)   # rows a figure holds; beads a ring may hold at most
# the ring's size, as board.js BD draws it in the reading column (1084 px wide at any desktop width): change both together
BEADS_ROOM, BEADS_SIDE, BEADS_RMIN, BEADS_RMAX, BEADS_BEAD = 1084, 40, 110, 230, 3.5


def beads_most(n):
    """The largest whole a ring can hold when n rings share the room, with each bead at least BEADS_BEAD px in radius."""
    r = max(BEADS_RMIN, min(BEADS_RMAX, BEADS_ROOM / n / 2 - BEADS_SIDE))
    return min(BEADS_WHOLE[1], int(math.pi * r * .62 / BEADS_BEAD))


def beads_rows(bd, values):
    """The rows a `beads` figure draws: its `from` list, when it is a list of records; else []."""
    rows = values.get(bd.get("from")) if isinstance(bd, dict) and isinstance(bd.get("from"), str) else None
    return [r for r in rows if isinstance(r, dict)] if isinstance(rows, list) else []


def lint_beads(Lx, w, bd, values):
    """A `beads` figure: its keys, its data list of 1–4 records, and in each record a name, a whole 4–120 and a part 0 to the whole."""
    if not isinstance(bd, dict):
        Lx.err(w, "`beads` is a mapping {from, name, part, whole, key}")
        return
    for k in sorted(set(bd) - BEADS, key=str):
        hit = next(iter(difflib.get_close_matches(str(k), sorted(BEADS), 1, .6)), None)
        Lx.err(w, f"`beads` has no field `{k}`" + (f": did you mean `{hit}`?" if hit else f" (it takes {', '.join(sorted(BEADS))}); a comma inside an unquoted `{{ }}` value splits it: quote the value"))
    for k in ("from", "name", "part", "whole"):
        if not (isinstance(bd.get(k), str) and bd[k].strip()):
            Lx.err(w, f"`beads` needs `{k}:`" + (" (a data name holding a list of records, one per ring)" if k == "from" else " (a column of every record)"))
            return
    for k in ("part", "whole"):
        if re.search(r"\s", bd[k].strip()):
            Lx.err(w, f"`beads` `{k}: {bd[k]}` is more than one word: the ring shows each column's key as one word, so rename the column in make_data.py")
    rows = values.get(bd["from"])
    lo, hi = BEADS_ROWS
    if not isinstance(rows, list) or not rows or not all(isinstance(r, dict) for r in rows):
        Lx.err(w, f"`beads` `from: {bd['from']}` is not a list of records in the data: make_data.py writes it, one record per ring")
        return
    if not lo <= len(rows) <= hi:
        Lx.err(w, f"`beads` `from: {bd['from']}` holds {len(rows)} records; the figure draws {lo} to {hi} rings side by side")
    wlo, whi = BEADS_WHOLE[0], beads_most(min(max(len(rows), lo), hi))
    cs = bd.get("colors")
    if cs is not None:
        if not isinstance(cs, list) or len(cs) != len(rows):
            Lx.err(w, f"`beads` `colors` is a list of {len(rows)} kit colours, one per record of `{bd['from']}`; got {cs!r}")
        for c in cs if isinstance(cs, list) else []:
            if c not in COLOR_NAMES:
                Lx.err(w, f"`beads` `colors`: `{c}` is not a kit colour ({', '.join(sorted(COLOR_NAMES))})")
    for r, row in enumerate(rows, 1):
        miss = [bd[k] for k in ("name", "part", "whole") if bd[k] not in row]
        if miss:
            Lx.err(w, f"`beads` record {r} of `{bd['from']}` has no column {', '.join(f'`{m}`' for m in miss)}")
            continue
        nm = row[bd["name"]]
        if not (isinstance(nm, str) and nm.strip()):
            Lx.err(w, f"`beads` record {r}: `{bd['name']}` is {nm!r}; a ring's name is its linked word, so make_data.py writes it as text (\"well\")")
        p, t = row[bd["part"]], row[bd["whole"]]
        whole_num = lambda q: NUM(q) and float(q).is_integer()
        if not whole_num(t) or not wlo <= t:
            Lx.err(w, f"`beads` record {r} ({nm}): `{bd['whole']}` is {t!r}; a ring holds a whole number of beads, at least {wlo}")
        elif t > whi:
            n = len(rows)
            Lx.err(w, f"`beads` record {r} ({nm}): `{bd['whole']}` is {t:g}; {n} ring{'s hold' if n > 1 else ' holds'} at most {whi} beads each, so the beads stay large enough to see: use fewer rows or a smaller whole")
        elif not whole_num(p) or not 0 <= p <= t:
            Lx.err(w, f"`beads` record {r} ({row[bd['name']]}): `{bd['part']}` is {p!r}; it is a whole number from 0 to `{bd['whole']}` ({t:g})")


# slope table (adv.md §9d): a style of the scene's table, one stem per number column, one line per row (board.js slopeDraw)
TABLE_STYLES = ("grid", "slope")
SLOPE_STEMS, SLOPE_ROWS, SLOPE_GROUPS = (2, 5), (2, 12), (2, 5)   # stems after the name column; rows; groups, one kit colour each
# the glyphs a slope table draws beside its names: a copy of kit/parts.js GLYPHS, so change both together
GLYPHS = ("lymphocyte", "monocyte", "tag", "tree-round", "tree-slim", "tree-cone")
_DECK = {}   # the lesson being linted, for slope_groups' colours from the other scenes (make_lint fills it per run)


def slope_cols(s):
    """A board scene's table columns as board.js draws them: the table's own, then each `col` a step adds."""
    tb = s.get("table") if isinstance(s.get("table"), dict) else {}
    cols = [{"key": c} if isinstance(c, str) else c for c in as_list(tb.get("cols")) if isinstance(c, (str, dict))]
    return cols + [it["col"] for _, it in items_of(s) if isinstance(it.get("col"), dict)]


def slope_groups(tb, rows, deck=None):
    """[(group value, kit colour, its words)] in order of first appearance; a group a plane's `points` (same `by:`) colours
    keeps that colour and label; the rest take s1..s5 left over, in order (board.js slopeGroups: change both together)."""
    key, gk, given = tb.get("group"), [], {}
    for r in rows:
        if isinstance(r, dict) and r.get(key) is not None and str(r[key]) not in gk:
            gk.append(str(r[key]))
    for s in (deck if deck is not None else _DECK).get("slides") or []:
        for st in as_list(s.get("steps")) if isinstance(s, dict) else []:
            for it in as_list(st.get("add")) if isinstance(st, dict) else []:
                pl = it.get("plane") if isinstance(it, dict) else None
                for mk in as_list(pl.get("marks")) if isinstance(pl, dict) else []:
                    P = mk.get("points") if isinstance(mk, dict) else None
                    if isinstance(P, dict) and P.get("by") == key and isinstance(P.get("colors"), dict):
                        for g, v in P["colors"].items():
                            c = {"color": v} if isinstance(v, str) else v if isinstance(v, dict) else {}
                            if str(g) not in given and c.get("color"):
                                given[str(g)] = c
    free = [c for c in ("s1", "s2", "s3", "s4", "s5") if not any(given.get(g, {}).get("color") == c for g in gk)]
    return [(g, given[g]["color"], str(given[g].get("label", g))) if g in given else (g, free.pop(0) if free else "ink", g) for g in gk]


def slope_rows(tb, values):
    rows = values.get(tb.get("from")) if isinstance(tb, dict) and isinstance(tb.get("from"), str) else None
    return [r for r in rows if isinstance(r, dict)] if isinstance(rows, list) else []


def plain_value(expr, names):
    """A worked column's value on one row, for the plainest sums only: numbers, names, + - * / ^ and brackets. Anything
    else returns None and is left to the browser check (the kit's JavaScript holds the one real evaluator; design.md)."""
    import ast
    try:
        t = ast.parse(str(expr).replace("^", "**"), mode="eval").body
    except SyntaxError:
        return None
    ops = {ast.Add: lambda a, b: a + b, ast.Sub: lambda a, b: a - b, ast.Mult: lambda a, b: a * b, ast.Pow: lambda a, b: a ** b,
           ast.Div: lambda a, b: a / b if b else (math.nan if a == 0 else math.copysign(math.inf, a) * math.copysign(1, b))}

    def ev(n):
        if isinstance(n, ast.Constant) and NUM(n.value):
            return float(n.value)
        if isinstance(n, ast.Name) and NUM(names.get(n.id)):
            return float(names[n.id])
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.USub, ast.UAdd)):
            v = ev(n.operand)
            return None if v is None else (-v if isinstance(n.op, ast.USub) else v)
        if isinstance(n, ast.BinOp) and type(n.op) in ops:
            x, y = ev(n.left), ev(n.right)
            if x is None or y is None:
                return None
            try:
                v = ops[type(n.op)](x, y)
            except (OverflowError, ZeroDivisionError, ValueError):
                return math.nan
            return v if isinstance(v, float) else math.nan   # a negative number to a broken power gives a complex number
        raise LookupError

    try:
        return ev(t)
    except LookupError:
        return None


def lint_table_style(Lx, where, s, values):
    """A board table's `style`: grid (the default) or slope; a slope table's columns, rows, groups and glyphs."""
    tb = s.get("table")
    if not isinstance(tb, dict):
        return
    st = tb.get("style", "grid")
    if st not in TABLE_STYLES:
        Lx.err(where, f"`table` `style: {st}` is not a table style: `grid` (the default, rows and columns) or `slope` (adv.md §9d)")
        return
    if st == "grid":
        for k in ("group", "glyphs"):
            if k in tb:
                Lx.err(where, f"`table` `{k}` works only with `style: slope`; a grid table does nothing with it: delete it, or set `style: slope`")
        return
    cols = slope_cols(s)
    first, stems = (cols[0] if cols else {}), cols[1:]
    lo, hi = SLOPE_STEMS
    if not lo <= len(stems) <= hi:
        Lx.err(where, f"a slope table has {len(stems)} stem{'s' if len(stems) != 1 else ''}: give it {lo} to {hi} number columns after the first (the first column names each line)")
    if first.get("expr") is not None:
        Lx.err(where, f"a slope table's first column `{first.get('key')}` names each line: a `key` holding text, not an `expr`")
    rows, src = slope_rows(tb, values), tb.get("from")
    if not rows:
        return   # `table needs from:` and an unknown name are reported elsewhere
    rlo, rhi = SLOPE_ROWS
    if not rlo <= len(rows) <= rhi:
        Lx.err(where, f"a slope table draws one line per row: `{src}` holds {len(rows)} rows; it takes {rlo} to {rhi}")
    fk = first.get("key")
    if first.get("expr") is None and fk is not None:
        bad = next(((r, row.get(fk)) for r, row in enumerate(rows) if not (isinstance(row.get(fk), str) and row[fk].strip())), None)
        if bad:
            Lx.err(where, f"a slope table's first column names each line, so it is text: row {bad[0]} `{fk}` is {bad[1]!r}")
    scal = {n: v for n, v in (values or {}).items() if NUM(v)}
    for c in stems:
        k = c.get("key")
        if c.get("expr") is not None:
            # a worked stem: work it on each row; a sum the lint cannot read is left to the browser check
            for r, row in enumerate(rows):
                v = plain_value(c["expr"], {**scal, **{q: x for q, x in row.items() if NUM(x)}})
                if v is not None and not math.isfinite(v):
                    Lx.err(where, f"slope stem `{k}`: `{c['expr']}` on row {r} gives {'not a number' if math.isnan(v) else 'an infinite value'}, so the line has no point there: change the sum, or the data")
                    break
            continue
        if k is None:
            continue
        bad = next(((r, row.get(k, "missing")) for r, row in enumerate(rows) if not (NUM(row.get(k)) and math.isfinite(row[k]))), None)
        if bad:
            Lx.err(where, f"slope stem `{k}`: row {bad[0]} is {bad[1]!r}, not a finite number; every stem is a number in every row, on one scale")
    g = tb.get("group")
    if not (isinstance(g, str) and g.strip()):
        Lx.err(where, "a slope table needs `group:`, a key of every row: its lines take one colour a group")
        return
    miss = next((r for r, row in enumerate(rows) if row.get(g) is None), None)
    if miss is not None:
        Lx.err(where, f"slope `group: {g}` is not a key of row {miss} of `{src}`: every row needs its group")
        return
    vals = [q[0] for q in slope_groups(tb, rows)]
    glo, ghi = SLOPE_GROUPS
    if not glo <= len(vals) <= ghi:
        Lx.err(where, f"slope `group: {g}` has {len(vals)} value{'s' if len(vals) != 1 else ''} ({', '.join(vals)}); the lines compare {glo} to {ghi} groups, one kit colour each")
    gl = tb.get("glyphs")
    if gl is None:
        return
    if not isinstance(gl, dict):
        Lx.err(where, f"slope `glyphs` maps a group to a glyph ({{T: lymphocyte}}); got {gl!r}")
        return
    for k, v in gl.items():
        if str(k) not in vals:
            Lx.err(where, f"slope `glyphs` key `{k}` is not a value of `{g}` ({', '.join(vals)})")
        if v not in GLYPHS:
            hit = next(iter(difflib.get_close_matches(str(v), GLYPHS, 1, .6)), None)
            Lx.err(where, f"slope `glyphs` `{k}: {v}`: no glyph named `{v}`" + (f": did you mean `{hit}`?" if hit else f"; the glyphs are {', '.join(GLYPHS)}"))


def chance_name(nm):
    """A group name as the page shows it: case folded, runs of spaces as one (HTML collapses them)."""
    return " ".join(str(nm).split()).lower()


def ctl_states(c):
    """A control's values, state by state, with a label for each; None when the lint cannot list them."""
    if isinstance(c.get("run"), int):
        return [(f, f"at frame {f}") for f in range(c["run"])]
    if isinstance(c.get("toggle"), list):
        return [(q, f"when `{c['name']}` is {t}") for q, t in enumerate(c["toggle"])]
    lo, hi, st = c.get("min"), c.get("max"), c.get("step") or 1
    if NUM(lo) and NUM(hi) and NUM(st) and st > 0 and hi >= lo and (hi - lo) / st <= 1000:
        return [(v, f"when `{c['name']}` is {v:g}") for v in (lo + k * st for k in range(int((hi - lo) / st + 1e-9) + 1))]
    return None


def chance_read(x, values, derive, ctls, bad, seen=()):
    """What a chance field is: ("const", None, [v]), ("ctl", name, [v per state]), or None when the lint cannot read it
    (the page's clamp and frame sweep guard those). It reads a number (also '5'), a data number, a control, and a derive
    that comes down to one of these or to `at(list, control)`. `bad(msg)` gets what is provably wrong: a data list where
    a number is needed, or a list shorter than its control's states."""
    if NUM(x):
        return ("const", None, [x])
    if not isinstance(x, str):
        return None
    x = x.strip()
    try:
        return ("const", None, [float(x)])
    except ValueError:
        pass
    m = re.fullmatch(r"at\(\s*([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)\s*\)", x)
    if m:
        lst, c = values.get(m.group(1)), ctls.get(m.group(2))
        if m.group(1) in derive or not isinstance(lst, list) or c is None or ctl_states(c) is None:
            return None
        st = ctl_states(c)
        need = max(int(v) for v, _ in st) + 1 if all(float(v).is_integer() and v >= 0 for v, _ in st) else None
        if need is None:
            return None
        if len(lst) < need:
            what = f"the run `{c['name']}` has {need} frames" if "run" in c else f"`{c['name']}` reaches {need - 1}, so it needs {need}"
            bad(f"reads `{x}`, but `{m.group(1)}` has {len(lst)} entries and {what}: give one entry per state")
            return None
        out = [lst[int(v)] for v, _ in st]
        return ("ctl", c["name"], out) if all(NUM(q) for q in out) else None
    if not re.fullmatch(r"[A-Za-z_]\w*", x) or x in seen:
        return None
    if x in derive:
        d = derive[x]
        return chance_read(d, values, derive, ctls, bad, (*seen, x)) if NUM(d) or isinstance(d, str) else None
    if x in ctls:
        st = ctl_states(ctls[x])
        return ("ctl", x, [v for v, _ in st]) if st else None
    if NUM(values.get(x)):
        return ("const", None, [values[x]])
    if isinstance(values.get(x), list):
        bad(f"is `{x}`, a list in the data: name one number, or one entry of the list (`at({x}, draw)` in `derive`)")
    return None


def lint_chance(B, Lx, w, ch, names, s, values):
    """The lint proves, the page guards. Exactly two groups with two names, neither `gap` nor `noise step`; on each
    state a value can take, `n` whole 1–100, `ill` whole and at least 0, `step` above 0; together, only over states that
    can happen at once (one control, or constants), `ill` at most `n` and the gap at most 12 steps; `tally` one 0/1 per
    frame of the run. What the lint cannot read (arithmetic, say) passes: the page clamps it and the browser check warns."""
    if not isinstance(ch, dict):
        Lx.err(w, "`chance` is a mapping with `groups:` (two, each {name, n, ill}) and, if you like, `step:` and `tally:`")
        return
    def unknown(keys, known, what):
        for k in sorted(set(keys) - known, key=str):
            hit = next((q for q in sorted(known) if near(str(k), q)), None) or next(iter(difflib.get_close_matches(str(k), sorted(known), 1, .6)), None)
            Lx.err(w, f"{what} has no field `{k}`" + (f": did you mean `{hit}`?" if hit else f" (it takes {', '.join(sorted(known))})"))
    unknown(ch, CHANCE, "`chance`")
    derive = s.get("derive") if isinstance(s.get("derive"), dict) else {}
    ctls = {c["name"]: c for c in s.get("controls") or [] if isinstance(c, dict) and isinstance(c.get("name"), str)}
    run = next((c for c in ctls.values() if isinstance(c.get("run"), int)), None)
    MUST = {"n": "how many units the group has: a whole number from 1 to 100",
            "ill": "how many units have the outcome: a whole number from 0 to the group's n",
            "step": "one noise step as a share above 0"}
    def value(v, where, k):
        """The field read for the lint, or None (unread, or after an error that says which key and what it must be)."""
        if isinstance(v, bool) or not isinstance(v, (int, float, str)):
            Lx.err(w, f"{where} `{k}` is {v!r}: it must be {MUST[k]}, written as a number or a name from data, controls or derive")
            return None
        if isinstance(v, str):
            probe = B.Lint()   # the build's own name check; its finding goes out under this key's message
            B.check_expr(probe, w, v, names)
            if probe.out:
                Lx.err(w, f"{where} `{k}` is `{v}`: {probe.out[0][2].split(' (')[0]}; it must be {MUST[k]}")
                return None
        return chance_read(v, values, derive, ctls, lambda msg: Lx.err(w, f"{where} `{k}` {msg}"))
    def label(r, i):
        return ctl_states(ctls[r[1]])[i][1] if r[0] == "ctl" else ""
    def one(r, k, ok, where):
        """Each state the value can take, on its own; True when every state passes."""
        for i, q in enumerate(r[2]):
            if not ok(q):
                Lx.err(w, f"{where} `{k}` is {q:g}" + (f" {label(r, i)}" if r[0] == "ctl" else "") + f": it must be {MUST[k]}")
                return False
        return True
    def together(*rs):
        """The states these values can take at once: one tuple per state of their one control, or None (skip)."""
        if any(r is None for r in rs):
            return None
        cs = {r[1] for r in rs if r[0] == "ctl"}
        if len(cs) > 1:
            return None
        m = max(len(r[2]) for r in rs)
        c = next(iter(cs), None)
        return [(tuple(r[2][i] if r[0] == "ctl" else r[2][0] for r in rs), ctl_states(ctls[c])[i][1] if c else "") for i in range(m)]
    whole = lambda q: float(q).is_integer()
    gs = ch.get("groups")
    if not isinstance(gs, list) or len(gs) != 2:
        Lx.err(w, f"`chance` compares exactly two groups: write `groups:` as a list of two {{name, n, ill}}; got {len(gs) if isinstance(gs, list) else gs!r}")
        gs = [g for g in gs if isinstance(g, dict)][:2] if isinstance(gs, list) else []
    pairs, seen_names = [], {}
    for g in gs:
        if not isinstance(g, dict):
            Lx.err(w, f"a `chance` group is a mapping {{name, n, ill}}; got {g!r}")
            continue
        nm = g.get("name")
        unknown(g, CHANCE_GROUP, f"`chance` group `{nm}`")
        if not isinstance(nm, str) or not nm.strip():
            Lx.err(w, "each `chance` group needs `name:`: one or two words, its legend entry and linked word")
        elif chance_name(nm) in CHANCE_MARKS:
            Lx.err(w, f"a `chance` group is named `{nm}`, but `gap` and `noise step` are the figure's own marks: name the group for what it holds (`well`, `piped`)")
        elif chance_name(nm) in seen_names:
            Lx.err(w, f"both `chance` groups are named `{nm}`: each group's name is its legend entry and linked word, so give them two names (`well`, `piped`)")
        else:
            seen_names[chance_name(nm)] = nm
        where = f"`chance` group `{nm}`:"
        got = {}
        for k in ("n", "ill"):
            if g.get(k) is None:
                Lx.err(w, f"`chance` group `{nm}` needs `{k}:`: {MUST[k]}")
            else:
                got[k] = value(g[k], where, k)
        ns, xs = got.get("n"), got.get("ill")
        if ns and not one(ns, "n", lambda q: whole(q) and 1 <= q <= 100, where):
            ns = None
        if xs and not one(xs, "ill", lambda q: whole(q) and q >= 0, where):
            xs = None
        both = together(ns, xs)
        if both:
            hit = next(((q, top, lb) for (top, q), lb in both if q > top), None)
            if hit:
                q, top, lb = hit
                Lx.err(w, f"{where} `ill` is {q:g}" + (f" {lb}" if lb else "") + f" while `n` is {top:g}: it counts the units with the outcome, a whole number from 0 to n")
                ns = xs = None
        pairs += [ns, xs] if ns and xs else [None, None]
    if "step" in ch:
        st = None
        if ch["step"] is None:
            Lx.err(w, f"`chance` `step` is empty: it must be {MUST['step']} (leave `step` out and no ruler is drawn)")
        else:
            st = value(ch["step"], "`chance`", "step")
        if st and one(st, "step", lambda q: q > 0, "`chance`") and len(pairs) == 4:
            for (n1, x1, n0, x0, q), lb in together(*pairs, st) or []:
                steps = abs(x1 / n1 - x0 / n0) / q
                if steps > CHANCE_MOST + 1e-9:
                    Lx.err(w, f"`chance`: the gap is {f'{steps:.2f}'.rstrip('0').rstrip('.')} noise steps" + (f" {lb}" if lb else "")
                              + f"; a ruler counts up to {CHANCE_MOST}: check `step` is a share (0.05), not a percent (5)")
                    break
    if "tally" in ch:
        t = ch["tally"]
        lst = values.get(t) if isinstance(t, str) else t if isinstance(t, list) else None
        frames = run["run"] if run else 0
        if run is None:
            Lx.err(w, "`chance` `tally` marks each frame of a run, and this scene has none: add a run control (`controls: [{name: draw, run: 201}]`), or delete `tally`")
        elif not isinstance(lst, list):
            Lx.err(w, f"`chance` `tally` is {t!r}: name a data list with one 0 or 1 per frame of the run ({frames} frames)")
        elif len(lst) != frames:
            Lx.err(w, f"`chance` `tally` `{t if isinstance(t, str) else 'list'}` has {len(lst)} entries but the run has {frames} frames: give exactly one 0 or 1 per frame, frame 0 first")
        elif any(q not in (0, 1) or isinstance(q, bool) for q in lst):
            Lx.err(w, f"`chance` `tally` holds values other than 0 and 1: each frame is 1 when its gap is at least as far from 0 as ours, else 0")


def lint_refresher(B, Lx, deck, i, s, where):
    """A refresher is an end scene: after `next`, with an `ask` line, and linked from a step that needs it."""
    ref = s.get("beat") == "refresher"
    if s.get("ask") is not None and not ref:
        Lx.err(where, "`ask` is the link line of a `refresher` scene: give this scene `beat: refresher`, or delete `ask`")
    if not ref:
        return
    a = s.get("ask")
    if not isinstance(a, str) or not a.strip().endswith("?"):
        Lx.err(where, "a refresher needs `ask:`, the link line the step shows, as a question (\"Rusty on angles and cosine?\")")
    elif B.words(a) > SAY_WORDS:
        Lx.warn(where, f"the refresher's `ask` is {B.words(a)} words (≤ {SAY_WORDS}): name only what it refreshes")
    if not s.get("id"):
        Lx.err(where, "a refresher needs an `id`, so a step can link to it with `refresh: <id>`")
    elif not any(isinstance(st, dict) and st.get("refresh") == s["id"]
                 for t in deck.get("slides") or [] for st in as_list(t.get("steps"))):
        Lx.warn(where, f"no step links here: add `refresh: {s['id']}` to the step that first needs it")


def lint_refresh(Lx, deck, i, w, rid):
    """A step's `refresh` names a refresher scene at the end, after the step's own scene."""
    slides = deck.get("slides") or []
    k = next((k for k, t in enumerate(slides) if t.get("id") == rid), None)
    if k is None:
        Lx.err(w, f"`refresh: {rid}` names no scene: give the refresher scene `id: {rid}`")
    elif slides[k].get("beat") != "refresher":
        Lx.err(w, f"`refresh: {rid}` links to a `{slides[k].get('beat')}` scene: it links only to a scene with `beat: refresher`")
    elif k <= i:
        Lx.err(w, f"`refresh: {rid}` links back to an earlier scene: a refresher sits at the end, after `next`")


def lint_scenes(B, Lx, deck, glob, data=None):
    """Each board scene on its own: its fields, steps, items and controls."""
    symbols = deck.get("symbols") or {}
    values = {**(deck.get("data") or {}), **(data or {})}
    chances = {}  # one `chance` per scene
    forks = {}    # one `fork` per scene
    beads = {}    # one `beads` per scene
    said = []   # every teacher line so far, for "say what x is"
    for i, s in enumerate(deck.get("slides") or []):
        if s.get("type") != "board":
            continue
        named = []   # (where, mark, the step that draws it, from 1)
        where = f"slide {i + 1} (board “{str(s.get('title') or '')[:38]}”)"
        if s.get("beat") not in LESSON_BEATS:
            Lx.err(where, f"`beat` is {s.get('beat')!r}; use one of {', '.join(sorted(LESSON_BEATS))}")
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
            lint_table_style(Lx, where, s, values)
        steps = as_list(s.get("steps"))
        if not steps:
            Lx.err(where, "a board needs `steps`: one teacher line each")
        lint_controls(Lx, where, s, steps)
        if s.get("beat") == "what-if" and not any(k in it for _, it in items_of(s) if isinstance(it, dict) for k in ("chart", "plane", "compare", "image", "fork")):
            Lx.warn(where, "a what-if scene with no picture: add a `chart` or `plane` that the change moves, so the learner sees what moves")
        lint_sources(Lx, where, s.get("sources"), "scene `sources`")
        lint_refresher(B, Lx, deck, i, s, where)
        folds = [j + 1 for j, st in enumerate(steps) if isinstance(st, dict) and st.get("more") is not None]
        if len(folds) > 1:
            Lx.warn(where, f"steps {', '.join(map(str, folds))} each open extra reading: keep one `more` a scene, on the step that most needs it; put the rest in the scene's `more` (Context and limits)")
        for j, st in enumerate(steps):
            w = f"{where} step {j + 1}"
            if not isinstance(st, dict):
                Lx.err(w, "each step is a mapping with `say` (and `add`, `mark` or `think`)")
                continue
            if st.get("more") is not None:
                lint_more(B, Lx, w, st["more"])
            if st.get("refresh") is not None:
                lint_refresh(Lx, deck, i, w, st["refresh"])
            th = st.get("think")
            if isinstance(th, dict):
                for k in sorted(set(th) - {"q", "a", "set", "transfer"}, key=str):
                    Lx.err(w, f"`think` has no field `{k}` (it takes q, a, set and transfer)")
                tr = th.get("transfer")
                if tr is not None and not (isinstance(tr, str) and tr.strip()):
                    Lx.err(w, "`transfer` names the other field in a few words (\"spectral flow cytometry\")")
                elif tr is not None and B.words(tr) > TRANSFER_WORDS:
                    Lx.warn(w, f"`transfer` is {B.words(tr)} words (≤ {TRANSFER_WORDS}): name the field, and put the case in the question")
            for k in set(st) - STEP:
                Lx.err(w, f"unknown step field `{k}` (use {', '.join(sorted(STEP))})")
            if s.get("beat") == "plan" and st.get("say"):
                Lx.err(w, "the plan is its picture, so it has no lines of text: delete this `say` and keep the `flow`")
            elif not st.get("say") and not st.get("think") and not (s.get("beat") == "plan" and st.get("add")):
                Lx.err(w, "a step needs `say`: the teacher's one line for this step")
            if st.get("why") is not None and not (isinstance(st.get("why"), str) and st.get("say")):
                Lx.err(w, "`why` is the reason at the end of the step's `say`: give the step a `say`, and write `why` as one line of text")
            adds = [it for it in as_list(st.get("add")) if isinstance(it, dict)]
            if not st.get("why") and any(k in it for it in adds for k in OPS) \
                    and not any(isinstance(it.get("calc"), dict) and it["calc"].get("why") for it in adds):
                op = next(k for it in adds for k in OPS if k in it)
                Lx.warn(w, f"this step works a `{op}` but never says why: add `why:` (≤ {WHY_WORDS} words), the reason we do it or what it lets us do next")
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
                    # a mark shows at the later of its own step and the plane's: a mark can't come before its plane
                    named += [(w, mk, max(j + 1, mk["step"]) if isinstance(mk.get("step"), int) else j + 1) for mk in lint_plane(B, Lx, w, it["plane"], names)]
                if "space" in it:   # the same "say what it is" rule, for each legend entry
                    named += [(w, mk, max(j + 1, mk["step"]) if isinstance(mk.get("step"), int) else j + 1) for mk in lint_space(B, Lx, w, it["space"], names, symbols, values)]
                if "chance" in it:
                    lint_chance(B, Lx, w, it["chance"], names, s, values)
                    s_ch = chances.setdefault(id(s), [])
                    s_ch.append(j + 1)
                    if len(s_ch) == 2:
                        Lx.err(w, f"this scene has a second `chance` figure ({'both on step ' + str(s_ch[0]) if s_ch[0] == s_ch[1] else f'steps {s_ch[0]} and {s_ch[1]}'}): one `chance` per scene, so its marks `gap` and `noise step` name one thing; put the second comparison in its own scene")
                if "fork" in it:
                    lint_fork(Lx, w, it["fork"], values)
                    s_fk = forks.setdefault(id(s), [])
                    s_fk.append(j + 1)
                    if len(s_fk) == 2:
                        Lx.err(w, f"this scene has a second `fork` (steps {s_fk[0]} and {s_fk[1]}): one `fork` per scene, so one end is lit at a time; put the second in its own scene")
                if "beads" in it:
                    lint_beads(Lx, w, it["beads"], values)
                    s_bd = beads.setdefault(id(s), [])
                    s_bd.append(j + 1)
                    if len(s_bd) == 2:
                        Lx.err(w, f"this scene has a second `beads` (steps {s_bd[0]} and {s_bd[1]}): one `beads` per scene, so each ring's name is one mark; put the second in its own scene")
                if VIS & set(it):
                    vis = {x: (board_chart(y) if x == "chart" and isinstance(y, dict) else y) for x, y in it.items() if x != "id"}
                    B.lint_visual(Lx, w, vis, names, legend_marks=mark_entries(it.get("chart"), symbols))
                for at, ch in charts_of(it):
                    named += [(w, mk, max(j + 1, mk["step"]) if isinstance(mk.get("step"), int) else j + 1) for mk in lint_chart_marks(B, Lx, w + at, ch, symbols)]
                lint_formula(B, Lx, w, it.get("eqn"), "eqn", names, symbols)
                a = it.get("assemble")
                if a is not None:
                    lint_formula(B, Lx, w, a, "assemble", names, symbols)
                    if j == len(steps) - 1:
                        Lx.err(w, "`assemble` has a line between its numbers and its symbols: add a step after it that says what the symbols are")
                    if isinstance(a, dict) and a.get("lhs"):
                        names.add(a["lhs"])
                cp = it.get("compare")
                if cp is not None:
                    if not isinstance(cp, dict) or not all(isinstance(cp.get(k), dict) and cp[k].get("title") for k in "ab"):
                        Lx.err(w, "`compare` needs `a:` and `b:`, each with a `title` (and `text`, `tone`, `visual` as on a deck compare slide)")
                    else:
                        for k in "ab":
                            if isinstance(cp[k].get("visual"), dict):
                                B.lint_visual(Lx, f"{w} compare {k}", cp[k]["visual"], names, legend_marks=mark_entries(cp[k]["visual"].get("chart"), symbols))
                op = it.get("ops")
                if op is not None:
                    if not isinstance(op, dict):
                        Lx.err(w, "`ops` is a mapping with `matrix:` and `steps:`, as on a deck ops slide")
                    else:
                        names |= B.lint_ops(Lx, f"{w} ops", op, names, {})
                        need = len(as_list(op.get("steps")))
                        if j + need >= len(steps):
                            Lx.err(w, f"`ops` has {need} steps and each one takes a board step: add {j + need + 1 - len(steps)} more board step(s) after it, one teacher line per matrix step")
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
        # a name on the plot is a word the learner must know: the mark says it (hover), or a teacher line has named it by then
        lines = [st.get("say") for st in steps if isinstance(st, dict)]
        for w, mk, at in named:
            if not mk.get("says") and not explained(mk["name"], said + [x for x in lines[:at] if x], symbols):
                Lx.warn(w, f"say what {mk['name']} is: add says: to the mark, or name it in a teacher line first")
        said += [x for x in lines if x]




# ---- whole-lesson rules (lesson.md): the shape, the order numbers and symbols show in, and typed numbers

EXEMPT = ("operator", "index")   # a symbol of this `kind` has no number to show first
LINE_WORDS = 24                  # one teacher line, one breath (sketch's limit)
TRANSFER_WORDS = 6   # a transfer stop's field name: "spectral flow cytometry"
SAY_WORDS, NOTE_WORDS, ANSWER_WORDS = 14, 16, 18   # a lesson's limits: a say or a think question, a note, a think answer
WHY_WORDS = 12                   # a step's reason, in grey at the end of its line
OPS = ("calc", "col", "assemble")
FOLD_WORDS = 160                 # a step's extra reading, all paragraphs together   # items that compute: their step says why (a step `why`, or a calc's own `why`)
# learner.voice: `short` (the default) keeps the limits above; `full` lets a line run to 2 or 3 sentences, each one breath
VOICES = ("short", "full")
FULL = {"say": 50, "why": 24, "think q": 24, "think a": 40, "note": 30}   # by field; an item's `say` is a card label and keeps SAY_WORDS
SENTENCE = re.compile(r"(?<=[.?!])\s+(?=[A-Z0-9${(\"“'‘])")
PLAIN = {"a", "A", "I", "an", "as", "at", "be", "by", "do", "go", "if", "in", "is", "it", "no", "of", "on", "or", "so", "to", "up", "us", "we"}   # short symbol names that are also words
STEP_CAP, THINK_GAP = 10, 6      # steps in one scene; steps in a row with no think stop
SCENES = (8, 14)
CARDS = (5, 8)
# keys whose text the learner reads; a number typed here goes stale when the data changes
PROSE = {"say", "q", "a", "text", "note", "title", "lead", "subtitle", "question", "answer", "caption", "label", "sub", "says",
         "value", "alt", "points", "breaks", "why", "read", "more", "verdict", "next", "ask"}
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


def step_lines(st):
    """(field, text, word limit) for every line a learner reads in a step."""
    out = [("say", st.get("say"), SAY_WORDS), ("why", st.get("why"), WHY_WORDS)]
    t = st.get("think")
    if isinstance(t, dict):
        out += [("think q", t.get("q"), SAY_WORDS), ("think a", t.get("a"), ANSWER_WORDS)]
    elif isinstance(t, str):
        out.append(("think q", t, SAY_WORDS))
    for it in as_list(st.get("add")):
        if not isinstance(it, dict):
            continue
        for k in ("calc", "eqn", "assemble", "params"):
            if isinstance(it.get(k), dict):
                out.append((f"{k} say", it[k].get("say"), SAY_WORDS))
        if "note" in it:
            out.append(("note", it["note"].get("text") if isinstance(it["note"], dict) else it["note"], NOTE_WORDS))
    return out


# ---- linked words (board.md, Highlights in text): ==pixel== names a mark of the scene's plane, space or chart
HILITE = re.compile(r"==(.+?)==")
TOKEN = re.compile(r"^(accent|s[1-5]|good|bad|mist|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}):")   # a colour before the colon: no link (board.js `md`)
SPACE_DEF = {"points": "mist", "point": "ink", "ring": "ink", "vector": "ink", "sheet": "mist", "foot": "s2", "segment": "mist", "text": "mist"}   # board.js SDEF


def shown(v):
    """The words a line shows: a linked ==key:words== shows only its words (a colour token stays, as the deck counts it)."""
    return re.sub(r"==([^=:]+):", lambda m: m.group(0) if TOKEN.match(m.group(1) + ":") else "==", v)


def link_key(inner, keys):
    """The mark key a ==…== names, as board.js reads it: the whole text, else the part before a colon; None for none."""
    if TOKEN.match(inner):
        return None
    whole, c = inner.strip(), inner.find(":")
    return whole if whole in keys else inner[:c].strip() if c > 0 and inner[:c].strip() in keys else None


def scene_marks(s, symbols, data=None):
    """Each linkable mark of a board scene's plane, space and chart, in board.js's order: (figure no, kind, mark no, mark,
    the step it shows on, its keys, a legend entry or not, the colour its word takes or None for one of its own)."""
    out, f = [], 0
    for j, st in enumerate(as_list(s.get("steps"))):
        for it in as_list(st.get("add")) if isinstance(st, dict) else []:
            if not isinstance(it, dict):
                continue
            kind = next((k for k in ("plane", "space", "chart", "chance", "fork", "beads") if isinstance(it.get(k), dict)), None)
            if kind is None:
                continue
            if kind == "beads":   # one ring per record, named by its `name` column, in s1, s2, s3, s4 (board.js beads)
                cs = it["beads"].get("colors") if isinstance(it["beads"].get("colors"), list) else []
                for i, row in enumerate(beads_rows(it["beads"], data or {})[:BEADS_ROWS[1]]):
                    nm = row.get(it["beads"].get("name"))
                    if isinstance(nm, str) and nm.strip():   # a name that is not text is lint_beads' error
                        out.append((f, kind, i, {"label": nm}, j + 1, [nm.strip()], True, cs[i] if i < len(cs) else f"s{i + 1}"))
                f += 1
                continue
            if kind == "fork":   # each end, by its path's word and its name; told apart by which path lights, not by colour
                for i, e in enumerate(as_list(it["fork"].get("ends"))):
                    if isinstance(e, dict):
                        out.append((f, kind, i, {"label": e.get("via")}, j + 1, [str(x).strip() for x in (e.get("via"), e.get("name")) if x is not None and str(x).strip()], False, None))
                f += 1
                continue
            if kind == "chance":   # its marks, in board.js's order: the two groups, the gap, and with `step` the noise step
                ch, gs = it["chance"], [g for g in as_list(it["chance"].get("groups")) if isinstance(g, dict)][:2]
                mks = [(g.get("name"), g.get("color") or c) for g, c in zip(gs, ("s4", "s1"))] + [("gap", "s3")] + ([("noise step", "s2")] if "step" in ch else [])
                for i, (nm, c) in enumerate(mks):
                    if nm is not None and str(nm).strip():
                        out.append((f, kind, i, {"label": nm}, j + 1, [str(nm).strip()], True, c))
                f += 1
                continue
            for i, mk in enumerate(as_list(it[kind].get("marks"))):
                if not isinstance(mk, dict):
                    continue
                shows = max(j + 1, mk["step"]) if isinstance(mk.get("step"), int) else j + 1
                if kind == "chart":
                    q = mark_symbol(mk, symbols)
                    keys, entry, c = [mk.get("label"), mk.get("name"), mk.get("id"), q], mark_entry(mk, symbols) is not None, mark_color(mk, symbols, q)
                else:
                    k = next((x for x in (PLANE if kind == "plane" else SPACE) if x in mk and not (x == "ring" and "point" in mk)), None)
                    v = mk.get(k) if k else None
                    q = v if isinstance(v, str) and isinstance(symbols.get(v), dict) else None
                    keys = [mk.get("label"), mk.get("id"), q if k in ("vector", "point") else None]
                    entry = bool(mk.get("label")) and k not in ("text", None) and not (kind == "plane" and k == "points")
                    sc = (symbols[q].get("color") if q else None) if kind == "space" else None
                    if kind == "plane":
                        c = None if mk.get("rgb") is not None or k == "points" else "accent" if k == "ring" else mk.get("color") or ("s1" if k == "point" else "mist")
                    else:
                        c = (mk.get("color") or "accent") if mk.get("ring") is True else None if (mk.get("rgb") is not None and k in ("point", "points")) or (k == "sheet" and not mk.get("color")) \
                            else mk.get("color") or (sc if sc and sc != "ink" else None) or SPACE_DEF.get(k)
                out.append((f, kind, i, mk, shows, [str(x).strip() for x in keys if x is not None and str(x).strip()], entry, c))
            f += 1
    tb = s.get("table")
    if isinstance(tb, dict) and tb.get("style") == "slope" and isinstance(tb.get("group"), str):   # each group: a key entry and a linked word (board.js slopeFig)
        for i, (g, c, _) in enumerate(slope_groups(tb, slope_rows(tb, data or {}))):
            out.append((f, "slope", i, {"label": g}, 1, [g.strip()] if g.strip() else [], True, c))
    return out


def scene_texts(s):
    """(step, field, text) for every line of a board scene a word can link from: the lead (step 0), then each step's lines."""
    out = [(0, "lead", s.get("lead"))]
    for j, st in enumerate(as_list(s.get("steps"))):
        if isinstance(st, dict):
            out += [(j + 1, k, v) for k, v, _ in step_lines(st)]
    return [(j, k, v) for j, k, v in out if isinstance(v, str)]


def scene_keys(marks):
    keys = {}
    for m in marks:
        for k in m[5]:
            keys.setdefault(k, m)   # the first mark with a key wins, as on the page
    return keys


def near(a, b):
    """A likely typo of a mark key: the same but for case or a plural, or a few letters off in a longer word."""
    a, b = a.lower(), b.lower()
    if a == b or a.rstrip("s") == b.rstrip("s") or a.removesuffix("es") == b.removesuffix("es"):
        return True
    if min(len(a), len(b)) < 3 or abs(len(a) - len(b)) > 2:
        return False
    d = list(range(len(b) + 1))
    for x, ca in enumerate(a, 1):
        prev, d[0] = d[0], x
        for y, cb in enumerate(b, 1):
            prev, d[y] = d[y], min(d[y] + 1, d[y - 1] + 1, prev + (ca != cb))
    return d[-1] <= (2 if min(len(a), len(b)) >= 5 else 1)


def theme():
    """The board's colours by name, as the page draws them: the deck's theme, then the board's own values over it."""
    from pathlib import Path
    kit = Path(__file__).resolve().parent.parent / "kit/board.css"
    out = {}
    for f in (kit.parent.parent.parent / "deck/kit/vizos.css", kit):
        if f.exists():
            head = f.read_text().split("}")[0]   # the first rule block holds the page's theme (later blocks are light or print looks)
            out.update({k: v for k, v in re.findall(r"--([a-z][\w-]*):\s*(#[0-9a-fA-F]{3,6})\b", head)})
    return out


THEME = theme()


def rgb_of(c):
    """A colour name or hex as (r, g, b), or None when it is not one (a true colour, a CSS expression)."""
    h = THEME.get(str(c), str(c))
    if not re.fullmatch(r"#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}", h):
        return None
    h = h[1:] if len(h) == 7 else "".join(ch * 2 for ch in h[1:])
    return tuple(int(h[k:k + 2], 16) for k in (0, 2, 4))


def near_rgb(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5 <= 20   # out of 441: the same colour to the eye at body size


def lint_links(Lx, deck, data=None):
    """A mark with a legend entry has its linked word in the scene's text by the step that draws it; a ==word== that
    names no mark is no near-miss of one, nor a mark of another scene; two linked marks of one figure differ in colour;
    a plane `name:` whose mark has a linked word is not drawn."""
    symbols = deck.get("symbols") or {}
    slides = deck.get("slides") or []
    boards = [(i, s, scene_marks(s, symbols, data)) for i, s in enumerate(slides) if isinstance(s, dict) and s.get("type") == "board"]
    elsewhere = {}
    for i, s, marks in boards:
        for k in scene_keys(marks):
            elsewhere.setdefault(k, i)
    for i, s, marks in boards:
        where, keys = slide_where(i, s), scene_keys(marks)
        linked, told = {}, set()   # mark -> the first step a word links it; shared keys already reported
        for j, fld, v in scene_texts(s):
            for inner in HILITE.findall(v):
                k = link_key(inner, keys)
                if k is not None:
                    m = keys[k]
                    many = [x for x in marks if k in x[5]]
                    # the page would light the first; the author may mean another. A clash among `chance` marks alone is
                    # lint_chance's (`gap`/`noise step` as a group name, two groups with one name, two `chance` in a scene)
                    if len(many) > 1 and k not in told and not all(x[1] == "chance" for x in many):
                        told.add(k)
                        Lx.err(f"{where} step {j}" if j else where, f"`=={inner}==`: `{k}` names {len(many)} marks in this scene ("
                               + ", ".join(f"{x[1]} mark {x[2] + 1}" for x in many) + ("): rename one (a `chance` group's mark takes its `name:`; `gap` and `noise step` are fixed)"
                               if any(x[1] == "chance" for x in many) else "): give the one you mean its own `id:` and link that"))
                    linked[(m[0], m[2])] = min(linked.get((m[0], m[2]), j), j)
                    continue
                if TOKEN.match(inner):
                    continue
                pre = inner.split(":")[0].strip() if re.match(r"^[\w-]+:", inner) else None
                t = pre or inner.strip()
                w = f"{where} step {j}" if j else where
                if t in elsewhere and elsewhere[t] != i:
                    Lx.err(w, f"`=={inner}==` names a mark on slide {elsewhere[t] + 1}, not on this scene: a word links only to its own scene's figure; name a mark here, or reword it")
                elif len(t.split()) <= 2 and (hit := next((k for k in keys if near(t, k)), None)):
                    Lx.warn(w, f"`=={inner}==` names no mark, but is close to `{hit}`: write =={hit}== (or =={hit}:your words==) to link it; as written it is an orange underline")
                elif pre is not None:
                    Lx.warn(w, f"`=={inner}==`: `{pre}` is no colour and no mark of this scene, so the page shows “{inner}” underlined: use a colour (s1 …), a mark's label, or plain ==text==")
        for f, kind, i2, mk, shows, ks, entry, c in marks:
            name = ks[0] if ks else None
            if entry and name and linked.get((f, i2), 99) > shows:
                at, odd = linked.get((f, i2)), re.search(r"[{$\\]", name)   # a label with a number or maths: link it by an id
                fix = "give the mark a one-word `id:` and write ==id:your words==" if odd else f"write =={name}== (or =={name}:your words==)"
                Lx.warn(where, f"{kind} mark {i2 + 1} ({name}) has a legend entry but no linked word by step {shows}, when it shows"
                               + (f" (the first is at step {at})" if at else "") + f": {fix} in a teacher line by then, so the word takes its colour and lights it")
            if kind == "plane" and mk.get("name") and (f, i2) in linked:
                Lx.warn(where, f"plane mark {i2 + 1}: `name: {mk['name']}` is not drawn, since a linked word names the mark: delete `name:`"
                               + ("" if mk.get("label") else "; give the mark `label:` (its legend entry) and write ==label== in the text"))
        # colours compared as drawn: a theme name is its value (s1 is #5bfbcb), and two within a few steps of each other are one
        lk = [(f, ks[0], c, rgb_of(c)) for f, kind, i2, mk, shows, ks, entry, c in marks if (f, i2) in linked and c is not None]
        groups = []
        for x in lk:
            g = next((g for g in groups if g[0][0] == x[0] and (str(g[0][2]).lower() == str(x[2]).lower() or (g[0][3] and x[3] and near_rgb(g[0][3], x[3])))), None)
            (g.append(x) if g else groups.append([x]))
        for g in groups:
            if len(g) > 1:
                ns, cs = ", ".join(f"=={x[1]}==" for x in g), sorted({str(x[2]) for x in g})
                col = f"the colour {cs[0]}" if len(cs) == 1 else f"colours that look the same ({', '.join(cs)})"
                Lx.warn(where, f"linked words {ns} all take {col} in one figure, so the learner cannot tell which mark a word means: give each mark its own `color:`")


def lint_bare(Lx, deck, data=None):
    """A symbol's name in plain words stays grey: written as $w_0$ it takes its colour. A linked ==H== is its TeX."""
    names = [k for k, v in (deck.get("symbols") or {}).items() if isinstance(v, dict) and (len(k) <= 2 or re.search(r"\d", k)) and k not in PLAIN]
    if not names:
        return
    bare = re.compile(r"(?<![\w$.'’-])(" + "|".join(map(re.escape, sorted(names, key=len, reverse=True))) + r")(?![\w'’-])")
    for i, s in enumerate(deck.get("slides") or []):
        if s.get("type") != "board":
            continue
        keys = scene_keys(scene_marks(s, deck.get("symbols") or {}, data))
        unlink = lambda v: HILITE.sub(lambda m: " " if link_key(m.group(1), keys) else m.group(0), v)
        for j, st in enumerate(as_list(s.get("steps"))):
            if not isinstance(st, dict):
                continue
            for k, v, _ in step_lines(st):
                m = isinstance(v, str) and bare.search(re.sub(r"==\w+:", " ", HIDE.sub(" ", unlink(v))))
                if m:
                    t = (deck["symbols"][m.group(1)].get("tex") or m.group(1))
                    Lx.warn(f"{slide_where(i, s)} step {j + 1}", f"`{k}` writes {m.group(1)} in plain words: write ${t}$ so it takes its colour")


def voice_of(Lx, deck):
    """The lesson's voice from `learner.voice`: short (the default) or full."""
    learner = deck.get("learner") if isinstance(deck.get("learner"), dict) else {}
    v = learner.get("voice", "short")
    if v not in VOICES:
        Lx.err("learner", f"`voice: {v!r}` is `short` (lines inside the word limits, the default) or `full` (2 or 3 short sentences a line)")
        return "short"
    return v


def lint_words(B, Lx, where, k, v, cap, voice):
    """One line against its voice: short counts the line; full counts the line and each sentence in it."""
    if voice == "full" and k in FULL:
        n = B.words(shown(v))
        if n > FULL[k]:
            Lx.warn(where, f"`{k}` has {n} words (≤ {FULL[k]} in the full voice): split it over two steps")
        for t in SENTENCE.split(v.strip()):
            if B.words(shown(t)) > LINE_WORDS:
                Lx.warn(where, f"`{k}` has a sentence of {B.words(shown(t))} words (≤ {LINE_WORDS}): the full voice writes more sentences, "
                               f"not longer ones. Split it: “{t[:50]}…”")
    elif B.words(shown(v)) > cap:
        Lx.warn(where, f"`{k}` has {B.words(shown(v))} words (≤ {cap}): one teacher line is one breath; cut it, or move the rest to the next step"
                       + (" (or ask the learner for the full voice, `learner.voice: full`)" if k in FULL else ""))
    if ";" in re.sub(r"\$[^$]*\$|\{\{[^}]*\}\}", "", v):
        Lx.warn(where, f"`{k}` joins two thoughts with “;”: write two sentences, linked by a word such as So, But or Because")


def lint_sources(Lx, w, src, what):
    """Each source a reader may open: a title, a real link, and why it is worth reading."""
    if src is None:
        return
    if not isinstance(src, list):
        Lx.err(w, f"{what} is a list of `{{title, url, why}}`")
        return
    for k, x in enumerate(src, 1):
        if not (isinstance(x, dict) and isinstance(x.get("title"), str) and isinstance(x.get("url"), str) and isinstance(x.get("why"), str)):
            Lx.err(w, f"{what} {k} needs `title`, `url` and `why` (what the reader gets from it), each as text")
        elif not re.match(r"https://\S+$", x["url"]):
            Lx.err(w, f"{what} {k}: `url` is a full https:// link to the page you read, not “{x['url'][:40]}”")


def lint_more(B, Lx, w, m):
    """A step's extra reading: a real question, paragraphs in short sentences, and the sources used."""
    if not isinstance(m, dict) or not isinstance(m.get("ask"), str) or not m.get("answer"):
        Lx.err(w, "`more` is `{ask, answer, sources}`: the question it answers, its paragraphs, and any pages read for it")
        return
    for k in set(m) - {"ask", "answer", "sources"}:
        Lx.err(w, f"`more` has no field `{k}` (use ask, answer, sources)")
    ask = m["ask"].strip()
    if not ask.endswith("?"):
        Lx.warn(w, f"`more` ask “{ask[:40]}” is the learner's question, ending in `?`")
    if B.words(shown(ask)) > SAY_WORDS:
        Lx.warn(w, f"`more` ask has {B.words(shown(ask))} words (≤ {SAY_WORDS}): it is the fold's one-line label")
    paras = m["answer"] if isinstance(m["answer"], list) else [m["answer"]]
    if not all(isinstance(p, str) for p in paras):
        Lx.err(w, "`more` answer is a paragraph of text, or a list of them")
        return
    n = sum(B.words(shown(p)) for p in paras)
    if n > FOLD_WORDS:
        Lx.warn(w, f"`more` holds {n} words (≤ {FOLD_WORDS}): keep the reason that matters most, and point to a source for the rest")
    for p in paras:
        for t in SENTENCE.split(p.strip()):
            if B.words(shown(t)) > LINE_WORDS:
                Lx.warn(w, f"`more` has a sentence of {B.words(shown(t))} words (≤ {LINE_WORDS}): split it: “{t[:50]}…”")
        if ";" in re.sub(r"\$[^$]*\$|\{\{[^}]*\}\}", "", p):
            Lx.warn(w, "`more` joins two thoughts with “;”: write two sentences, linked by a word such as So, But or Because")
    lint_sources(Lx, w, m.get("sources"), "`more` source")


def lint_shape(B, Lx, slides, voice="short"):
    """R1, R2, R6 and the lead rule: the beats in order, the size of the lesson, and a think stop every few steps."""
    for i, s in enumerate(slides):
        if s.get("type") == "quiz":
            Lx.err(slide_where(i, s), "a class lesson has no quiz cards: delete this slide, and keep any question worth asking as a `think` stop on a step")
    scenes = [(i, s, beat_of(s)) for i, s in enumerate(slides) if (s.get("type") or "idea") not in ("title", "quiz") and s.get("beat") != "refresher"]
    if not scenes:
        return
    lo, hi = SCENES
    if not lo <= len(scenes) <= hi:
        Lx.warn("lesson", f"{len(scenes)} scenes; a lesson is {lo}–{hi}, not counting the title: "
                + ("split it into a What / How / Why series" if len(scenes) > hi else "add the beats it is missing (plan, problem, by-hand, formula, limits, summary, next)"))
    beats = [b for _, _, b in scenes]
    i0, s0, b0 = scenes[0]
    if b0 != "plan":
        Lx.warn(slide_where(i0, s0), "the first scene after the title is a `plan` scene: say what we will do, in order")
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
            if (s.get("type") or "idea") != "quiz" and s.get("beat") != "refresher":
                Lx.warn(slide_where(k, s), "the `next` tease is the last scene: move this slide before it")
    # the transfer stop: the same move in another field, once a lesson, in its last third (the learner has the method by then)
    tstops = [(k, i, s) for k, (i, s, _) in enumerate(scenes) for st in as_list(s.get("steps"))
              if isinstance(st, dict) and isinstance(st.get("think"), dict) and isinstance(st["think"].get("transfer"), str)]
    third = len(scenes) - -(-len(scenes) // 3)
    if not tstops:
        Lx.warn("lesson", "no transfer stop: near the end, ask where the same move works in another field, as a `think` with `transfer: <field>`")
    for k, i, s in tstops:
        if k < third:
            Lx.warn(slide_where(i, s), f"a transfer stop in scene {k + 1} of {len(scenes)}: put it in the last third (scene {third + 1} or later), once the method is known")
    last = scenes[-1][0]   # the story's last scene; refreshers come after it
    for k, s in enumerate(slides[:last]):
        if s.get("beat") == "refresher":
            Lx.warn(slide_where(k, s), "a refresher sits at the end, after the `next` tease, so the story runs on: move this scene there")
    gap, planned = 0, False
    for i, s in enumerate(slides):
        if (s.get("type") or "idea") != "board":
            continue
        w = slide_where(i, s)
        if planned and not s.get("lead"):
            Lx.warn(w, "no `lead`: one short line that links this scene to the last")
        planned = planned or s.get("beat") == "plan"
        steps = as_list(s.get("steps"))
        if len(steps) > STEP_CAP:
            Lx.warn(w, f"{len(steps)} steps (≤ {STEP_CAP}): a scene that long is hard to hold in mind, so split it in two")
        for j, st in enumerate(steps):
            if not isinstance(st, dict):
                continue
            gap = 0 if st.get("think") else gap + 1
            if gap >= THINK_GAP:
                Lx.warn(f"{w} step {j + 1}", f"{THINK_GAP} steps in a row with no `think` stop: ask the learner something before going on")
                gap = 0
            for k, v, cap in step_lines(st):
                if isinstance(v, str):
                    lint_words(B, Lx, f"{w} step {j + 1}", k, v, cap, voice)


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
        self.num, self.sym, self.hand, self.drawn = {}, {}, set(), {}
        tex = [(n, str(v.get("tex"))) for n, v in symbols.items() if isinstance(v, dict) and v.get("tex") and v.get("kind") not in EXEMPT]
        self.tex = sorted(tex, key=lambda x: -len(x[1]))   # longest first, so s^2 is read before s

    @staticmethod
    def first(d, n, pos, val=None):
        """Keep the earliest click, not the first one scanned: a mark with `step:` is scanned before later steps."""
        if n not in d or pos < (d[n][0] if val is not None else d[n]):
            d[n] = pos if val is None else (pos, val)

    def number(self, names, pos, by_hand=False):
        for n in names:
            if n:
                self.first(self.num, n, pos)
                if by_hand:
                    self.hand.add(n)

    def draw(self, names, pos, by_hand=False):
        """A matrix or vector drawn as `name = [numbers]`: its number shows, and it may be used by name after."""
        self.number(names, pos, by_hand)
        for n in names:
            self.first(self.drawn, n, pos)

    def maths(self, tex, pos, by_hand=False, lhs=None):
        """\\mat{id} in a formula shows id's numbers; it draws id only when the formula also writes `id =` (its TeX or
        [id], or the `lhs`), so the learner sees the name beside the brackets once before a line uses it."""
        ids = MATREF.findall(tex)
        self.number(ids, pos, by_hand)
        full = (f"[{lhs}] = " if lhs else "") + tex
        for n in ids:
            v = self.symbols.get(n) if isinstance(self.symbols.get(n), dict) else {}
            names = [re.escape(f"[{n}]")] + ([r"(?<![A-Za-z\\])" + re.escape(str(v["tex"]))] if v.get("tex") else [])
            if re.search(r"(?:" + "|".join(names) + r")\s*=", full):
                self.first(self.drawn, n, pos)

    def symbol(self, names, pos, what):
        for n in names:
            v = self.symbols.get(n)
            if isinstance(v, dict) and v.get("kind") not in EXEMPT:
                self.first(self.sym, n, pos, what)

    def text(self, s, pos, by_hand=False):
        """`{{x}}` shows x's number; a symbol's TeX inside $...$ shows its symbol."""
        self.number(expr_names(self.B, s), pos, by_hand)
        for m in re.findall(r"\$([^$]+)\$", re.sub(r"`[^`]*`", " ", s)):   # \mat draws only inside maths
            self.maths(m, pos, by_hand)
            m = PRODPART.sub(" ", MATREF.sub(" ", EXPRS.sub(" ", m)))   # a {{x}} (or a product's number) shows a number, not a symbol
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
            L.maths(str(s.get("tex") or ""), (i, 0), lhs=s.get("lhs"))
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
            for k in ("matrix", "vec"):
                if isinstance(it.get(k), str):
                    L.draw([it[k]], p, hand)
                    L.symbol([it[k]], p, f"a `{k}` item")
            if isinstance(c, dict) and c.get("expr"):
                ids = B.idents(c["expr"]) + as_list(c.get("name"))
                L.number(ids, p, hand)
                L.symbol(ids, p, "a worked line")
            if isinstance(e, dict):
                L.symbol(as_list(e.get("_uses")), p, "a `product` item")   # a product's lines use its m and v (product.py)
                L.draw(as_list(e.get("_draws")), p, hand)                     # and its last line draws its result
                L.maths(str(e.get("tex") or ""), p, hand, e.get("lhs"))
                ids = (B.idents(e["expr"]) if e.get("expr") else TERM.findall(str(e.get("tex") or ""))) + as_list(e.get("lhs"))
                L.symbol(ids, p, "an equation")
                if e.get("expr"):
                    L.number(ids, p, hand)
            if isinstance(a, dict):   # numbers row on this click, symbols row on the next
                L.maths(str(a.get("plug") or ""), p, hand, a.get("lhs"))
                L.maths(str(a.get("tex") or ""), (i, j + 1), hand, a.get("lhs"))
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
        k = symbols[n].get("kind")
        if k in OBJ:   # show before using: a matrix or vector is drawn with its numbers before its name is used
            d = L.drawn.get(n)
            if d is None or d > (i, j):
                Lx.err(slide_where(i, slides[i]), f"`{n}` (${symbols[n].get('tex') or n}$) is a {k} used on {at(i, j)} ({what}) before it is drawn with its numbers"
                       f"{' (first drawn on ' + at(*d) + ')' if d else ''}: draw it first with `add: {{{OBJ[k]}: {n}}}`, or as `{symbols[n].get('tex') or n} = \\mat{{{n}}}` in a formula")
            continue
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


def shape_of(v):
    """(rows, columns) of a list of equal rows of numbers, (n, None) of a flat list of numbers, else None."""
    num = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool)
    if isinstance(v, list) and v and all(num(x) for x in v):
        return len(v), None
    if isinstance(v, list) and v and all(isinstance(r, list) and r and all(num(x) for x in r) for r in v) and len({len(r) for r in v}) == 1:
        return len(v), len(v[0])
    return None


def strings(node):
    if isinstance(node, dict):
        for v in node.values():
            yield from strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from strings(v)
    elif isinstance(node, str):
        yield node


def lint_objects(Lx, deck, data, glob):
    """A `kind: matrix|vector` symbol: its numbers are in the data, in that shape, with one colour per column or row;
    every `matrix`, `vec` item and \\mat{} names such a symbol."""
    symbols = deck.get("symbols") or {}
    values = {**(deck.get("data") or {}), **(data or {})}
    glob = set(glob) | {k for s in deck.get("slides") or [] if isinstance(s.get("derive"), dict) for k in s["derive"]}
    for n, v in symbols.items():
        if not isinstance(v, dict):
            continue
        k, w = v.get("kind"), f"symbols.{n}"
        if k not in OBJ:
            if v.get("cols") is not None or v.get("rows") is not None:
                Lx.err(w, "`cols:` and `rows:` colour a matrix or a vector: add `kind: matrix` or `kind: vector`")
            continue
        same = [m for m, u in symbols.items() if m != n and isinstance(u, dict) and v.get("tex") and norm_name(u.get("tex", "")) == norm_name(v["tex"])]
        if same:
            Lx.err(w, f"`{n}` and `{same[0]}` are both written ${v['tex']}$: a {k} needs its own TeX, so the learner can tell which one a line means")
        if v.get("cols") is not None and v.get("rows") is not None:
            Lx.err(w, "give `cols:` or `rows:`, not both: a cell takes one colour")
        if k == "vector" and v.get("cols") is not None:
            Lx.err(w, "a vector takes `rows:` (one colour per entry), not `cols:`")
        if v.get("fmt") is not None and (isinstance(v["fmt"], bool) or not isinstance(v["fmt"], int)):
            Lx.err(w, f"a {k}'s `fmt` is its number of decimals (`fmt: 1`); `{v['fmt']}` does not apply to brackets")
        if n not in values:
            if n not in glob:
                Lx.err(w, f"`kind: {k}` draws `{n}` from the data, but data.json has no `{n}`: write its numbers in make_data.py")
            continue
        sh = shape_of(values[n])
        if sh is None:
            Lx.err(w, f"`{n}` in the data is not a list of numbers (a vector) or a list of equal rows of numbers (a matrix)")
            continue
        r, c = sh
        if k == "matrix" and c is None:
            Lx.err(w, f"`{n}` is a flat list of {r} numbers, a vector: write `kind: vector`, or make it a list of rows")
            continue
        if k == "vector" and c is not None:
            Lx.err(w, f"`{n}` is {r} rows of {c}, a matrix: write `kind: matrix`, or make it a flat list")
            continue
        for f, want in (("cols", c), ("rows", r)):
            got = v.get(f)
            if got is not None and want is not None and (not isinstance(got, list) or len(got) != want):
                Lx.err(w, f"`{f}:` gives {len(got) if isinstance(got, list) else 1} colour(s), but `{n}` has {want} {'columns' if f == 'cols' else 'rows'}: one colour each")
    def ref(where, n, item=None):
        v = symbols.get(n)
        if not isinstance(v, dict):
            Lx.err(where, f"`{n}` is not a symbol: add `{n}: {{tex: ..., says: ..., kind: matrix}}` (or `kind: vector`) under symbols")
        elif v.get("kind") not in OBJ:
            Lx.err(where, f"`{n}` has no `kind: matrix` or `kind: vector`, so it cannot be drawn in brackets: add the kind")
        elif item and OBJ[v["kind"]] != item:
            Lx.err(where, f"`{n}` is a {v['kind']}: draw it with `{OBJ[v['kind']]}: {n}`, not `{item}: {n}`")
    def places(n, d):
        """The decimals \\mat{n|d} shows, as slides.js picks them; None when the data cannot say (a derived name)."""
        v = symbols.get(n) if isinstance(symbols.get(n), dict) else {}
        if d:
            return int(d)
        if isinstance(v.get("fmt"), int) and not isinstance(v.get("fmt"), bool):
            return v["fmt"]
        sh = shape_of(values.get(n))
        if sh is None:
            return None
        flat = [x for r in values[n] for x in (r if isinstance(r, list) else [r])]
        return max(next((p for p in (0, 1, 2) if abs(round(x, p) - x) < 1e-9), 2) for x in flat)
    for i, s in enumerate(deck.get("slides") or []):
        w = slide_where(i, s)
        for n in dict.fromkeys(m for x in strings(s) for m in MATREF.findall(x)):
            ref(w, n)
        for k, x in prose(s):
            if MATREF.search(re.sub(r"`[^`]*`|\$[^$]*\$", " ", x)):
                Lx.err(w, f"`{k}` has \\mat{{…}} outside $…$, where it shows as plain text: write it inside $…$")
        for x in strings(s):
            for f in re.findall(r"\$([^$]+)\$", x) or [x]:
                ds = {places(n, d) for n, d in re.findall(r"\\mat\{([A-Za-z_]\w*)(?:\|(\d))?\}", f)} - {None}
                if len(ds) > 1:
                    Lx.warn(w, f"one formula shows its \\mat objects with {' and '.join(map(str, sorted(ds)))} decimals: use one format across it (\\mat{{X|d}})")
        for _, it in items_of(s):
            for k in ("matrix", "vec"):
                if k in it:
                    if not isinstance(it[k], str):
                        Lx.err(w, f"`{k}:` takes a symbol's name: `add: {{{k}: X}}`")
                        continue
                    ref(w, it[k], k)
                    extra = set(it) - {k, "id"} - ({"row"} if k == "vec" else set())
                    if extra:
                        Lx.err(w, f"`{k}: {it[k]}` takes only `id`{' and `row: true`' if k == 'vec' else ''}; got {', '.join(sorted(extra))}")


SHORT_WORDS = 2
FILLER = {"a", "an", "the", "of", "level", "value", "its", "each", "for", "in", "on", "to", "is"}   # words that add nothing to a name


def card_symbols(B, deck):
    """The symbols whose name opens a pop-up card on the board: a formula's terms and left side, a worked line's inputs and
    result, and every matrix or vector drawn in brackets."""
    out = set()
    for s in deck.get("slides") or []:
        if s.get("type") != "board":
            continue
        for x in strings(s):
            out |= set(MATREF.findall(x)) | {q for t in PRODREF.findall(x) for q in t}
        for _, it in items_of(s):
            for k in ("matrix", "vec"):
                if isinstance(it.get(k), str):
                    out.add(it[k])
            for _, ch in charts_of(it):   # a chart mark whose value is a symbol opens that symbol's card
                out |= {q for mk in as_list(ch.get("marks")) if isinstance(mk, dict) for q in [mark_symbol(mk, deck.get("symbols") or {})] if q}
            for k in ("eqn", "assemble", "calc"):
                f = it.get(k)
                if isinstance(f, dict):
                    out |= set(TERM.findall(str(f.get("tex") or ""))) | {n for n, _ in TAGGED.findall(str(f.get("plug") or ""))}
                    out |= set(B.idents(str(f.get("expr") or ""))) | set(as_list(f.get("lhs"))) | set(as_list(f.get("name")))
    return out


def lint_names(B, Lx, deck):
    """A symbol that opens a card has a `short` name of at most 2 words, and its `says` adds words beyond that name."""
    words_of = lambda t: re.findall(r"[a-z0-9]+", L_plain(t).lower())
    symbols = deck.get("symbols") or {}
    used = card_symbols(B, deck)
    for n, v in symbols.items():
        if not isinstance(v, dict):
            continue
        w, short = f"symbols.{n}", v.get("short")
        if short is not None and len(str(short).split()) > SHORT_WORDS:
            Lx.err(w, f"`short` “{short}” has {len(str(short).split())} words: a name is {SHORT_WORDS} words at most (the card's bold title); the rest goes in `says`")
        if n in used and not short:
            Lx.err(w, f"`{n}` opens a pop-up card on the board, so it needs `short:` (its name, {SHORT_WORDS} words at most)")
        if short and v.get("says"):
            extra = set(words_of(v["says"])) - set(words_of(short)) - FILLER
            if not extra:
                Lx.warn(w, f"`says` “{v['says']}” only repeats `short` “{short}”: say what it means, what it is made from, or where it sits")
    groups = {}
    for n, v in symbols.items():
        if isinstance(v, dict) and v.get("short"):
            groups.setdefault(str(v["short"]).strip().lower(), []).append(n)
    for ns in groups.values():
        texs = {str(symbols[n].get("tex") or n) for n in ns}
        if len(texs) > 1:
            both = ", ".join(f"{n} (${symbols[n].get('tex') or n}$)" for n in ns)
            Lx.warn(f"symbols.{ns[0]}", f"{both} all have `short` “{symbols[ns[0]]['short']}”: a legend or a card cannot tell them apart; give each its own 2-word `short`")


ID_WORD = re.compile(r"(?<![\w$\\{])[A-Za-z]+\d+[A-Za-z0-9]*(?![\w}])")   # a name with a digit: c1, C1, PC2, CD19


def lint_case(Lx, deck, data):
    """Two names the learner reads that differ only in case (cell c1 and centre C1) read as one name: rename one."""
    seen = {}   # lower -> {form: first place}
    def note(t, where):
        for m in ID_WORD.findall(L_plain(re.sub(r"\{\{.*?\}\}|\$[^$]*\$", " ", str(t)))):   # a {{number}} or $maths$ is no name
            seen.setdefault(m.lower(), {}).setdefault(m, where)
    for n, v in (deck.get("symbols") or {}).items():
        if isinstance(v, dict):
            for k in ("short", "says"):
                if v.get(k):
                    note(v[k], f"symbols.{n}")
    for i, sl in enumerate(deck.get("slides") or []):
        for _, t in prose(sl):
            note(t, slide_where(i, sl) if isinstance(sl, dict) else f"slide {i + 1}")
    def froms(node):
        if isinstance(node, dict):
            t = node.get("table")
            if isinstance(t, dict) and isinstance(t.get("from"), str):
                yield t["from"]
            for x in node.values():
                yield from froms(x)
        elif isinstance(node, list):
            for x in node:
                yield from froms(x)
    for f in set(froms(deck.get("slides") or [])):   # a table shows its rows' words (cell ids)
        v = {**(deck.get("data") if isinstance(deck.get("data"), dict) else {}), **(data or {})}.get(f)
        for r in (v if isinstance(v, list) else []):
            for x in (r.values() if isinstance(r, dict) else []):
                if isinstance(x, str):
                    note(x, "data.json")
    for forms in seen.values():
        if len(forms) > 1:
            (a, wa), (b, wb) = list(forms.items())[:2]
            Lx.warn(wb, f"“{a}” ({wa}) and “{b}” differ only in case: a learner reads them as one name; rename one in plain words (cell c1, Centre 1)")


COLOUR_MARK = re.compile(r"==[\w-]+:(.*?)==")   # ==s3:red part== colours its text; keep the text
LEAD_WORD = {"note", "tip", "hint", "example", "why", "check", "recall", "key", "step", "answer", "caution", "warning", "idea", "rule", "result"}
PLAIN_SIDE = re.compile(r"^(?=.*[^\W\d_])[^$`{}\\\d]+$")   # words with a letter: no digit, $maths$, {{number}} or `code`


def two_part(t):
    """`Red steps: red part`: two short plain phrases joined by a colon, which reads as made-up shorthand."""
    if not isinstance(t, str):
        return False
    parts = re.sub(r"[：∶]", ":", COLOUR_MARK.sub(r"\1", t)).strip().split(":")
    if len(parts) != 2:
        return False
    left, right = (p.strip() for p in parts)
    if left.lower() in LEAD_WORD:
        return False
    return all(PLAIN_SIDE.match(p) and len(p.split()) <= 4 for p in (left, right))


FILLER_LEAD = re.compile(r"^(?:(?:please|now|then|next|first|so|just|ok)\b[\s,]*)+", re.I)
PAGE_VERB = re.compile(r"^(?:press|click|tap|drag|scroll|hover|watch|look|(?:move|slide|try|use) the (?:slider|toggle|dial|button|play))\b", re.I)
CLAUSE = re.compile(r"\s+(?:and|as|while|until|when|so)\s+|[;,]", re.I)


def page_only(sentence):
    """Every clause of 2 or more words starts with a page verb (press, drag, watch …): the sentence says nothing that happens."""
    clauses = [FILLER_LEAD.sub("", c.strip(" .!?")).strip() for c in CLAUSE.split(sentence)]
    if not PAGE_VERB.match(clauses[0]):
        return False
    return all(PAGE_VERB.match(c) or len(c.split()) < 2 for c in clauses)


def instruction_only(say):
    """Every sentence of the line tells the learner to work the page; none says what is shown or what happens."""
    if not isinstance(say, str) or not say.strip() or "{{" in say:
        return False
    parts = [p for p in re.split(r"(?<=[.!?])\s+", HIDE.sub("N", say).strip()) if p.strip()]
    return all(page_only(p) for p in parts)


def lint_story(Lx, deck):
    """A label is a plain phrase, not `A: B` shorthand; a teacher line says what happened, not only what to press."""
    for i, s in enumerate(deck.get("slides") or []):
        if s.get("type") != "board":
            continue
        for j, st in enumerate(as_list(s.get("steps"))):
            if not isinstance(st, dict):
                continue
            w = f"{slide_where(i, s)} step {j + 1}"
            if instruction_only(st.get("say")):
                Lx.warn(w, f"`say` “{st['say']}” only says what to do on the page: say what changes, with its number (‘the area falls to {{{{area|2}}}}’)")
            for it in as_list(st.get("add")):
                if not isinstance(it, dict):
                    continue
                for k, f in (("calc", "say"), ("eqn", "say"), ("assemble", "say"), ("col", "label")):
                    t = it[k].get(f) if isinstance(it.get(k), dict) else None
                    if two_part(t):
                        Lx.warn(w, f"`{k} {f}` “{t}” reads as made-up shorthand: say it as one plain phrase (‘red light that lands in red’)")


# ---- adv lessons (adv.md): each scene names its idea, the one mark that carries it (`see`) and the picture (`shows`).
# The idea table: name -> (the learner's question, the picture family, the items that can draw it today). `table` is
# the scene's own table; `product` is a worked product (product.py opens it into lines that hold \prodpart).
IDEAS = {
    "made-of": ("where does this number come from?", "loupe", ["table", "calc", "product", "vec", "matrix", "strip"]),
    "amount": ("how much, what share?", "units", ["units", "parts", "stat", "chance", "beads"]),
    "cause": ("what happens if I change this?", "handle", ["plane", "chart", "space", "dist"]),
    "closest": ("which choice is best?", "guess", ["plane", "space"]),
    "shortcut": ("why not the easy way?", "ghost", ["plane", "space", "chart", "compare"]),
    "process": ("how does it move, step by step?", "run", ["plane", "chart", "space", "ops"]),
    "connect": ("how do the pieces feed each other?", "strip", ["flow", "ops", "product", "assemble"]),
    "outcomes": ("what can happen?", "fork", ["fork", "compare", "parts"]),
    "chance": ("is this difference real?", "draws", ["chance", "dist", "chart"]),
    "angle": ("what does it look like from the right side?", "view", ["space", "plane"]),
    "like": ("what is it like?", "pair", ["compare"]),
}
BOOKENDS = ("plan", "summary", "next")      # scenes that carry no idea
FOIL = ("misconception", "limits")          # beats that draw the wrong way beside the right way, as `shortcut` does
DEPTH = 2                                   # scenes one idea may fill, unless learner.depth says more
FIGS = ("plane", "space", "chart", "dist", "chance")  # figures a control or a later mark can change on one frame
SEEN = ("lead", "say", "think q")           # lines the learner reads without pressing Show answer


ADV_FIELDS = ("idea", "see", "shows")


def adv_boards(deck):
    """The scenes an adv plan is made of: the board scenes, in order (the lint and storyboard.py share this rule)."""
    return [s for s in deck.get("slides") or [] if isinstance(s, dict) and s.get("type") == "board"]


def is_adv(deck):
    return any(s.get("idea") is not None for s in adv_boards(deck))


def adv_only(deck):
    """(where, message) for each adv-only figure or field in a plain lesson. Reads the raw deck: hunt, split, views and strip are rewritten before the lint."""
    if is_adv(deck):
        return []
    fix = "is for adv lessons only (no board scene has `idea:`): add `idea:`, `see:` and `shows:` to the board scenes (adv.md §2), or draw it another way"
    out = [("learner", f"`learner.depth` {fix}")] if "depth" in (deck.get("learner") if isinstance(deck.get("learner"), dict) else {}) else []
    for i, s in enumerate(adv_boards(deck)):
        for j, st in enumerate(as_list(s.get("steps"))):
            st = st if isinstance(st, dict) else {}
            found = ["hunt"] if "hunt" in st else []
            for it in as_list(st.get("add")):
                it = it if isinstance(it, dict) else {}
                found += [k for k in ("chance", "fork", "beads", "strip") if k in it]
                sp = it.get("space") if isinstance(it.get("space"), dict) else {}
                found += ["views"] if "views" in sp else []
                found += ["split"] if any(isinstance(m, dict) and "split" in m and "along" in m for m in as_list(sp.get("marks"))) else []
            out += [(f"slide {deck['slides'].index(s) + 1} step {j + 1}", f"`{k}` {fix}") for k in found]
        if isinstance(s.get("table"), dict) and s["table"].get("style") == "slope":
            out.append((f"slide {deck['slides'].index(s) + 1}", f"`style: slope` {fix}"))
    return out


def idea_ok(v):
    """A usable idea: a table name, or the learner's own question ending in `?`."""
    return isinstance(v, str) and (v.strip() in IDEAS or v.strip().endswith("?"))


def idea_key(v):
    """One idea, however it is written: lower case, one space between words, no space before punctuation."""
    return re.sub(r"\s+([?.,!;:])", r"\1", " ".join(str(v).lower().split()))


def scene_kinds(s):
    """The item kinds a board scene draws: each added item, its own `table`, and a worked product."""
    out = {"table"} if s.get("table") else set()
    for _, it in items_of(s):
        out |= {k for k in it if k in ITEMS}
        e = it.get("eqn")
        if isinstance(e, dict) and "\\prodpart" in str(e.get("tex") or ""):
            out.add("product")
    return out


def scene_shows(s, symbols, data=None):
    """What `see` may name in a board scene: {name: mark tuple or None}. Marks by label or id (scene_marks), chart
    series by name, table columns by key or label, and symbols the scene shows (read live, drawn, or in its maths).
    A mark keeps its name when a series, column or symbol shares it, so its link rule still applies."""
    out = {}
    for m in scene_marks(s, symbols, data):
        for k in m[5]:
            out.setdefault(k, m)
    for _, it in items_of(s):
        for _, ch in charts_of(it):
            for q in as_list(ch.get("series")):
                if isinstance(q, dict) and q.get("name"):
                    out.setdefault(str(q["name"]), None)
        c = it.get("col")
        for k in ("key", "label") if isinstance(c, dict) else ():
            if c.get(k):
                out.setdefault(str(c[k]), None)
    tb = s.get("table")
    for c in as_list(tb.get("cols")) if isinstance(tb, dict) else []:
        for x in [c] if isinstance(c, str) else [c.get("key"), c.get("label")] if isinstance(c, dict) else []:
            if x:
                out.setdefault(str(x), None)
    used = set(scene_reads(s.get("steps"))) | scene_drawn(s) | plane_vectors(s)
    maths = " ".join(m for x in strings(s.get("steps")) for m in re.findall(r"\$([^$]+)\$", x)) + " " + " ".join(
        str(it[k].get("tex") or "") for _, it in items_of(s) for k in ("eqn", "assemble") if isinstance(it.get(k), dict))
    for n, v in symbols.items():
        if n in used or (isinstance(v, dict) and v.get("tex") and str(v["tex"]) in maths):
            out.setdefault(n, None)
    return out


def two_states(s):
    """A foil holds the wrong way and the right way on one frame: a `compare`, a figure with a control that the figure
    reads (directly or through `derive`), or a figure mark that shows only on a later step or under `when:`."""
    if any("compare" in it for _, it in items_of(s)):
        return True
    figs = [(j, it) for j, st in enumerate(as_list(s.get("steps"))) if isinstance(st, dict)
            for it in as_list(st.get("add")) if isinstance(it, dict) and any(k in it for k in FIGS)]
    derive = s.get("derive") if isinstance(s.get("derive"), dict) else {}
    reads = {n for _, it in figs for n in scene_reads(it)}
    if any(isinstance(c, dict) and reach(c.get("name"), derive) & reads for c in s.get("controls") or []):
        return True
    for j, it in figs:
        body = next(it[k] for k in FIGS if k in it)
        for mk in as_list(body.get("marks")) if isinstance(body, dict) else []:
            if isinstance(mk, dict) and (mk.get("when") is not None or (isinstance(mk.get("step"), int) and mk["step"] > j + 1)):
                return True
    return False


def lint_adv(Lx, deck, data=None):
    """adv.md: a scene's idea, its witness (`see`), its foil, and the depth budget. A lesson with no `idea` is not adv."""
    boards = {id(s) for s in adv_boards(deck)}
    for i, s in enumerate(deck.get("slides") or []):
        if isinstance(s, dict) and id(s) not in boards and (bad := [k for k in ADV_FIELDS if k in s]):
            Lx.err(slide_where(i, s), f"{', '.join(f'`{k}`' for k in bad)} belong on a board scene; this is a `{s.get('type') or 'idea'}` slide: "
                                      "move the plan to a `type: board` scene, or delete it")
    if not is_adv(deck):
        return
    learner = deck.get("learner") if isinstance(deck.get("learner"), dict) else {}
    depth = learner.get("depth", DEPTH)
    if "depth" in learner and not (isinstance(depth, int) and not isinstance(depth, bool) and 1 <= depth <= 6):
        Lx.err("learner", f"`depth: {depth!r}` is how many scenes one idea may fill: a whole number from 1 to 6 (leave it out for {DEPTH})")
        depth = DEPTH
    symbols = deck.get("symbols") or {}
    count, first = {}, {}
    for i, s in enumerate(deck.get("slides") or []):
        if id(s) not in boards or s.get("beat") in BOOKENDS:
            continue
        w = slide_where(i, s)
        miss = [k for k in ("idea", "see", "shows") if not isinstance(s.get(k), str) or not s[k].strip()]
        if miss:
            Lx.err(w, f"an adv scene names its idea, the one mark that carries it and the picture: add {', '.join(f'`{k}:`' for k in miss)} (a word or a short phrase each)")
        idea, see, has = s.get("idea"), s.get("see"), bool(as_list(s.get("steps")))
        if isinstance(idea, str) and idea.strip():
            idea = idea.strip()
            own = idea.endswith("?")
            if not idea_ok(idea):
                hit = next((k for k in IDEAS if near(idea, k)), None) if len(idea.split()) == 1 else None
                Lx.err(w, f"`idea: {idea}` is not in the idea table" + (f": did you mean `{hit}`?" if hit else
                       f" ({', '.join(IDEAS)})") + " For your own, write the learner's question, ending in `?`")
            else:
                count[idea_key(idea)] = count.get(idea_key(idea), 0) + 1
                first.setdefault(idea_key(idea), idea)
                if has and not own and not scene_kinds(s) & set(IDEAS[idea][2]):
                    Lx.err(w, f"`idea: {idea}` is drawn with {', '.join(IDEAS[idea][2])}, and this scene has none of them: draw it with one, "
                              "or pick the idea that fits the picture, or write the learner's own question, ending in `?`")
        if has and isinstance(see, str) and see.strip():
            see = see.strip()
            can = scene_shows(s, symbols, data)
            if see not in can:
                hit = next((k for k in can if near(see, k)), None)
                Lx.err(w, f"`see: {see}` names nothing this scene draws" + (f": did you mean `{hit}`?" if hit else "")
                          + " It is a mark's label or id, a chart series, a symbol the scene shows, or a table column")
            elif can[see] is not None:
                keys, m = scene_keys(scene_marks(s, symbols, data)), can[see]
                if not any((x := link_key(inner, keys)) is not None and keys[x][:3] == m[:3]
                           for _, fld, v in scene_texts(s) if fld in SEEN for inner in HILITE.findall(v)):
                    Lx.err(w, f"`see: {see}` is the mark that carries the point, but no teacher line links its word: write =={see}== "
                              f"(or =={see}:your words==) in a line, so the word takes its colour and lights it")
        if has and (idea == "shortcut" or s.get("beat") in FOIL) and not two_states(s):
            why = "a `shortcut` scene" if idea == "shortcut" else f"a `{s.get('beat')}` scene"
            Lx.err(w, f"{why} draws the wrong way beside the right way on one frame, and this one holds one state: use a `compare`, "
                      "give the figure a control (a toggle or slider) that switches the way, or add the other way as a mark with `step:` or `when:`")
    for k, n in count.items():
        if n > depth:
            Lx.warn("lesson", f"the idea `{first[k]}` fills {n} scenes and the depth budget is {depth}: merge scenes, or ask the learner for more depth (`learner.depth`)")


# what a board control and a symbol may carry; anything else is usually a comma inside an unquoted `{ }` value that split it
CTL_FIELDS = {"name", "label", "says", "show", "min", "max", "step", "value", "fmt", "run", "stops", "every", "toggle", "drag"}
# a symbol's own fields, and `value`, which a deck equation slide merges from `symbols` into its `terms` (deck slides.js)
SYM_FIELDS = {"tex", "says", "short", "fmt", "kind", "color", "cols", "rows", "value"}
# text the page shows as written, never works out: a name in it reads nothing (only its {{…}}, \mat{…} and \prodpart{…} do)
LITERAL = {"name", "label", "says", "short", "tex", "say", "id", "color", "fmt", "kind", "dash", "side", "key", "by", "cats", "family", "op",
           "via", "num", "see", "part", "state"}
IDENT = re.compile(r"[A-Za-z_]\w*")


def scene_reads(node, key=None):
    """Names a scene's steps read live: every name in a field the page works out (mark coordinates, `when`, `expr`,
    `rgb`, …), in a `{{…}}`, a \\mat{…} or a product's working. Text shown as written (a name, label, says, TeX) reads nothing."""
    if isinstance(node, dict):
        for k, v in node.items():
            yield from scene_reads(v, k)
    elif isinstance(node, list):
        for v in node:
            yield from scene_reads(v, key)
    elif isinstance(node, str):
        if key in PROSE or key in LITERAL:
            yield from (n for x in EXPRS.findall(node) for n in IDENT.findall(FMT.sub("", x)))
            yield from MATREF.findall(node)
            yield from (q for t in PRODREF.findall(node) for q in t)
        else:
            yield from IDENT.findall(node)


def scene_drawn(s):
    """The matrices and vectors a scene shows in brackets: a `matrix`/`vec` item, \\mat{X} in maths, or a product's working."""
    out = set()
    for x in strings(s.get("steps")):
        out |= set(MATREF.findall(x)) | {q for t in PRODREF.findall(x) for q in t}
    for _, it in items_of(s):
        out |= {it[k] for k in ("matrix", "vec") if isinstance(it.get(k), str)}
        for f in it.values():
            if isinstance(f, dict):
                out |= {n for n in as_list(f.get("_draws")) if isinstance(n, str)}
    return out


def plane_vectors(s):
    """Names a plane or space `vector`, `point`, `ring` or `sheet` mark reads in its coordinates: a vector drawn there is shown."""
    out = set()
    for _, it in items_of(s):
        pl = it.get("plane") or it.get("space")
        for mk in as_list(pl.get("marks")) if isinstance(pl, dict) else []:
            if isinstance(mk, dict):
                for k in ("vector", "point", "from", "ring", "sheet"):
                    out |= {n for x in strings(mk.get(k)) for n in IDENT.findall(x)}
    return out


def lint_fields(Lx, deck):
    """A symbol takes only the fields the kit reads."""
    for n, v in (deck.get("symbols") or {}).items():
        if isinstance(v, dict):
            for k in sorted(set(v) - SYM_FIELDS, key=str):
                Lx.err(f"symbols.{n}", f"a symbol has no field `{k}` (it takes {', '.join(sorted(SYM_FIELDS))}); "
                                       "a comma inside an unquoted `{ }` value splits it: quote the value")


def reach(nm, derive):
    """What a control changes: itself and every scene derive made from it."""
    seen, more = {nm}, True
    while more:
        more = False
        for k, x in derive.items():
            if k not in seen and set(IDENT.findall(str(x))) & seen:
                seen.add(k); more = True
    return seen


def lint_ctl_labels(B, Lx, deck, glob, data=None):
    """A board control explains itself: its label is its symbol or one word, its meaning is on a card, its value column
    shows a value, and something on the scene shows what it changes."""
    symbols, jumpy = deck.get("symbols") or {}, set()
    values = {**(deck.get("data") or {}), **(data or {})}
    for i, s in enumerate(deck.get("slides") or []):
        if not isinstance(s, dict) or s.get("type") != "board":
            continue
        where = f"slide {i + 1} (board “{str(s.get('title') or '')[:38]}”)"
        ctls = [c for c in s.get("controls") or [] if isinstance(c, dict)]
        derive = s.get("derive") if isinstance(s.get("derive"), dict) else {}
        names = set(glob) | set(derive) | {c.get("name") for c in ctls}
        reads = set(scene_reads(s.get("steps"))) | set(scene_reads(s.get("table")))
        drawn, arrows = scene_drawn(s), plane_vectors(s)
        for c in ctls:
            nm = c.get("name"); w = f"{where} control `{nm}`"
            for k in sorted(set(c) - CTL_FIELDS, key=str):
                Lx.err(w, f"a control has no field `{k}` (it takes {', '.join(sorted(CTL_FIELDS))}); "
                          "a comma inside an unquoted `{ }` value splits it: quote the value")
            show = c.get("show")
            if show is not None:
                if "run" not in c:
                    Lx.err(w, "`show:` names what a run's value column shows; a slider shows its own value and a toggle none: delete `show`")
                elif not isinstance(show, str) or show not in names:
                    Lx.err(w, f"`show: {show}` is not in data, derive or controls: name the number the run moves, like `show: s` with `derive: {{s: t / 20}}`")
                elif (isinstance(symbols.get(show), dict) and symbols[show].get("kind") in OBJ) or isinstance(values.get(show), list):
                    Lx.err(w, f"`show: {show}` is a list of numbers (a matrix or vector), but the value column shows one number: "
                              f"show a number the run moves, and draw `{show}` on the scene (`\\mat{{{show}}}`)")
            q = show if "run" in c and isinstance(show, str) else nm
            sym = isinstance(symbols.get(q), dict)
            label = c.get("label")
            if label is None and not sym:
                Lx.err(w, f"no `label`, and `{q}` is not a symbol: add `{q}` under symbols (its TeX becomes the label), or give `label:` one word")
            elif label is not None and sym:
                Lx.warn(w, f"`label` is not shown, because the symbol `{q}` labels this control: delete it")
            elif label is not None and B.name_words(label) > 1:
                Lx.err(w, f"`label` “{label}” is {B.name_words(label)} words: a label is the symbol or one word; the meaning goes in the symbol's `says` or the control's `says:`")
            if not sym and not c.get("says"):
                Lx.warn(w, "no card says what it means: give the control `says:` (or name it after a symbol, whose card it opens)")
            seen = reach(nm, derive)
            if not seen & reads:
                Lx.warn(w, "nothing on this scene reads it, directly or through `derive`: draw what it changes (a figure, a line, a formula), or delete it")
            for o in sorted(seen - {nm}):
                v = symbols.get(o)
                if not isinstance(v, dict) or v.get("kind") not in OBJ:
                    continue
                if o not in drawn and not (v["kind"] == "vector" and o in arrows):
                    Lx.warn(w, f"it remakes the {v['kind']} `{o}`, which this scene never draws: write `{v.get('tex', o)} = \\mat{{{o}}}` in a line, so the learner sees its numbers change")
                if v.get("fmt") is None and o not in jumpy:
                    jumpy.add(o)
                    Lx.warn(f"symbols.{o}", f"`{o}` changes with control `{nm}` but has no `fmt:`, so its decimals jump as it moves (1, then 1.00, then 1.0): give `fmt:` (decimals)")


def L_plain(t):
    return re.sub(r"\\[A-Za-z]+|[{}$_^\\]", " ", str(t))


def lint_recall(Lx, deck, state):
    """R23: what `recall:` could not do, and a later episode that recalls nothing."""
    for msg in state.get("errs", ()):
        Lx.err("recall", msg)
    ep = deck.get("episode")
    if isinstance(ep, int) and ep > 1 and not deck.get("recall"):
        Lx.warn("recall", f"episode {ep} has no `recall:`: name the earlier lesson, so this one opens with its review cards")


def make_lint(B, data):
    def lesson_lint(Lx, deck, glob):
        values = {**(deck.get("data") or {}), **(data or {})}   # what a `beads` figure's rings are named from
        _DECK.clear(); _DECK.update(deck)   # slope_groups reads the colours other scenes give a group
        if deck.get("recall"):
            Lx.err("lesson", "a class lesson has no recall cards: delete `recall:`, and reach back to the last lesson with a `think` stop near the start")
        lint_scenes(B, Lx, deck, glob, data); lint_shape(B, Lx, deck.get("slides") or [], voice_of(Lx, deck)); lint_bare(Lx, deck, values); lint_order(B, Lx, deck)
        lint_typed(Lx, deck, data); lint_known(B, Lx, deck, glob); lint_objects(Lx, deck, data, glob); lint_names(B, Lx, deck); lint_case(Lx, deck, data); lint_story(Lx, deck)
        lint_fields(Lx, deck); lint_ctl_labels(B, Lx, deck, glob, data); lint_links(Lx, deck, values); lint_adv(Lx, deck, values)
    return lesson_lint
