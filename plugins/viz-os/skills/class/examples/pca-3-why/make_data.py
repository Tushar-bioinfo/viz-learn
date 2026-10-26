#!/usr/bin/env python3
"""Data for PCA episode 3 (Why): the same six cells as episodes 1 and 2 (c1, c2, c3, c4, c5, c10 of ../home/cells.json).
First on CD3 and CD19: any arrow is a mix of PC1 and PC2, and its spread is a²·λ1 + b²·λ2, so nothing beats PC1.
Then CD14 joins: the 3 x 3 covariance matrix, its three PCs (found by the repeats of part 2, then deflation), the cells'
scores, what one PC loses, and the share each PC keeps.

Pure Python, no randomness, no numpy (verify_data.py uses numpy). Each PC's sign is fixed by a rule, written below,
because the maths leaves it open.
"""
import json, math
from pathlib import Path

HERE = Path(__file__).resolve().parent
HOME = json.loads((HERE.parent / "home" / "cells.json").read_text())
PICK = ["c1", "c2", "c3", "c4", "c5", "c10"]          # episodes 1 and 2's cells
MARK = ["CD3", "CD19", "CD14"]
U = (1.0, 0.0)                                        # the arrow split by hand: the CD3 line
HAND = (0.6, 0.8)                                     # part 1's hand tilt
REPS = 200                                            # repeats for each 3-D PC (far past convergence)
LOST = "c4"                                           # the cell whose loss is worked by hand

mean = lambda a: sum(a) / len(a)
dot = lambda a, b: sum(x * y for x, y in zip(a, b))
mv = lambda M, v: [dot(r, v) for r in M]

types = dict(zip(HOME["row_ids"], HOME["row_info"]["type"]))
vals = dict(zip(HOME["row_ids"], HOME["values"]))
J = [HOME["col_ids"].index(m) for m in MARK]
X = [[vals[c][j] for j in J] for c in PICK]
n, m = len(PICK), len(MARK)
mu = [mean([r[k] for r in X]) for k in range(m)]
Dm = [[r[k] - mu[k] for k in range(m)] for r in X]
col = lambda k: [r[k] for r in Dm]
C3 = [[dot(col(a), col(b)) / (n - 1) for b in range(m)] for a in range(m)]

# --- two markers: PC1 and PC2 in closed form, and the split of an arrow into the two
s11, s12, s22 = C3[0][0], C3[0][1], C3[1][1]
lam1 = (s11 + s22) / 2 + math.sqrt(((s11 - s22) / 2) ** 2 + s12 ** 2)
lam2 = (s11 + s22) / 2 - math.sqrt(((s11 - s22) / 2) ** 2 + s12 ** 2)
th1 = math.degrees(math.atan2(lam1 - s11, s12)) % 180            # PC1's angle, 0..180 (CD19 part positive), as part 1
th2 = (th1 + 90) % 180                                             # PC2: a right angle on
v = (math.cos(math.radians(th1)), math.sin(math.radians(th1)))
w = (math.cos(math.radians(th2)), math.sin(math.radians(th2)))
spread2 = lambda u: (u[0] ** 2 * s11 + 2 * u[0] * u[1] * s12 + u[1] ** 2 * s22)
a, b = dot(U, v), dot(U, w)
ha, hb = dot(HAND, v), dot(HAND, w)
assert abs(a * a * lam1 + b * b * lam2 - spread2(U)) < 1e-12 and abs(ha * ha * lam1 + hb * hb * lam2 - spread2(HAND)) < 1e-12

# --- three markers: the repeats of part 2, then the same on what is left (deflation)
def top(M):
    u = [1.0] + [0.0] * (m - 1)
    for _ in range(REPS):
        y = mv(M, u); L = math.sqrt(dot(y, y)); u = [x / L for x in y]
    return dot(u, mv(M, u)), u
lams, vecs, M = [], [], [row[:] for row in C3]
for k in range(m):
    lk, uk = top(M)
    # the sign rule: PC1's CD19 part positive (as part 1), PC2's CD14 part positive, PC3's CD3 part positive
    pin = [1, 2, 0][k]
    if uk[pin] < 0:
        uk = [-x for x in uk]
    lams.append(lk); vecs.append(uk)
    M = [[M[i][j] - lk * uk[i] * uk[j] for j in range(m)] for i in range(m)]
assert lams[0] > lams[1] > lams[2] > 0
Z = [[dot(r, e) for e in vecs] for r in Dm]                         # each cell's three scores
tot3 = sum(C3[k][k] for k in range(m))
assert abs(sum(lams) - tot3) < 1e-9
iL = PICK.index(LOST)
cv1 = mv(C3, vecs[0])                                              # C times PC1: PC1 stretched by lambda 1
lost = [z[1] ** 2 + z[2] ** 2 for z in Z]

cells = [{"id": c, "type": types[c], "cd3": x[0], "cd19": x[1], "cd14": x[2], "d1": d[0], "d2": d[1], "d3": d[2],
          "z1": z[0], "z2": z[1], "z3": z[2], "lost": l}
         for c, x, d, z, l in zip(PICK, X, Dm, Z, lost)]
data = {
    "home": {"name": HOME["name"], "provenance": HOME["provenance"]},
    "cells": cells, "ids": PICK, "n": n, "markers": MARK,
    "d1": col(0), "d2": col(1), "d3": col(2), "m3": mu[2],
    "v_cd3": s11, "v_cd19": s22, "c12": s12, "v_cd14": C3[2][2], "c13": C3[0][2], "c23": C3[1][2],
    # two markers
    "lam1": lam1, "lam2": lam2, "th1": th1, "th2": th2, "v1": v[0], "v2": v[1], "w1": w[0], "w2": w[1],
    "u1": U[0], "u2": U[1], "a": a, "b": b, "a2": a * a, "b2": b * b, "s2u": spread2(U),
    "h1": HAND[0], "h2": HAND[1], "ha": ha, "hb": hb, "hb2": hb * hb, "s2h": spread2(HAND),
    "ax": a * v[0], "ay": a * v[1],                                # the PC1 part of u, drawn
    # three markers
    "cmat3": [{"name": nm, "cd3": r[0], "cd19": r[1], "cd14": r[2]} for nm, r in zip(MARK, C3)],
    "L1": lams[0], "L2": lams[1], "L3": lams[2], "tot3": tot3,
    "e1": vecs[0], "e2": vecs[1], "e3": vecs[2], "cv1": cv1, "ratio_cv": [c / e for c, e in zip(cv1, vecs[0])],
    "z1": [z[0] for z in Z], "z2": [z[1] for z in Z], "z3": [z[2] for z in Z],
    "z1min": min(z[0] for z in Z), "z1max": max(z[0] for z in Z), "z2min": min(z[1] for z in Z), "z2max": max(z[1] for z in Z),
    "lost_row": iL, "lost_cell": LOST, "lost_one": lost[iL], "lost_all": sum(lost),
    "shares": [l / tot3 for l in lams], "share1": lams[0] / tot3, "share12": (lams[0] + lams[1]) / tot3,
    "pcs": ["PC1", "PC2", "PC3"],
}
(HERE / "data.json").write_text(json.dumps(data, indent=1) + "\n")
print(f"data.json: 2-D split of (1, 0): a {a:.3f} b {b:.3f} -> {a*a*lam1 + b*b*lam2:.3f}; hand tilt b^2 {hb*hb:.4f}; "
      f"cov(CD3, CD14) {C3[0][2]:.3f}; 3-D stretches " + ", ".join(f"{l:.3f}" for l in lams)
      + f" (shares " + ", ".join(f"{100*l/tot3:.1f}%" for l in lams) + f"); PC1 {[round(x, 3) for x in vecs[0]]}; "
      f"{LOST} loses {lost[iL]:.3f}, all {sum(lost):.3f}")
