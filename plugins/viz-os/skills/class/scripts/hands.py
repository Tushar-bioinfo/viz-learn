"""Hands-on space figures (adv.md, "Views, hunts and splits"): turn the short shapes an author writes into the kit's long form.

- a figure's `views: {step: fit|edge|face|{yaw, pitch}}` is checked here and read by the kit as it is;
- a `hunt` step becomes a think step, two hidden guess controls, two hidden "was" controls, the line, the gap, the foot,
  and a `guess` mark that the learner drags on the sheet;
- a `split` mark written as `{split: P, along: [U, V], ...}` becomes two hidden part controls, the `split` mark the
  learner drags by its tips, the think's `set` that moves the tips to P's amounts, and (with `foil`) the shortcut's drops.

Runs before the lint, so the lint sees what the kit draws. Problems go to `errs` as (where, message).
"""

VIEWS = ("fit", "edge", "face")
HUNT_NAMES = ("hunt_a", "hunt_b", "hunt_wa", "hunt_wb", "hunt_fa", "hunt_fb", "line", "gap")
SPLIT_NAMES = ("part_a", "part_b", "split_fa", "split_fb", "miss", "short_a", "short_b")
THIN = 1e-6
ON_SHEET = 1e-9      # how far off the sheet a split's point may sit (a data point; derived points are checked on the page)
HUNT_KEYS = {"from", "on", "start", "label", "foot"}


def as_list(x):
    return x if isinstance(x, list) else [] if x is None else [x]


def spaces(steps):
    """Every space figure a scene's steps add, with the step (1-based) that adds it."""
    out = []
    for j, st in enumerate(steps):
        if not isinstance(st, dict):
            continue
        for it in as_list(st.get("add")):
            if isinstance(it, dict) and isinstance(it.get("space"), dict):
                out.append((j + 1, it["space"]))
    return out


def sheet_on(sp, pair):
    """The sheet mark of a space that spans the two vectors `pair` (in either order)."""
    for mk in as_list(sp.get("marks")):
        if isinstance(mk, dict) and isinstance(mk.get("sheet"), list) and sorted(map(str, mk["sheet"])) == sorted(map(str, pair)):
            return mk
    return None


def vec(d, x):
    v = d.get(x) if isinstance(x, str) else None
    return v if isinstance(v, list) and len(v) == 3 and all(isinstance(q, (int, float)) and not isinstance(q, bool) for q in v) else None


def parallel(d, U, V):
    """True when U and V are data vectors that are zero or nearly point the same way (they span no plane)."""
    a, b = vec(d, U), vec(d, V)
    if not (a and b):
        return False
    uu, vv, uv = (sum(p * q for p, q in zip(r, s)) for r, s in ((a, a), (b, b), (a, b)))
    return uu == 0 or vv == 0 or max(0.0, 1 - uv * uv / (uu * vv)) ** 0.5 < THIN


def nums(v, n=2):
    return isinstance(v, list) and len(v) == n and all(isinstance(q, (int, float)) and not isinstance(q, bool) for q in v)


def bounds(sh, U, V, w, errs):
    """The sheet's [min, max] per vector, in the order [U, V]; None (with an error) when they are not 2 numbers each."""
    mn, mx = sh.get("min", [0, 0]), sh.get("max")
    if not (nums(mn) and nums(mx)):
        errs.append((w, f"the sheet on [{U}, {V}] needs `max: [a, b]` (and `min:`, if given) as 2 numbers each, so the drag has a range; got max {mx!r}, min {mn!r}"))
        return None
    if [str(x) for x in sh["sheet"]] != [str(U), str(V)]:
        mn, mx = mn[::-1], mx[::-1]
    if any(a >= b for a, b in zip(mn, mx)):
        errs.append((w, f"the sheet on [{U}, {V}] runs from `min` to `max`, so each `min` is below its `max`; got min {mn!r}, max {mx!r}"))
        return None
    return [[float(a), float(b)] for a, b in zip(mn, mx)]


def foot_amounts(d, U, V, P):
    """P's amounts of U and V (the foot on the sheet) and how far P sits off it, when all three are data vectors."""
    a, b, p = vec(d, U), vec(d, V), vec(d, P)
    if not (a and b and p):
        return None
    dot = lambda x, y: sum(i * j for i, j in zip(x, y))
    uu, uv, vv, pu, pv = dot(a, a), dot(a, b), dot(b, b), dot(p, a), dot(p, b)
    det = uu * vv - uv * uv
    if det == 0:
        return None
    fa, fb = (vv * pu - uv * pv) / det, (uu * pv - uv * pu) / det
    r = [pi - fa * ai - fb * bi for pi, ai, bi in zip(p, a, b)]
    return fa, fb, dot(r, r) ** 0.5


def reach(am, rg, what, w, errs, fix="widen the sheet's `max`/`min` so the learner can drag there"):
    """The amounts the answer needs must lie inside the drag range (the sheet as drawn)."""
    if am and not all(lo - 1e-9 <= x <= hi + 1e-9 for x, (lo, hi) in zip(am[:2], rg)):
        errs.append((w, f"{what} needs amounts {am[0]:.3g} and {am[1]:.3g}, outside the sheet as drawn ({rg[0][0]:g} to {rg[0][1]:g}, {rg[1][0]:g} to {rg[1][1]:g}): {fix}"))
        return False
    return True


def scoped(d, s, deck):
    """The data as this scene sees it: a name the scene or lesson derives (or a control) hides the data value; a derive that is
    just another data name (`ft: dab_px`) takes that value. Anything else the lint cannot read, and the page guards it."""
    out = dict(d)
    for der in ((deck or {}).get("derive") or {}, s.get("derive") or {}):
        for k, x in der.items():
            out.pop(k, None)
            if isinstance(x, str) and x.strip() in d and x.strip() not in der:
                out[k] = d[x.strip()]
    for c in as_list(s.get("controls")):
        if isinstance(c, dict):
            out.pop(c.get("name"), None)
    return out


def start_of(st, d, w, errs):
    """A start is a data name holding 2 numbers (so no number is typed into the lesson)."""
    v = d.get(st) if isinstance(st, str) else None
    if isinstance(v, list) and len(v) == 2 and all(isinstance(q, (int, float)) and not isinstance(q, bool) for q in v):
        return [float(q) for q in v]
    errs.append((w, f"`start` is a data name that holds 2 numbers, the two amounts the learner starts from; got {st!r}"))
    return None


def amounts(U, V, P, a, b):
    """Derive lines for P's amounts of U and V (the foot on the sheet), by the normal equations."""
    uu, uv, vv, pu, pv = f"sum({U}*{U})", f"sum({U}*{V})", f"sum({V}*{V})", f"sum({P}*{U})", f"sum({P}*{V})"
    det = f"({uu}*{vv} - {uv}^2)"
    return {a: f"({vv}*{pu} - {uv}*{pv}) / {det}", b: f"({uu}*{pv} - {uv}*{pu}) / {det}"}


def clash(s, names, w, errs, what, d=None, deck=None):
    """The kit's names must be free in the scene, the data and the lesson's own derive (a name there would change meaning)."""
    taken = ({c.get("name") for c in as_list(s.get("controls")) if isinstance(c, dict)} | set(s.get("derive") or {})
             | set(d or {}) | set((deck or {}).get("derive") or {}) | set((deck or {}).get("symbols") or {}))
    bad = sorted(set(names) & taken)
    if bad:
        errs.append((w, f"a {what} names {', '.join(bad)} itself: rename yours ({', '.join(names)} are the {what}'s)"))
    return not bad


def views(s, w, steps, errs):
    for _, sp in spaces(steps):
        vs = sp.get("views")
        if vs is None:
            continue
        if not isinstance(vs, dict):
            errs.append((w, "space `views` maps a step number to a view: {2: face, 5: edge}"))
            continue
        for k, v in vs.items():
            if not isinstance(k, int) or not 1 <= k <= len(steps):
                errs.append((w, f"space `views` key {k!r} is not a step of this scene (1 to {len(steps)})"))
            ok = v in VIEWS or (isinstance(v, dict) and set(v) == {"yaw", "pitch"} and all(isinstance(x, (int, float)) for x in v.values()))
            if not ok:
                errs.append((w, f"space view word {v!r} names no view: use fit, edge, face, or {{yaw, pitch}}"))


def hunt(s, w, steps, d, errs, deck=None):
    hs = [j for j, st in enumerate(steps) if isinstance(st, dict) and "hunt" in st]
    if len(hs) > 1:
        errs.append((w, "one `hunt` per scene: the learner drags one guess"))
    for j in hs[:1]:
        st, n, h = steps[j], j + 1, steps[j]["hunt"]
        ww = f"{w} step {n} hunt"
        if not isinstance(h, dict) or h.get("from") is None or not (isinstance(h.get("on"), list) and len(h["on"]) == 2):
            errs.append((ww, "a `hunt` needs `from: P` (the point to hunt for) and `on: [U, V]` (the sheet it hunts on)"))
            continue
        P, (U, V) = h["from"], h["on"]
        bad = sorted(set(h) - HUNT_KEYS, key=str)
        if bad:
            errs.append((ww, f"a `hunt` has no field {', '.join(f'`{k}`' for k in bad)} (it takes {', '.join(sorted(HUNT_KEYS))})"))
            continue
        if any(h.get(k) is not None and not (isinstance(h[k], str) and h[k].strip() and not set(h[k]) & set(":=")) for k in ("label", "foot")):
            errs.append((ww, "a hunt's `label` and `foot` are a few words with no `:` or `=` (they name its marks)"))
            continue
        dv = scoped(d, s, deck)
        if parallel(dv, U, V):
            errs.append((ww, f"a hunt on [{U}, {V}]: the two directions are zero or nearly parallel, so they make no sheet and the hunt has no nearest point"))
            continue
        hosts = [sp for _, sp in spaces(steps[:j + 1]) if sheet_on(sp, (U, V))]
        if not hosts:
            errs.append((ww, f"a `hunt` on [{U}, {V}] needs a space figure, added at or before this step, with a `sheet: [{U}, {V}]` to hunt on"))
            continue
        if not clash(s, HUNT_NAMES, ww, errs, "hunt", d, deck):
            continue
        sp = hosts[0]
        rg = bounds(sheet_on(sp, (U, V)), U, V, ww, errs)
        a0 = start_of(h.get("start"), d, ww, errs)
        if rg is None or a0 is None or not reach(a0, rg, f"the hunt's `start` {h.get('start')}", ww, errs, "pick a start inside it") or not reach(foot_amounts(dv, U, V, P), rg, f"the hunt's nearest point to {P}", ww, errs):
            continue
        s["controls"] = as_list(s.get("controls")) + [
            {"name": nm, "label": lab, "says": says, "min": rg[q][0], "max": rg[q][1], "step": 0.01, "value": a0[q], "drag": kd}
            for nm, q, kd, lab, says in (("hunt_a", 0, "guess", U, f"how much {U} your guess takes"), ("hunt_b", 1, "guess", V, f"how much {V} your guess takes"),
                                         ("hunt_wa", 0, "was", "was", "where your guess was"), ("hunt_wb", 1, "was", "was", "where your guess was"))]
        der = dict(s.get("derive") or {})
        der.update(amounts(U, V, P, "hunt_fa", "hunt_fb"))
        der["line"] = f"sqrt(sum(({P} - hunt_a*{U} - hunt_b*{V})^2))"
        der["gap"] = f"sqrt(sum((hunt_wa*{U} + hunt_wb*{V} - hunt_fa*{U} - hunt_fb*{V})^2))"
        s["derive"] = der
        label = h.get("label") or "your line"
        sp["marks"] = as_list(sp.get("marks")) + [
            {"guess": ["hunt_a", "hunt_b"], "on": [U, V], "from": P, "was": ["hunt_wa", "hunt_wb"], "label": label,
             "says": "from the point to your guess: drag its dot", "step": n},
            {"foot": {"from": P, "onto": [U, V]}, "label": h.get("foot") or "residual", "says": "the shortest line to the sheet", "step": n},
            {"segment": [f"hunt_wa*{U} + hunt_wb*{V}", f"hunt_fa*{U} + hunt_fb*{V}"], "color": "mist", "dash": True,
             "label": "gap", "says": "from your guess to the nearest point", "step": n}]
        vs = sp.get("views") if isinstance(sp.get("views"), dict) else {}
        vs.setdefault(n, "edge")
        sp["views"] = vs
        q = st.get("q") or "Drag the dot: make your line as short as you can."
        steps[j] = {k: v for k, v in st.items() if k not in ("hunt", "q", "a")}
        steps[j]["think"] = {"q": f"{q} =={label}:{label[0].upper() + label[1:]}== is {{{{line|3}}}}.", "a": st.get("a") or ""}
        if not st.get("a"):
            errs.append((ww, "a `hunt` needs `a:`, the answer the learner reads once the guess glides to the foot"))


def split(s, w, steps, d, errs, deck=None):
    for j0, sp in spaces(steps):
        for mk in as_list(sp.get("marks")):
            if not (isinstance(mk, dict) and "split" in mk and "along" in mk):
                continue
            ww = f"{w} space split"
            P, al = mk["split"], mk["along"]
            if not (isinstance(P, str) and isinstance(al, list) and len(al) == 2):
                errs.append((ww, "a split is `{split: P, along: [U, V]}`: the point P to reach by U then V"))
                continue
            U, V = al
            dv = scoped(d, s, deck)
            if parallel(dv, U, V):
                errs.append((ww, f"split along [{U}, {V}]: the two directions are zero or nearly parallel, so no amounts reach {P}"))
                continue
            sh = sheet_on(sp, (U, V))
            if not sh:
                errs.append((ww, f"a split along [{U}, {V}] needs a `sheet: [{U}, {V}]` in the same figure"))
                continue
            if not clash(s, SPLIT_NAMES, ww, errs, "split", d, deck):
                continue
            n, foil = mk.get("step", j0), mk.get("foil")
            if not (isinstance(n, int) and not isinstance(n, bool) and 1 <= n <= len(steps)):
                errs.append((ww, f"a split's `step` is a step of this scene, 1 to {len(steps)}; got {n!r}"))
                continue
            if foil is not None and not (isinstance(foil, bool) or (isinstance(foil, int) and 1 <= foil <= len(steps))):
                errs.append((ww, f"a split's `foil` is `true` (the step after its think) or a step number; got {foil!r}"))
                continue
            fa = foot_amounts(dv, U, V, P)
            if fa and fa[2] > ON_SHEET:
                errs.append((ww, f"the split's point {P} sits {fa[2]:.3g} off the sheet of {U} and {V}, so no amounts reach it: split its foot (the nearest point on the sheet) instead"))
                continue
            th = next((k for k in range(n - 1, len(steps)) if isinstance(steps[k], dict) and steps[k].get("think")), None)
            if th is None:
                errs.append((ww, "a split needs a `think` at or after its step that asks for the two amounts: its answer moves the tips there"))
                continue
            a0 = start_of(mk.get("start"), d, ww, errs)
            rg = bounds(sh, U, V, ww, errs)
            if a0 is None or rg is None or not reach(a0, rg, f"the split's `start` {mk.get('start')}", ww, errs, "pick a start inside it") or not reach(fa, rg, f"the split onto {P}", ww, errs):
                continue
            t = steps[th]["think"]
            t = dict(t if isinstance(t, dict) else {"q": t})
            own = t.get("set") if isinstance(t.get("set"), dict) else {}
            if set(own) & {"part_a", "part_b"}:
                errs.append((ww, f"step {th + 1}'s think sets {', '.join(sorted(set(own) & {'part_a', 'part_b'}))} itself: the split's answer moves those; drop them from its `set`"))
                continue
            s["controls"] = as_list(s.get("controls")) + [
                {"name": nm, "label": X, "says": f"how much {X} your split takes", "min": rg[q][0], "max": rg[q][1], "step": 0.01, "value": a0[q], "drag": "split"}
                for nm, q, X in (("part_a", 0, U), ("part_b", 1, V))]
            der = dict(s.get("derive") or {})
            der.update(amounts(U, V, P, "split_fa", "split_fb"))
            der["miss"] = f"sqrt(sum((part_a*{U} + part_b*{V} - {P})^2))"
            der["short_a"] = f"sum({P}*{U}) / sum({U}*{U})"
            der["short_b"] = f"sum({P}*{V}) / sum({V}*{V})"
            s["derive"] = der
            steps[th]["think"] = dict(t, set={**own, "part_a": "split_fa", "part_b": "split_fb"})   # the author's own set is kept
            mk.pop("foil", None)
            mk.pop("along"), mk.pop("start", None)
            mk.update({"split": [U, V], "by": ["part_a", "part_b"], "to": P})
            mk.setdefault("says", f"your split: an amount of {U}, then of {V}")
            if foil:
                # the shortcut shows on the step after the split's think (or with its answer, when the think is last)
                fs = foil if isinstance(foil, int) and not isinstance(foil, bool) else min(th + 2, len(steps))
                sp["marks"] = as_list(sp.get("marks")) + [
                    {"foot": {"from": P, "onto": U}, "color": "mist", "label": "shortcut", "says": f"a square drop onto {U} alone, and onto {V} alone", "step": fs},
                    {"foot": {"from": P, "onto": V}, "color": "mist", "step": fs}]


def expand(deck, d, errs):
    d = {**(deck.get("data") if isinstance(deck.get("data"), dict) else {}), **(d or {})}   # inline `data:` and the data file
    for i, s in enumerate(as_list(deck.get("slides"))):
        if not (isinstance(s, dict) and s.get("type") == "board"):
            continue
        steps = as_list(s.get("steps"))
        w = f"slide {i + 1}"
        hunt(s, w, steps, d, errs, deck)
        split(s, w, steps, d, errs, deck)
        views(s, w, steps, errs)
        s["steps"] = steps
