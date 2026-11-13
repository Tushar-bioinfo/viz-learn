"""The `strip` item (adv.md §11): a drawing, a window the learner drags over it, and the window's contents as rows.

Runs before the lint, like hands.py. For each strip it reads the art (art/<name>.svg, .json, .hits.json, made by the
lesson's make_art.py and checked by art.py), samples the window where it starts, and adds the window to the lesson's
data, so every other item reads it by name and the lint checks those names like any data:
  window          the rows: one per spot (`take: {spots: n}`) or per shape (`take: shapes`), each with the shape's
                  record (its `id`, `part` and numbers), its place (`row`, `col`) and its slot values (`slots:`)
  window_<f>      field f of every row, as a list (lists add entry by entry: sum(window_weight * window_grey))
  picked_<f>      field f of the picked row (picked_od is a position a `space` mark can use)
On the page the kit redraws these names when the learner drags the window or presses a spot.
Problems go to `errs` as (where, message).
"""
import json
from pathlib import Path

KEYS = {"art", "window", "take", "table", "pick", "slots", "id"}
WINDOW_KEYS = {"size", "start"}
SPOTS = (2, 16)      # spots a side
TABLE_MAX = 4        # table columns besides the swatch and the count


def as_list(x):
    return x if isinstance(x, list) else [] if x is None else [x]


def load(base, name, errs, w):
    art = base / "art"
    svg, rec, hit = (art / f"{name}{x}" for x in (".svg", ".json", ".hits.json"))
    for f in (svg, rec):
        if not f.is_file():
            errs.append((w, f"`strip` art `{name}`: {f.relative_to(base)} is missing; make it with the lesson's make_art.py"))
            return None
    if not hit.is_file() or hit.stat().st_mtime < max(svg.stat().st_mtime, rec.stat().st_mtime):
        errs.append((w, f"`strip` art `{name}`: run `python3 <class>/scripts/art.py {svg.relative_to(base)}` (it checks the drawing and writes {hit.name})"))
        return None
    recs, hits = json.loads(rec.read_text()), json.loads(hit.read_text())
    if hits["ids"] != [r["id"] for r in recs["shapes"]]:
        errs.append((w, f"`strip` art `{name}`: {hit.name} is older than the records; run art.py again"))
        return None
    g = hits["grid"]
    cells = []
    for row in hits["rows"]:
        out = []
        for k, n in zip(row[0::2], row[1::2]):
            out += [k] * n
        cells.append(out)
    return {"name": name, "svg": f"art/{name}.svg", "recs": recs, "shapes": recs["shapes"], "grid": g,
            "vb": hits["viewBox"], "cells": cells, "hits": hits["rows"]}


def cell_at(A, x, y):
    x0, y0, w, h = A["vb"]
    g = A["grid"]
    i, j = int((x - x0) / w * g), int((y - y0) / h * g)
    return A["cells"][j][i] if 0 <= i < g and 0 <= j < g else -1


def centre_of(A, k):
    x0, y0, w, h = A["vb"]
    g = A["grid"]
    pts = [(i, j) for j, row in enumerate(A["cells"]) for i, v in enumerate(row) if v == k]
    if not pts:
        return None
    return (x0 + (sum(p[0] for p in pts) / len(pts) + .5) / g * w, y0 + (sum(p[1] for p in pts) / len(pts) + .5) / g * h)


def rows_of(A, cx, cy, size, take, slots):
    """The window's rows, as the page makes them (board.js samples the same hit map the same way)."""
    S = A["shapes"]
    if take == "shapes":
        x0, y0, w, h = A["vb"]
        g = A["grid"]
        count = {}
        for j in range(g):
            for i in range(g):
                x, y = x0 + (i + .5) / g * w, y0 + (j + .5) / g * h
                if abs(x - cx) <= size / 2 and abs(y - cy) <= size / 2 and A["cells"][j][i] >= 0:
                    count[A["cells"][j][i]] = count.get(A["cells"][j][i], 0) + 1
        tot = sum(count.values()) or 1
        ks = sorted(count, key=lambda k: (-count[k], k))
        return [{**S[k], "share": round(count[k] / tot, 4)} for k in ks]
    n = take
    out = []
    for r in range(n):
        for c in range(n):
            k = cell_at(A, cx - size / 2 + (c + .5) * size / n, cy - size / 2 + (r + .5) * size / n)
            row = {**(S[k] if k >= 0 else {"id": None, "part": "nothing"}), "row": r, "col": c}
            for nm, vals in slots.items():
                row[nm] = vals[r * n + c]
            out.append(row)
    return out


def expand(deck, d, errs, base):
    d = d if d is not None else {}
    n_strips = 0
    for i, s in enumerate(as_list(deck.get("slides"))):
        if not (isinstance(s, dict) and s.get("type") == "board"):
            continue
        for j, st in enumerate(as_list(s.get("steps"))):
            for it in as_list(st.get("add") if isinstance(st, dict) else None):
                if not (isinstance(it, dict) and "strip" in it):
                    continue
                w = f"slide {i + 1} step {j + 1} strip"
                sp = it["strip"]
                n_strips += 1
                if n_strips > 1:
                    errs.append((w, "a lesson holds one `strip`: its names (`window`, `picked_…`) are the lesson's"))
                    continue
                if not isinstance(sp, dict):
                    errs.append((w, "`strip` is a mapping: {art, window: {size, start}, take, table}"))
                    continue
                for k in set(sp) - KEYS:
                    errs.append((w, f"`strip` does not know `{k}`: it takes {', '.join(sorted(KEYS))}"))
                if not isinstance(sp.get("art"), str):
                    errs.append((w, "`strip` needs `art:`, the name of a drawing in art/ (art/<name>.svg and .json)"))
                    continue
                A = load(Path(base), sp["art"], errs, w)
                if A is None:
                    continue
                win = sp.get("window") if isinstance(sp.get("window"), dict) else {}
                for k in set(win) - WINDOW_KEYS:
                    errs.append((w, f"`strip` window does not know `{k}`: it takes size and start"))
                x0, y0, vw, vh = A["vb"]
                size = win.get("size")
                if not isinstance(size, (int, float)) or not (0 < size <= min(vw, vh) / 2):
                    errs.append((w, f"`strip` window `size` is a number of the drawing's units, above 0 and at most half its side ({min(vw, vh) / 2:g}); got {size!r}"))
                    continue
                ids = {r["id"]: k for k, r in enumerate(A["shapes"])}
                st0 = win.get("start")
                k0 = ids.get(st0, next((k for k, r in enumerate(A["shapes"]) if isinstance(st0, str) and r["part"].startswith(st0)), None))
                c0 = centre_of(A, k0) if k0 is not None else None
                if c0 is None:
                    errs.append((w, f"`strip` window `start` names no shape that shows: give a shape id or the start of a part name (`{A['shapes'][0]['part']}`); got {st0!r}"))
                    continue
                cx = min(max(c0[0], x0 + size / 2), x0 + vw - size / 2)
                cy = min(max(c0[1], y0 + size / 2), y0 + vh - size / 2)
                tk = sp.get("take", {"spots": 8})
                take = tk.get("spots") if isinstance(tk, dict) else tk
                if not (take == "shapes" or (isinstance(take, int) and SPOTS[0] <= take <= SPOTS[1])):
                    errs.append((w, f"`strip` take is `{{spots: n}}` ({SPOTS[0]}–{SPOTS[1]} a side) or `shapes`; got {tk!r}"))
                    continue
                slots = {}
                for nm, src in (sp.get("slots") or {}).items():
                    vals = d.get(src) if isinstance(src, str) else src
                    if take == "shapes":
                        errs.append((w, "`slots` give each spot of the grid a value, so they need `take: {spots: n}`"))
                    elif not (isinstance(vals, list) and len(vals) == take * take and all(isinstance(v, (int, float)) for v in vals)):
                        errs.append((w, f"slot `{nm}` needs {take * take} numbers, one per spot, row by row; `{src}` gives {vals!r:.60}"))
                    else:
                        slots[nm] = vals
                rows = rows_of(A, cx, cy, size, take, slots)
                fields = [f for f in rows[0] if f != "rgb"] if rows else []
                for f in as_list(sp.get("table")):
                    if f not in fields:
                        errs.append((w, f"`strip` table column `{f}` is not a field of the rows: they have {', '.join(fields)}"))
                for f in as_list(sp.get("table")):
                    if f in slots:
                        errs.append((w, f"`strip` table column `{f}` is a slot: it changes from spot to spot, but the table has one row per shape; show it in a line (`{{{{window_{f}}}}}`) instead"))
                if len(as_list(sp.get("table"))) > TABLE_MAX:
                    errs.append((w, f"`strip` table shows at most {TABLE_MAX} columns beside the swatch and the count"))
                pk = sp.get("pick")
                num = lambda r: isinstance(r.get(pk), (int, float))
                if pk is not None and not any(num(r) for r in rows):
                    errs.append((w, f"`strip` pick `{pk}` is not a number in the rows: the window starts on the spot with the most of it"))
                    pk = None
                at = max(range(len(rows)), key=lambda q: rows[q][pk] if num(rows[q]) else float("-inf")) if pk else (
                    0 if take == "shapes" else (take // 2) * take + take // 2)
                made = {"window": rows}
                for f in fields + ["rgb"]:
                    made[f"window_{f}"] = [r.get(f) for r in rows]
                    made[f"picked_{f}"] = rows[at].get(f)
                for nm in made:
                    if nm in d:
                        errs.append((w, f"the strip makes the name `{nm}`, but the lesson's data already has it: rename yours"))
                d.update(made)
                cols = [f for f in A["shapes"][0] if f != "id"]
                sp.update({"image": A["svg"], "_kit": {"vb": A["vb"], "grid": A["grid"], "hits": A["hits"], "cols": cols,
                           "recs": [[r.get(f) for f in cols] for r in A["shapes"]], "ids": [r["id"] for r in A["shapes"]],
                           "unit": A["recs"].get("unit"), "at": [cx, cy], "pick": at, "take": take, "slots": slots, "size": size}})
    return d
