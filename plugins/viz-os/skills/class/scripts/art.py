#!/usr/bin/env python3
"""Check a strip's drawing against the art contract (board.md, `strip`) and write its hit map.

Usage: art.py lessons/<slug>/art/<name>.svg [--grid 400]

A strip's art is two files side by side, both made by the lesson's own seeded script (make_art.py):
  <name>.svg   the drawing: every shape has a unique `id`; fills and strokes are flat colours (#rrggbb or none),
               with no gradients, patterns, filters, opacity or <image>, so the colour drawn is the colour recorded
  <name>.json  {"about": ..., "paint": "rgb", "shapes": [{"id", "part", ...numbers}]}: one record per shape.
               `part` names what the shape is (a learner reads it). `paint` names the field that holds each
               shape's [r, g, b]; when it is given, every shape must be drawn in exactly that colour

This script checks both, then opens the drawing in a headless browser and records which shape is on top at each
point of a grid (`grid` × `grid` over the viewBox). It writes <name>.hits.json, which the lesson build reads, so the
window's spots are the same in the build, the lint, the page and the check. Run it again after the drawing changes.
Exit 1 on a broken contract; WARN lines are judgement calls.
"""
import argparse, json, re, sys
from pathlib import Path

SHAPES = ("path", "circle", "ellipse", "rect", "polygon", "polyline", "line")
BANNED = re.compile(r"<(?:linearGradient|radialGradient|pattern|filter|image|mask|use|foreignObject)\b|url\(", re.I)
OPAC = re.compile(r"\b(?:opacity|fill-opacity|stroke-opacity)\s*[=:]", re.I)
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
BIG = 2_000_000   # bytes: a drawing larger than this makes a slow page


def attrs(tag):
    return dict(re.findall(r'([\w:-]+)\s*=\s*"([^"]*)"', tag))


def paint_of(a):
    """The colour a shape is drawn in: its fill, or its stroke when it has no fill."""
    st = dict(kv.split(":", 1) for kv in a.get("style", "").replace(" ", "").split(";") if ":" in kv)
    fill, stroke = st.get("fill", a.get("fill")), st.get("stroke", a.get("stroke"))
    return stroke if fill == "none" else fill, fill, stroke


def check(svg_path):
    errs, warns = [], []
    svg = svg_path.read_text(encoding="utf-8")
    rec_path = svg_path.with_suffix(".json")
    if not rec_path.is_file():
        return None, [f"{rec_path.name} is missing: write the records beside the drawing (one per shape id)"], warns
    recs = json.loads(rec_path.read_text(encoding="utf-8"))
    shapes = recs.get("shapes") if isinstance(recs, dict) else None
    if not isinstance(shapes, list) or not shapes:
        return None, [f"{rec_path.name} needs `shapes`: a list of records, each with `id` and `part`"], warns
    if BANNED.search(svg):
        errs.append("the drawing uses a gradient, pattern, filter, mask, <use>, <image> or url(): draw flat colours only, so the colour drawn is the colour recorded")
    if OPAC.search(svg):
        errs.append("the drawing sets an opacity: drop it, so the colour drawn is the colour recorded")
    if len(svg.encode()) > BIG:
        warns.append(f"the drawing is {len(svg.encode()) / 1e6:.1f} MB: over {BIG / 1e6:.0f} MB the page loads slowly; merge small shapes")
    m = re.search(r'viewBox="([^"]+)"', svg)
    if not m:
        errs.append("the <svg> has no viewBox")
        vb = None
    else:
        vb = [float(x) for x in m.group(1).replace(",", " ").split()]
    by_id, seen, drawn = {}, set(), {}
    for r in shapes:
        if not isinstance(r, dict) or not r.get("id") or not isinstance(r.get("part"), str) or not r["part"].strip():
            errs.append(f"a record needs `id` and a `part` (what the shape is, in a few plain words): {str(r)[:80]}")
            continue
        if r["id"] in by_id:
            errs.append(f"two records share the id `{r['id']}`")
        by_id[r["id"]] = r
    for tag in re.findall(r"<(?:%s)\b[^>]*>" % "|".join(SHAPES), svg):
        a = attrs(tag)
        sid = a.get("id")
        if not sid:
            errs.append(f"a shape has no id: {tag[:70]}…")
            continue
        if sid in seen:
            errs.append(f"two shapes share the id `{sid}`")
        seen.add(sid)
        col, fill, stroke = paint_of(a)
        for what, c in (("fill", fill), ("stroke", stroke)):
            if c not in (None, "none") and not HEX.match(c):
                errs.append(f"shape `{sid}` has {what} `{c}`: write #rrggbb or none")
        drawn[sid] = col
    if len(errs) > 20:
        return None, errs[:20] + [f"… and {len(errs) - 20} more"], warns
    for sid in seen - by_id.keys():
        errs.append(f"shape `{sid}` has no record in {rec_path.name}")
    for sid in by_id.keys() - seen:
        errs.append(f"record `{sid}` names no shape in the drawing")
    paint = recs.get("paint")
    if paint:
        for sid, r in by_id.items():
            want, got = r.get(paint), drawn.get(sid)
            if not (isinstance(want, list) and len(want) == 3):
                errs.append(f"record `{sid}`: `{paint}` should be [r, g, b]")
            elif got and HEX.match(got) and [int(got[i:i + 2], 16) for i in (1, 3, 5)] != [int(v) for v in want]:
                errs.append(f"shape `{sid}` is drawn {got} but its record's `{paint}` is {want}")
            if len(errs) > 20:
                break
    return {"recs": recs, "ids": [r["id"] for r in shapes], "vb": vb}, errs[:20], warns


def hits(svg_path, info, grid):
    """Which shape is on top at the centre of each grid cell, as runs per row: [index, count, ...]; -1 is no shape."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("art: the hit map needs Playwright (the same browser the lesson check uses): pip install playwright && playwright install chromium")
    x0, y0, w, h = info["vb"]
    index = {sid: i for i, sid in enumerate(info["ids"])}
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1000, "height": 1000})
        pg.set_content('<!doctype html><body style="margin:0">' + svg_path.read_text(encoding="utf-8") + "</body>")
        rows = pg.evaluate("""([g, x0, y0, w, h, index]) => {
          const s = document.querySelector('svg'); s.style.width = '1000px'; s.style.height = (1000 * h / w) + 'px'; s.style.display = 'block';
          s.setAttribute('preserveAspectRatio', 'none');
          const r = s.getBoundingClientRect(), out = [];
          for (let j = 0; j < g; j++) { const row = []; let last = null, n = 0;
            for (let i = 0; i < g; i++) {
              const el = document.elementFromPoint(r.left + (i + .5) / g * r.width, r.top + (j + .5) / g * r.height);
              const k = el && el.id in index ? index[el.id] : -1;
              if (k === last) n++; else { if (last !== null) row.push(last, n); last = k; n = 1; } }
            row.push(last, n); out.push(row); }
          return out; }""", [grid, x0, y0, w, h, index])
        b.close()
    return {"viewBox": info["vb"], "grid": grid, "ids": info["ids"], "rows": rows}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("svg")
    ap.add_argument("--grid", type=int, default=400)
    a = ap.parse_args()
    f = Path(a.svg)
    if not f.is_file():
        sys.exit(f"art: {f} not found")
    info, errs, warns = check(f)
    for w in warns:
        print("WARN", w)
    for e in errs:
        print("ERR", e)
    if errs:
        sys.exit(1)
    hm = hits(f, info, a.grid)
    flat = [k for row in hm["rows"] for k in row[0::2]]
    empty = sum(n for row in hm["rows"] for k, n in zip(row[0::2], row[1::2]) if k < 0)
    if empty:
        print(f"WARN {empty} of {a.grid * a.grid} grid points fall on no shape: a spot there reads nothing; draw a background shape")
    out = f.with_suffix(".hits.json")
    out.write_text(json.dumps(hm, separators=(",", ":")) + "\n")
    print(f"art: {len(info['ids'])} shapes, {len(set(flat) - {-1})} seen on the {a.grid} × {a.grid} grid; wrote {out.name}")


if __name__ == "__main__":
    main()
