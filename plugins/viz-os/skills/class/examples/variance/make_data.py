#!/usr/bin/env python3
"""Data for the variance lesson: the six T cells of the learner's home table (../home/cells.json, 12 cells x 3 markers,
CD3 in arcsinh units), a second donor with the same mean, two patios of raindrops for the analogy, a 12-frame run that
tests n - 1 on many small samples, and a doublet for the what-if. Pure Python; seeded, so every run writes the same file.

Everything is computed from the home table's rounded values, so the page (which works from data.json) and this script agree.
"""
import json, math, random
from pathlib import Path

HERE = Path(__file__).resolve().parent
HOME = json.loads((HERE.parent / "home" / "cells.json").read_text())
rng = random.Random(3)

mean = lambda a: sum(a) / len(a)
var = lambda a, k=1: sum((x - mean(a)) ** 2 for x in a) / (len(a) - k)

# the home table, one row per cell, as it came
j3 = HOME["col_ids"].index("CD3")
types = HOME["row_info"]["type"]
allcells = [{"id": cid, "type": t, "cd3": row[j3]} for cid, t, row in zip(HOME["row_ids"], types, HOME["values"])]
# gate on T cells: the six the lesson works by hand
tcells = [dict(c) for c in allcells if c["type"] == "T"]
for k, c in enumerate(tcells):
    c["slot"] = round(0.7 * (k + 1), 1)   # where the cell sits along x in the picture
cd3 = [c["cd3"] for c in tcells]
n = len(cd3)
xbar = mean(cd3)
dev = [x - xbar for x in cd3]
sq = [d * d for d in dev]
ss = sum(sq)
s2 = ss / (n - 1)
top = sorted(range(n), key=lambda i: -sq[i])[:2]   # the two cells with the biggest squares
far = max(top, key=lambda i: dev[i])                # of those, the one above the mean

# the problem: a second donor with the same middle and three times the distances (so 9x the variance)
donor_b = [round(xbar + 3 * d, 1) for d in dev]

# the analogy: raindrops per tile on two patios, the same average, one even and one patchy
drops = 5
even = [drops + d for d in rng.sample([-1, 0, 0, 0, 0, 1], 6)]
patchy = [drops + d for d in rng.sample([-4, -2, -1, 1, 2, 4], 6)]

# the run: why n - 1. Suppose T-cell CD3 truly spreads with variance sig2 (our s2, to 2 decimals). Draw 3 cells at a
# time, many times, and keep a running average of each sample's spread, once dividing by n and once by n - 1.
sig2 = round(s2, 2)
draws = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
run_n, run_n1, tot_n, tot_n1 = [], [], 0.0, 0.0
for k in range(1, draws[-1] + 1):
    s = [rng.gauss(xbar, math.sqrt(sig2)) for _ in range(3)]
    tot_n += var(s, 0)
    tot_n1 += var(s, 1)
    if k in draws:
        run_n.append(tot_n / k)
        run_n1.append(tot_n1 / k)

# the what-if: the far cell really two cells stuck together (a doublet). Twice the light: asinh(2 sinh(x)) in these units.
dbl = round(math.asinh(2 * math.sinh(cd3[far])), 1)

# limits: all twelve cells at once, three kinds of cell
cd3_all = [c["cd3"] for c in allcells]
by_type = {t: [c["cd3"] for c in allcells if c["type"] == t] for t in ("B", "mono")}
sd = math.sqrt(s2)

data = {
    "home": {"name": HOME["name"], "provenance": HOME["provenance"]},
    "allcells": allcells, "tcells": tcells, "cd3": cd3, "slots": [c["slot"] for c in tcells], "n": n, "n_all": len(allcells),
    "xbar": xbar, "sum_dev": round(sum(dev), 10), "ss": ss, "s2": s2,
    "far_id": tcells[far]["id"], "far_k": far, "far_dev": dev[far], "far_sq": sq[far],
    "near_id": tcells[min(range(n), key=lambda i: sq[i])]["id"], "near_sq": min(sq),
    "top_ids": [tcells[i]["id"] for i in top], "top_sq": sum(sq[i] for i in top), "top_share": sum(sq[i] for i in top) / ss,
    "donor_a": cd3, "donor_b": donor_b, "mA": xbar, "mB": mean(donor_b), "sA": s2, "sB": var(donor_b), "ratio": var(donor_b) / s2,
    "even": even, "patchy": patchy, "drops": drops, "v_even": var(even), "v_patchy": var(patchy),
    "sig2": sig2, "draws": draws, "run_n": run_n, "run_n1": run_n1,
    "dbl": dbl, "cd3_b": by_type["B"], "cd3_mono": by_type["mono"], "s2_all": var(cd3_all), "all_ratio": var(cd3_all) / s2,
    "sd": sd, "z_far": dev[far] / sd,
}
(HERE / "data.json").write_text(json.dumps(data, indent=1) + "\n")
print(f"data.json: {n} T cells of {len(allcells)}, mean {xbar:.2f}, s2 {s2:.4f}, far {data['far_id']}, run {len(draws)} frames")
