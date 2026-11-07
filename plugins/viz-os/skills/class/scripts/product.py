"""The worked product: one `add: {product: {...}}` step becomes one board step per line of working (board.md, `product`).

lesson.py calls `expand` before the lint, so every rule a hand-written board keeps (show before using, pop-up cards,
typed numbers, plane names) checks the lines this writes. Each line is an ordinary `eqn` whose TeX holds `\\prodpart{...}`
pieces; the kit (deck/kit/slides.js, `L.prodTex`) fills them in from the scope, so they follow a slider like `\\mat{}`.
The result comes from a slide `derive` (`name: matmul(m, v)`), so `\\mat{name}` and the plane read it live; the board
compares it with data.json when the data also holds it.
"""
import re

FIELDS = {"m", "v", "way", "name", "plane", "show", "says", "axes"}
MAX = 4                                    # rows and columns on either side
COLOURS = ["s1", "s2", "s3", "s4"]         # the pairs' colours when neither side gives any (slides.js PAIR: keep the same)
RATIO = (0.7, 1.6)                         # a generated plane's width over height, inside the board's 0.6-1.8 audit


def num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def shape(v):
    """(rows, cols) of a list of equal rows of numbers; (n, None) of a flat list; else None."""
    if isinstance(v, list) and v and all(num(x) for x in v):
        return len(v), None
    if isinstance(v, list) and v and all(isinstance(r, list) and r and all(num(x) for x in r) for r in v) and len({len(r) for r in v}) == 1:
        return len(v), len(v[0])
    return None


def places(v):
    flat = [x for r in v for x in (r if isinstance(r, list) else [r])]
    return max(next((p for p in (0, 1, 2) if abs(round(x, p) - x) < 1e-9), 2) for x in flat)


def size_of(n, values, derives, made):
    """A name's shape: an earlier product's result in this scene, the data, or a derive whose list-shaped inputs all have
    one shape (Xs: X * k)."""
    if n in made:
        return made[n][1]
    if n in values:
        return shape(values[n])
    for d in derives:
        if n in d:
            got = {size_of(q, values, [], made) for q in re.findall(r"[A-Za-z_]\w*", str(d[n])) if q in made or q in values} - {None}
            return got.pop() if len(got) == 1 else None
    return None


def ordered(derive):
    """The scene's derive with each name after the names it reads, so a line that reads a product's result (or a product
    that reads a derived name) is worked out after it. Ties keep the author's order; a loop is left as written."""
    out, left = {}, dict(derive)
    while left:
        ready = [k for k, x in left.items() if not any(q in left and q != k for q in re.findall(r"[A-Za-z_]\w*", str(x)))]
        if not ready:
            out.update(left)
            break
        for k in ready:
            out[k] = left.pop(k)
    return out


def markers(node, where, errs):
    """Keys that start with `_` are the expansion's own markers (`_uses`, `_draws`): an author who writes one could
    license a matrix the learner never saw, so it is an error in the YAML as written."""
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(k, str) and k.startswith("_"):
                errs.append((where, f"`{k}` is a marker the kit writes when it opens a `product`; delete it from the YAML"))
            markers(v, where, errs)
    elif isinstance(node, list):
        for v in node:
            markers(v, where, errs)


def expand(deck, data, errs):
    """Open every `product` item in place. Problems go to `errs` as (where, message), for the lint to report."""
    symbols = deck.get("symbols") or {}
    values = {**(data or {}), **(deck.get("data") or {})}
    drawn = {}   # vector -> how it was first drawn: "col" or "row" (a `vec` item), in click order
    for i, s in enumerate(deck.get("slides") or []):
        if isinstance(s, dict):
            markers(s, f"slide {i + 1}", errs)
        if not isinstance(s, dict) or s.get("type") != "board" or not isinstance(s.get("steps"), list):
            continue
        out, made = [], {}   # made: result name -> (its matmul, its shape)
        for j, st in enumerate(s["steps"]):
            adds = st.get("add") if isinstance(st, dict) else None
            items = adds if isinstance(adds, list) else [adds]
            if not any(isinstance(it, dict) and "product" in it for it in items):
                for it in items:
                    if isinstance(it, dict) and isinstance(it.get("vec"), str):
                        drawn.setdefault(it["vec"], "row" if it.get("row") else "col")
                for q in re.findall(r"\\mat\{([A-Za-z_]\w*)", str(st)):   # \mat{x} in a formula draws x as a column
                    drawn.setdefault(q, "col")
                out.append(st)
                continue
            w = f"slide {i + 1} (board “{str(s.get('title') or '')[:38]}”) step {j + 1}"
            lines = one(st, items, s, symbols, values, w, errs, len(out), made, drawn)
            out += lines or [{"say": "product"}]   # a broken product leaves one step, so its error is the only one
        s["steps"] = out
        if made:
            s["derive"] = ordered({**(s.get("derive") or {}), **{n: x for n, (x, _) in made.items()}})


def one(st, items, s, symbols, values, w, errs, at, made, drawn):
    def err(msg):
        errs.append((w, msg))
    if set(st) - {"add"} or len(items) != 1:
        return err("a `product` step holds only the product: it writes its own teacher line for each line of working, "
                   "so put your `say`, `mark`, `think` or other items on the step before or after it (or change its lines with `says:`)")
    p = items[0]["product"]
    if not isinstance(p, dict) or set(items[0]) != {"product"}:
        return err("`product` is a mapping: `{product: {m: X, v: x, way: rows, name: y}}`")
    bad = set(p) - FIELDS
    if bad:
        return err(f"`product` has no field {', '.join(f'`{k}`' for k in sorted(bad, key=str))} (it takes {', '.join(sorted(FIELDS))}); "
                   "a comma inside an unquoted `{ }` value splits it: quote the value")
    m, v, n, way = p.get("m"), p.get("v"), p.get("name"), p.get("way", "rows")
    if way not in ("rows", "cols"):
        return err(f"`way: {way}`: write `way: rows` (a row times a column, entry by entry) or `way: cols` (a sum of scaled columns)")
    sym = lambda q: symbols.get(q) if isinstance(symbols.get(q), dict) else {}
    for role, q, kinds in (("m", m, ("matrix",)), ("v", v, ("vector", "matrix")), ("name", n, ("vector", "matrix"))):
        if not isinstance(q, str) or not q:
            return err(f"`product` needs `{role}:`, a symbol's name")
        if sym(q).get("kind") not in kinds:
            return err(f"`{role}: {q}` must be a symbol with `kind: {' or '.join(kinds)}`" + (": the result needs its own symbol, with its TeX and `short`" if role == "name" else ""))
    if n in (m, v):
        return err(f"`name: {n}` is also an input: the result would overwrite `{n}` while the lines still read it; give the result its own symbol")
    if n in made and made[n][0] != f"matmul({m}, {v})":
        return err(f"`{n}` is already the result of `{made[n][0]}` in this scene: a second product with other inputs would overwrite it; give this result its own symbol")
    derives = [s.get("derive") or {}]
    if n in derives[0]:
        return err(f"`{n}` is made by the product (it computes {m} times {v}): delete `{n}` from this scene's `derive`")
    if drawn.get(v) == "row":
        return err(f"`{v}` was drawn as a row (`vec: {v}, row: true`), but a product reads it as a column: draw it as a column first (`vec: {v}`), or make it a one-row matrix")
    A, B = size_of(m, values, derives, made), size_of(v, values, derives, made)
    if A is None or B is None:
        q = m if A is None else v
        return err(f"cannot tell the size of `{q}`: keep its numbers (its starting numbers, if a derive remakes it) in data.json")
    R, K = A
    vec = B[1] is None
    K2, J = (B[0], 1) if vec else B
    if K != K2:
        return err(f"`{m}` has {K} columns but `{v}` has {K2} {'entries' if vec else 'rows'}: a product needs them equal (each row of `{m}` meets each column of `{v}` entry by entry)")
    if max(R, K, J) > MAX:
        return err(f"{R} × {K} times {K2} × {J} is too big to work by hand on a board: {MAX} × {MAX} at most on either side")
    if (sym(n).get("kind") == "vector") != vec:
        return err(f"`{n}` comes out as a {'vector' if vec else f'{R} × {J} matrix'}: give it `kind: {'vector' if vec else 'matrix'}`")
    if n in values and shape(values[n]) != ((R, None) if vec else (R, J)):
        return err(f"data.json holds `{n}` as {shape(values[n])}, but {m} times {v} is {R} × {J}: fix make_data.py")
    plane = p.get("plane")
    if plane not in (None, False, True):
        return err("`plane: true` draws the columns way as arrows, tip to tail")
    if plane and (way != "cols" or not vec or R != 2):
        return err("`plane: true` needs `way: cols`, a vector `v`, and an `m` with 2 rows (one per axis)"
                   + (f": `{m}` has {R} rows" if R != 2 else ""))
    axes = p.get("axes")
    if axes is not None and not (plane and isinstance(axes, list) and len(axes) == 2 and all(isinstance(a, str) for a in axes)):
        return err("`axes: [x label, y label]` names a product plane's two axes; it needs `plane: true`")
    show = p.get("show")
    if show is not None and vec:
        return err("`show` picks which entries of a matrix product get their own line; a vector product works every entry")
    if show is not None and way == "rows" and not (isinstance(show, list) and show and all(isinstance(e, list) and len(e) == 2 and all(isinstance(x, int) and not isinstance(x, bool) for x in e) for e in show)):
        return err("`show: [[1, 2]]` lists entries as [row, column], counting from 1")
    if show is not None and way == "cols" and not (isinstance(show, list) and show and all(isinstance(x, int) and not isinstance(x, bool) for x in show)):
        return err(f"`show: [1, 2]` lists the columns of `{v}` to work, counting from 1")
    shown = show or ([[1, 1]] if way == "rows" else [1])
    for e in shown:
        i, j = (e if way == "rows" else (1, e))
        if not (1 <= i <= R and 1 <= j <= J):
            return err(f"`show` entry {e} is outside the {R} × {J} result")

    T = lambda q: str(sym(q).get("tex") or q)
    mt, vt, nt = T(m), T(v), T(n)
    P = lambda part, *ix: "\\prodpart{" + "|".join([m, v, n, part, *map(str, ix)]) + "}"
    vk = lambda k: f"${P('num', k + 1, 1)}$"   # an entry of the vector v, in the format the formula gives v now
    lhs = f"\\htmlClass{{lt lt-{n}}}{{{nt}}}"   # the result's name, with its card, before the line that draws it
    L = []   # (say, eqn)
    if way == "rows" and vec:
        for i in range(1, R + 1):
            L.append((f"Row {i} of ${mt}$ times ${vt}$ gives entry {i}.", {"tex": f"{P('row', i)} {P('col', 1)} = {P('dot', i, 1)} {P('eq', i, 1)} {P('res', i, 1)}"}))
        L.append((f"Stack the {R} entries: that is ${nt}$.", {"lhs": n, "tex": f"{P('sums')} {P('eqs')} {P('all')}", "_draws": n}))
    elif way == "rows":
        for i, j in shown:
            L.append((f"Entry ({i}, {j}): row {i} of ${mt}$ times column {j} of ${vt}$.", {"tex": f"{P('row', i)} {P('col', j)} = {P('dot', i, j)} {P('eq', i, j)} {P('res', i, j)}"}))
        if K * J <= 4:
            L.append(("Every entry the same way: a row times a column.", {"lhs": n, "tex": f"{P('sums')} {P('eqs')} {P('all')}", "_draws": n}))
        else:   # too wide for one line: the sums, then the result under them
            L.append(("Every entry the same way: a row times a column.", {"tex": f"{lhs} = {P('sums')}"}))
            L.append(("Add up each entry.", {"tex": f"{P('eqs')} {P('all')}", "_draws": n}))
    elif vec:
        terms = " + ".join(f"{P('coef', k, 1)} {P('mcol', k)}" for k in range(1, K + 1))
        first = (f"Take {vk(0)} of column 1 and {vk(1)} of column 2." if K == 2
                 else f"Each entry of ${vt}$ says how much of each column of ${mt}$ to take.")
        L.append((first, {"tex": f"{lhs} = {terms}"}))
        L.append(("Scale each column, then lay the arrows tip to tail." if plane else "Scale each column by its entry.",
                  {"tex": f"{P('eqsc', 1)} " + " + ".join(P("scaled", k, 1) for k in range(1, K + 1))}))
        L.append((f"Add them up: the dot is ${nt}$." if plane else f"Add them up: that is ${nt}$.", {"tex": f"{P('eqadd', 1)} {P('all')}", "_draws": n}))
    else:
        for j in shown:
            terms = " + ".join(f"{P('coef', k, j)} {P('mcol', k)}" for k in range(1, K + 1))
            L.append((f"${mt}$ times column {j} of ${vt}$ gives column {j} of the result.", {"tex": f"[{m}] {P('col', j)} = {terms} {P('eqcol', j)} {P('rcol', j)}"}))
        L.append(("Every column the same way gives the whole result.", {"lhs": n, "tex": P("all"), "_draws": n}))

    says = p.get("says")
    if says is not None:
        if not isinstance(says, list) or len(says) != len(L) or not all(isinstance(x, str) for x in says):
            return err(f"`says:` has {len(says) if isinstance(says, list) else 1} line(s), but this product writes {len(L)} lines: give one teacher line per line, in order")
        L = [(x, e) for x, (_, e) in zip(says, L)]
    L[0][1]["_uses"] = [m, v]   # the ledger: m and v are used here, so each must be drawn first
    steps = [{"say": x, "add": [{"eqn": e}]} for x, e in L]
    if plane:
        col = lambda k: ((sym(m).get("cols") or [])[k:k + 1] or (sym(v).get("rows") or [])[k:k + 1] or [COLOURS[k]])[0]
        arrow = lambda k: [f"at(at({m}, {r}), {k}) * at({v}, {k})" for r in (0, 1)]
        tip = lambda k, r: " + ".join(f"at(at({m}, {r}), {q}) * at({v}, {q})" for q in range(k + 1))
        marks = []
        for k in range(K):
            mk = {"vector": arrow(k), "color": col(k), "name": f"col {k + 1}",   # two words at most on the plot; how much of it is in its card
                  "says": f"{vk(k)} times column {k + 1} of ${mt}$" + (", from the tip of the last arrow" if k else ", from the origin"),
                  "step": at + 1 + min(k, 1)}
            if k:
                mk["from"] = [tip(k - 1, 0), tip(k - 1, 1)]
            marks.append(mk)
        short = sym(n).get("short") or n
        marks.append({"point": [f"at({n}, 0)", f"at({n}, 1)"], "color": "accent", "name": short, "says": f"where ${vt}$ lands: ${nt}$", "step": at + 3})
        ax = axes or ["entry 1", "entry 2"]
        rng = lambda r: ", ".join(tip(k, r) for k in range(K))
        lo = lambda r: f"(floor(min(0, {rng(r)})) - (min({rng(r)}) < 0))"   # every tip inside, with a margin
        hi = lambda r: f"(ceil(max(0, {rng(r)})) + 1)"
        span = lambda r: f"({hi(r)} - {lo(r)})"
        # pad the short axis on its far side, so width over height stays inside RATIO at every slider value
        x = {"label": ax[0], "min": lo(0), "max": f"{lo(0)} + max({span(0)}, {RATIO[0]} * {span(1)})"}
        y = {"label": ax[1], "min": lo(1), "max": f"{lo(1)} + max({span(1)}, {span(0)} / {RATIO[1]})"}
        steps[0]["add"].insert(0, {"plane": {"x": x, "y": y, "marks": marks}})
    made[n] = (f"matmul({m}, {v})", (R, None) if vec else (R, J))
    return steps
