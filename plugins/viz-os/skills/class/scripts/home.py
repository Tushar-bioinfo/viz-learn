#!/usr/bin/env python3
"""Home data for viz-os class lessons: one small, seeded toy table from the learner's world, reused by every lesson.

Usage:
  home.py cells-x-markers --name cells --seed 7 [--n 6] [--markers CD3,CD19,CD14] [-o FILE]
  home.py genes-x-samples --name counts --seed 7 [--n 6] [--samples 3] [-o FILE]
  home.py --check FILE        regenerate FILE from the template, seed and sizes it records; exit 1 unless the bytes match

The table keeps its source's layout (R21): cells x markers has one row per cell (as a cytometry export does), and
genes x samples has one row per gene (as a count table does). Every lesson's make_data.py reads this file and copies
the rows it uses into its own data.json with the `provenance` block, so each lesson stays self-contained.
Pure Python (random.Random), so the same seed writes the same bytes on any machine. Default file: <viz-os home>/home/<name>.json.
"""
import argparse, json, math, os, random, sys
from pathlib import Path

VERSION = 1   # bump when a template's recipe changes; files record it, so --check knows which recipe made them

# cytometry-like marker levels after the usual arcsinh(x / 5) transform: ~0.5 is "off", ~4 is "bright"
MARKERS = {   # marker: mean level in T, B and monocyte cells
    "CD3": (4.4, 0.6, 0.5), "CD19": (0.5, 3.9, 0.4), "CD14": (0.4, 0.5, 4.1),
    "CD4": (3.2, 0.4, 1.8), "CD8": (1.6, 0.3, 0.3), "CD56": (0.6, 0.4, 0.7),
}
TYPES = ("T", "B", "mono")
CYCLE = (0, 1, 0, 2, 1, 0)   # T, B, T, mono, B, T: every type appears in the first 6 cells, T cells most often


def r(x, d=1):
    return round(x + 0.0, d)


def cells_x_markers(seed, n, markers):
    bad = [m for m in markers if m not in MARKERS]
    if bad:
        sys.exit(f"home: unknown marker {', '.join(bad)} (known: {', '.join(MARKERS)})")
    rng = random.Random(seed)
    types = [CYCLE[i % len(CYCLE)] for i in range(n)]
    values = [[r(max(0.0, rng.gauss(MARKERS[m][t], 0.45))) for m in markers] for t in types]
    return {
        "rows_are": "cells", "cols_are": "markers", "units": "arcsinh(intensity / 5)",
        "row_ids": [f"c{i + 1}" for i in range(n)], "row_info": {"type": [TYPES[t] for t in types]},
        "col_ids": list(markers), "values": values,
    }


def poisson(rng, lam):
    """Knuth's method for small means, a rounded normal for large ones (enough for a toy table)."""
    if lam > 60:
        return max(0, int(round(rng.gauss(lam, math.sqrt(lam)))))
    k, p, stop = 0, 1.0, math.exp(-lam)
    while True:
        p *= rng.random()
        if p <= stop:
            return k
        k += 1


def genes_x_samples(seed, n, per_group):
    rng = random.Random(seed)
    samples = [f"ctrl{j + 1}" for j in range(per_group)] + [f"treat{j + 1}" for j in range(per_group)]
    depth = [r(rng.uniform(0.7, 1.4), 2) for _ in samples]                     # library size factor per sample
    base = [r(math.exp(rng.uniform(math.log(5), math.log(800))), 1) for _ in range(n)]   # mean count per gene
    fold = [(4.0, 0.25)[g] if g < 2 else 1.0 for g in range(n)]   # g1 up 4x in treat, g2 down 4x, the rest flat
    disp = 0.1   # negative binomial: variance = mu + disp * mu^2
    values = []
    for g in range(n):
        row = []
        for j, _ in enumerate(samples):
            mu = base[g] * depth[j] * (fold[g] if j >= per_group else 1.0)
            row.append(poisson(rng, rng.gammavariate(1 / disp, mu * disp)))
        values.append(row)
    return {
        "rows_are": "genes", "cols_are": "samples", "units": "read counts",
        "row_ids": [f"g{g + 1}" for g in range(n)], "row_info": {"true_fold": fold},
        "col_ids": samples, "col_info": {"group": ["ctrl"] * per_group + ["treat"] * per_group, "depth": depth},
        "values": values,
    }


def make(template, name, seed, n, markers=None, samples=None):
    if template == "cells-x-markers":
        params = {"n": n, "markers": list(markers)}
        body = cells_x_markers(seed, n, markers)
    elif template == "genes-x-samples":
        params = {"n": n, "samples": samples}
        body = genes_x_samples(seed, n, samples)
    else:
        sys.exit(f"home: unknown template `{template}` (cells-x-markers, genes-x-samples)")
    doc = {"name": name, "provenance": {"template": template, "seed": seed, "params": params, "made_by": f"home.py v{VERSION}"}}
    doc.update(body)
    return doc


def dumps(doc):
    """One key per line and one table row per line, so a diff of two home files reads row by row."""
    head = [f" {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}" for k, v in doc.items() if k != "values"]
    rows = ",\n  ".join(json.dumps(row) for row in doc["values"])
    return "{\n" + ",\n".join(head) + f',\n "values": [\n  {rows}\n ]\n}}\n'


def home_dir():
    return Path(os.environ.get("VIZOS_HOME") or Path.home() / ".viz-os")


def check(path):
    path = Path(path)
    doc = json.loads(path.read_text())
    pv = doc.get("provenance") or {}
    if pv.get("made_by") != f"home.py v{VERSION}":
        sys.exit(f"home: {path} was made by {pv.get('made_by')}, this is home.py v{VERSION}; it cannot be checked byte for byte")
    p = pv.get("params") or {}
    again = dumps(make(pv.get("template"), doc.get("name"), pv.get("seed"), p.get("n"), p.get("markers"), p.get("samples")))
    if again != path.read_text():
        print(f"home: {path} does NOT match its template and seed")
        return 1
    print(f"home: {path} matches {pv['template']} seed {pv['seed']}")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("template", nargs="?")
    ap.add_argument("--name")
    ap.add_argument("--seed", type=int)
    ap.add_argument("--n", type=int, default=6, help="rows: cells or genes (default 6)")
    ap.add_argument("--markers", default="CD3,CD19,CD14")
    ap.add_argument("--samples", type=int, default=3, help="samples per group, genes-x-samples only (default 3)")
    ap.add_argument("-o", "--out")
    ap.add_argument("--check", metavar="FILE")
    a = ap.parse_args(argv)
    if a.check:
        return check(a.check)
    if not (a.template and a.name and a.seed is not None):
        ap.error("give a template, --name and --seed (or --check FILE)")
    doc = make(a.template, a.name, a.seed, a.n, a.markers.split(","), a.samples)
    out = Path(a.out) if a.out else home_dir() / "home" / f"{a.name}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(dumps(doc))
    print(f"home: wrote {out} ({doc['rows_are']} x {doc['cols_are']}: {len(doc['row_ids'])} x {len(doc['col_ids'])})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
