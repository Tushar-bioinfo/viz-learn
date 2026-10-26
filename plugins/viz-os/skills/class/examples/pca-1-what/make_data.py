#!/usr/bin/env python3
"""Data for PCA episode 1 (What): six cells of the learner's home table (../home/cells.json; c1, c2, c3, c4, c5, c10:
two T cells, two B cells, two monocytes) on two markers, CD3 and CD19. The lesson centres them, drops each cell onto a
line through the middle (its shadow), and turns the line to find the direction with the most spread: PC1.

Pure Python, no randomness. Every number is computed from the home table's rounded values, so the page (which works
from data.json) and this script agree. The page has no sin or cos, so each angle's direction is stored here.
"""
import json, math
from pathlib import Path

HERE = Path(__file__).resolve().parent
HOME = json.loads((HERE.parent / "home" / "cells.json").read_text())
PICK = ["c1", "c2", "c3", "c4", "c5", "c10"]
STEP = 5                      # the run turns the line 5 degrees a frame, 0 to 180
HAND = (0.6, 0.8)             # the tilted line worked by hand: a 3-4-5 direction, so its length is exactly 1

mean = lambda a: sum(a) / len(a)
var = lambda a: sum((x - mean(a)) ** 2 for x in a) / (len(a) - 1)
dot = lambda u, d: u[0] * d[0] + u[1] * d[1]

j3, j19 = HOME["col_ids"].index("CD3"), HOME["col_ids"].index("CD19")
types = dict(zip(HOME["row_ids"], HOME["row_info"]["type"]))
vals = dict(zip(HOME["row_ids"], HOME["values"]))
cd3 = [vals[c][j3] for c in PICK]
cd19 = [vals[c][j19] for c in PICK]
n = len(PICK)
m1, m2 = mean(cd3), mean(cd19)
d1 = [x - m1 for x in cd3]
d2 = [y - m2 for y in cd19]
D = list(zip(d1, d2))
v_cd3, v_cd19 = var(d1), var(d2)
c12 = sum(a * b for a, b in D) / (n - 1)
tot = v_cd3 + v_cd19
spread = lambda u: sum(dot(u, d) ** 2 for d in D) / (n - 1)

# the tilted line by hand
assert abs(HAND[0] ** 2 + HAND[1] ** 2 - 1) < 1e-12
p = [dot(HAND, d) for d in D]
s2u = spread(HAND)

# the run: one frame per angle
ths = list(range(0, 181, STEP))
cosl = [math.cos(math.radians(t)) for t in ths]
sinl = [math.sin(math.radians(t)) for t in ths]
spl = [spread((c, s)) for c, s in zip(cosl, sinl)]
kbest = max(range(len(ths)), key=lambda k: spl[k])

# the exact peak: the top eigenvector of the 2 x 2 covariance matrix (closed form), angle in [0, 180)
a, b, c = v_cd3, c12, v_cd19
lam1 = (a + c) / 2 + math.sqrt(((a - c) / 2) ** 2 + b * b)
lam2 = (a + c) / 2 - math.sqrt(((a - c) / 2) ** 2 + b * b)
th_star = math.degrees(math.atan2(lam1 - a, b)) % 180
v = (math.cos(math.radians(th_star)), math.sin(math.radians(th_star)))
assert abs(spread(v) - lam1) < 1e-9 and all(spread((cc, ss)) <= lam1 + 1e-12 for cc, ss in zip(cosl, sinl))
score = [dot(v, d) for d in D]
th_low = (th_star + 90) % 180

cells = [{"id": cid, "type": types[cid], "cd3": x, "cd19": y, "d1": a_, "d2": b_}
         for cid, x, y, a_, b_ in zip(PICK, cd3, cd19, d1, d2)]

# limits: a 5-degree grid needs 36 directions per angle, and m markers need m - 1 angles
grid = lambda m: (180 // STEP) ** (m - 1)
# the same two markers on the T cells alone: another set of cells, another PC1
TC = [c for c in HOME["row_ids"] if types[c] == "T"]
T3, T19 = [vals[c][j3] for c in TC], [vals[c][j19] for c in TC]
ta, tb, tc = var(T3), sum((x - mean(T3)) * (y - mean(T19)) for x, y in zip(T3, T19)) / (len(TC) - 1), var(T19)
l1_t = (ta + tc) / 2 + math.sqrt(((ta - tc) / 2) ** 2 + tb * tb)
th_t = math.degrees(math.atan2(l1_t - ta, tb)) % 180

data = {
    "home": {"name": HOME["name"], "provenance": HOME["provenance"]},
    "cells": cells, "ids": PICK, "cd3": cd3, "cd19": cd19, "n": n, "n_home": len(HOME["row_ids"]),
    "m1": m1, "m2": m2, "d1": d1, "d2": d2,
    "v_cd3": v_cd3, "v_cd19": v_cd19, "tot": tot, "c12": c12, "share_cd3": v_cd3 / tot,
    "u1": HAND[0], "u2": HAND[1], "th_hand": math.degrees(math.atan2(HAND[1], HAND[0])), "p": p, "p1": p[0], "s2u": s2u,
    "ths": ths, "cosl": cosl, "sinl": sinl, "spl": spl, "n_frames": len(ths), "k_best": kbest,
    "th_best": ths[kbest], "sp_best": spl[kbest], "k_hand": round(math.degrees(math.atan2(HAND[1], HAND[0])) / STEP),
    "th_star": th_star, "lam1": lam1, "lam2": lam2, "v1": v[0], "v2": v[1], "score": score, "th_low": th_low,
    "share1": lam1 / tot, "lost": lam2 / tot,
    "grid2": grid(2), "grid3": grid(3), "m_panel": 30, "log_grid30": math.log10(grid(30)),
    "th_t": th_t, "lam1_t": l1_t, "n_t": len(TC),
}
(HERE / "data.json").write_text(json.dumps(data, indent=1) + "\n")
print(f"data.json: {n} cells, spread CD3 {v_cd3:.3f} CD19 {v_cd19:.3f}, hand {s2u:.4f}, grid best {ths[kbest]} deg "
      f"{spl[kbest]:.4f}, PC1 {th_star:.2f} deg {lam1:.4f} ({100 * lam1 / tot:.1f}%), T-cell PC1 {th_t:.1f} deg {l1_t:.3f}")
