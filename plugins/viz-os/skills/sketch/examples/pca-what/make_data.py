#!/usr/bin/env python3
"""Data for the PCA page: six cells of the home table (c1, c2, c3, c4, c5, c10: two T cells, two B cells, two monocytes)
on CD3 and CD19. The page follows them from a table to one score per cell.

Pure Python, no randomness. The page cannot do sin or cos, so every direction it draws is stored here.
"""
import json, math
from pathlib import Path

HERE = Path(__file__).resolve().parent
HOME = json.loads((HERE.parent.parent.parent / "class" / "examples" / "home" / "cells.json").read_text())
PICK = ["c1", "c2", "c3", "c4", "c5", "c10"]
STEP = 5                      # the slider turns the line 5 degrees at a time
HAND = (0.6, 0.8)             # the tilted line worked by hand: a 3-4-5 direction, so its length is exactly 1
BIG = 100                     # the limit: CD3 read in units this many times smaller
REACH = 3.3                   # half the length of a drawn line, in marker units

mean = lambda a: sum(a) / len(a)
var = lambda a: sum((x - mean(a)) ** 2 for x in a) / (len(a) - 1)
cov = lambda a, b: sum((x - mean(a)) * (y - mean(b)) for x, y in zip(a, b)) / (len(a) - 1)


def top(a, b, c):
    """The top eigenvalue, its angle in [0, 180) and its direction for [[a, b], [b, c]], in closed form."""
    lam = (a + c) / 2 + math.sqrt(((a - c) / 2) ** 2 + b * b)
    th = math.degrees(math.atan2(lam - a, b)) % 180
    return lam, th, (math.cos(math.radians(th)), math.sin(math.radians(th)))


j3, j19 = HOME["col_ids"].index("CD3"), HOME["col_ids"].index("CD19")
kinds = dict(zip(HOME["row_ids"], HOME["row_info"]["type"]))
vals = dict(zip(HOME["row_ids"], HOME["values"]))
cd3 = [vals[c][j3] for c in PICK]
cd19 = [vals[c][j19] for c in PICK]
n = len(PICK)
m1, m2 = mean(cd3), mean(cd19)
d1 = [x - m1 for x in cd3]
d2 = [y - m2 for y in cd19]
along = lambda u: [u[0] * a + u[1] * b for a, b in zip(d1, d2)]
spread = lambda u: sum(p ** 2 for p in along(u)) / (n - 1)

# the line worked by hand
p = along(HAND)
footx, footy = [q * HAND[0] for q in p], [q * HAND[1] for q in p]
s2u = spread(HAND)
sq = [q ** 2 for q in p]

# every angle: the spread, the drawn line and each cell's shadow
ths = list(range(0, 180, STEP))
cosl = [math.cos(math.radians(t)) for t in ths]
sinl = [math.sin(math.radians(t)) for t in ths]
spl = [spread(u) for u in zip(cosl, sinl)]
rx, ry = [REACH * c for c in cosl], [REACH * s for s in sinl]
fx = [[q * c for q in along((c, s))] for c, s in zip(cosl, sinl)]
fy = [[q * s for q in along((c, s))] for c, s in zip(cosl, sinl)]

# the best line
v_cd3, v_cd19, c12 = var(d1), var(d2), cov(d1, d2)
tot = v_cd3 + v_cd19
lam1, th_star, v = top(v_cd3, c12, v_cd19)
lam2 = tot - lam1
v1, v2 = v
score = along(v)
left = [-v2 * a + v1 * b for a, b in zip(d1, d2)]    # what the score leaves out: distance from the line
assert all(s <= lam1 + 1e-12 for s in spl)

# the same cells, split by kind, so each kind can have its own colour
by = lambda a, kind: [x for c, x in zip(PICK, a) if kinds[c] == kind]
parts = {}
for key, kind in (("t", "T"), ("b", "B"), ("m", "mono")):
    parts |= {f"{key}ids": by(PICK, kind), f"{key}3": by(cd3, kind), f"{key}19": by(cd19, kind), f"{key}d1": by(d1, kind), f"{key}d2": by(d2, kind),
              f"{key}s": by(score, kind), f"{key}l": by(left, kind)}

# the limit: read CD3 in smaller units, and the line swings onto CD3
big = [x * BIG for x in cd3]
vb, cb = var(big), cov(big, cd19)
lam_b, th_b, vbig = top(vb, cb, v_cd19)
share_big = lam_b / (vb + v_cd19)

# the other path: put each marker in its own standard deviations first
z1, z2 = [x / math.sqrt(v_cd3) for x in d1], [y / math.sqrt(v_cd19) for y in d2]
r = cov(z1, z2)
lam_z, th_z, vz = top(var(z1), r, var(z2))
share_z = lam_z / 2

data = {
    "home": {"name": HOME["name"], "provenance": HOME["provenance"]},
    "ids": PICK, "kinds": [kinds[c] for c in PICK], "cd3": cd3, "cd19": cd19, "n": n, "m_kept": 2, "zero": [0] * n, "kept": 1,
    "sum3": sum(cd3), "sum19": sum(cd19), "m1": m1, "m2": m2, "d1": d1, "d2": d2, "d1c1": d1[0], "d2c1": d2[0],
    "u1": HAND[0], "u2": HAND[1], "uvec": list(HAND), "rowu": [HAND[0], HAND[1]], "p": p, "p1": p[0], "sq": sq, "sumsq": sum(sq), "df": n - 1, "s2u": s2u,
    "rux": REACH * HAND[0], "ruy": REACH * HAND[1], "footx": footx, "footy": footy,
    "ths": ths, "cosl": cosl, "sinl": sinl, "spl": spl, "rx": rx, "ry": ry, "fx": fx, "fy": fy,
    "hi_th": ths[max(range(len(ths)), key=lambda k: spl[k])], "lo_th": ths[min(range(len(ths)), key=lambda k: spl[k])],
    "v_cd3": v_cd3, "v_cd19": v_cd19, "c12": c12, "tot": tot, "share_cd3": v_cd3 / tot,
    "lam1": lam1, "lam2": lam2, "th_star": th_star, "v1": v1, "v2": v2, "share1": lam1 / tot, "lost": lam2 / tot,
    "rvx": REACH * v1, "rvy": REACH * v2, "score": score, "left": left,
    **parts,
    "big": BIG, "th_b": th_b, "share_big": share_big, "bigx": big, "v_big": vb,
    "th_z": th_z, "share_z": share_z, "r": r,
    "markers": ["CD3", "CD19"], "cov1": [v_cd3, c12], "cov2": [c12, v_cd19], "rowv": [v1, v2],
    "routes": ["as measured", "smaller CD3", "both scaled"], "route_th": [th_star, th_b, th_z], "route_share": [lam1 / tot, share_big, share_z],
}
(HERE / "data.json").write_text(json.dumps(data, indent=1) + "\n")
print(f"data.json: {n} cells, hand spread {s2u:.4f}, PC1 {th_star:.2f} deg {lam1:.4f} ({100 * lam1 / tot:.1f}%), "
      f"big units {th_b:.2f} deg ({100 * share_big:.1f}%), scaled {th_z:.1f} deg ({100 * share_z:.1f}%)")
