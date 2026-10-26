#!/usr/bin/env python3
"""Data for PCA episode 2 (How): the same six cells as episode 1 (c1, c2, c3, c4, c5, c10 of ../home/cells.json) on
CD3 and CD19. The lesson finds the three numbers behind every line's spread (two spreads and the covariance), packs
them into the covariance matrix C, and finds PC1 as the arrow C only stretches: by sliding the angle, then by
repeating "multiply by C, shrink to length 1" (power iteration) from a flat arrow.

Pure Python, no randomness. The page has no sin, cos or atan, so every angle's direction and every arrow's angle is
stored here.
"""
import json, math
from pathlib import Path

HERE = Path(__file__).resolve().parent
HOME = json.loads((HERE.parent / "home" / "cells.json").read_text())
PICK = ["c1", "c2", "c3", "c4", "c5", "c10"]          # episode 1's cells
HAND = (0.6, 0.8)                                     # episode 1's hand tilt, length exactly 1
STEP = 5                                              # the angle slider moves 5 degrees at a time
START = (1.0, 0.0)                                    # the repeats start from the flat arrow, along CD3
REPS = 7                                              # repeats shown in the run
GAIN = 2                                              # the limits scene: CD3 read on a scale twice as wide

mean = lambda a: sum(a) / len(a)
cov = lambda a, b: sum((x - mean(a)) * (y - mean(b)) for x, y in zip(a, b)) / (len(a) - 1)
deg = lambda x, y: math.degrees(math.atan2(y, x)) % 180   # a line's angle, 0 to 180
norm = lambda x, y: math.hypot(x, y)

j3, j19 = HOME["col_ids"].index("CD3"), HOME["col_ids"].index("CD19")
types = dict(zip(HOME["row_ids"], HOME["row_info"]["type"]))
vals = dict(zip(HOME["row_ids"], HOME["values"]))
cd3 = [vals[c][j3] for c in PICK]
cd19 = [vals[c][j19] for c in PICK]
n = len(PICK)
m1, m2 = mean(cd3), mean(cd19)
d1 = [x - m1 for x in cd3]
d2 = [y - m2 for y in cd19]
prod = [a * b for a, b in zip(d1, d2)]
s11, s22, s12 = cov(cd3, cd3), cov(cd19, cd19), cov(cd3, cd19)
Cx = lambda u: (s11 * u[0] + s12 * u[1], s12 * u[0] + s22 * u[1])            # C times an arrow
quad = lambda u: u[0] ** 2 * s11 + 2 * u[0] * u[1] * s12 + u[1] ** 2 * s22   # the spread along u, from three numbers

# the exact answer (closed form for 2 x 2): PC1's stretch, PC2's stretch and PC1's angle
lam1 = (s11 + s22) / 2 + math.sqrt(((s11 - s22) / 2) ** 2 + s12 ** 2)
lam2 = (s11 + s22) / 2 - math.sqrt(((s11 - s22) / 2) ** 2 + s12 ** 2)
th_star = math.degrees(math.atan2(lam1 - s11, s12)) % 180
th_low = (th_star + 90) % 180

# the hand tilt, three ways: one cell's square expanded, the spread from three numbers, and C times u
p0 = HAND[0] * d1[0] + HAND[1] * d2[0]
hu = Cx(HAND)

# the angle slider: u at each angle, C u, and C u's own angle
ths = list(range(0, 181, STEP))
ux = [math.cos(math.radians(t)) for t in ths]
uy = [math.sin(math.radians(t)) for t in ths]
cux = [Cx((a, b))[0] for a, b in zip(ux, uy)]
cuy = [Cx((a, b))[1] for a, b in zip(ux, uy)]
cth = [deg(a, b) for a, b in zip(cux, cuy)]
gap = [min(abs(c - t) % 180, 180 - abs(c - t) % 180) for c, t in zip(cth, ths)]   # how far apart the two lines are

# power iteration: u -> C u -> divide by its length
pu = [START]
for _ in range(REPS):
    v = Cx(pu[-1]); L = norm(*v); pu.append((v[0] / L, v[1] / L))
pcu = [Cx(u) for u in pu]
plen = [norm(*v) for v in pcu]
pth = [deg(*u) for u in pu]
pq = [quad(u) for u in pu]                 # the spread along u at each repeat
perr = [lam1 - q for q in pq]
assert all(e > 0 for e in perr) and abs(pth[-1] - th_star) < 1e-2

# the limits scene: CD3 on a scale twice as wide, and each marker divided by its SD (standardised)
g11, g12 = GAIN ** 2 * s11, GAIN * s12
lam1_g = (g11 + s22) / 2 + math.sqrt(((g11 - s22) / 2) ** 2 + g12 ** 2)
th_g = math.degrees(math.atan2(lam1_g - g11, g12)) % 180
r12 = s12 / math.sqrt(s11 * s22)
th_r = math.degrees(math.atan2(abs(r12), r12)) % 180      # for a 2 x 2 correlation matrix PC1 is the 45 or 135 degree line

cells = [{"id": c, "type": types[c], "cd3": x, "cd19": y, "d1": a, "d2": b, "prod": q}
         for c, x, y, a, b, q in zip(PICK, cd3, cd19, d1, d2, prod)]
data = {
    "home": {"name": HOME["name"], "provenance": HOME["provenance"]},
    "cells": cells, "ids": PICK, "n": n, "cd3": cd3, "cd19": cd19, "m1": m1, "m2": m2, "d1": d1, "d2": d2, "prod": prod,
    "n_neg": sum(q < 0 for q in prod),
    "v_cd3": s11, "v_cd19": s22, "c12": s12,
    "cmat": [{"name": "CD3", "cd3": s11, "cd19": s12}, {"name": "CD19", "cd3": s12, "cd19": s22}],
    "u1": HAND[0], "u2": HAND[1], "uvec": list(HAND), "th_hand": deg(*HAND),
    "p0": p0, "s2u": quad(HAND), "cu1": hu[0], "cu2": hu[1], "cu_th": deg(*hu),
    "ths": ths, "n_lines": len(ths), "sweep": [quad((a, b)) for a, b in zip(ux, uy)], "ux": ux, "uy": uy, "cux": cux, "cuy": cuy, "cth": cth, "gap": gap,
    "lam1": lam1, "lam2": lam2, "th_star": th_star, "th_low": th_low, "v1": math.cos(math.radians(th_star)), "v2": math.sin(math.radians(th_star)), "ratio": lam2 / lam1, "ratio2": (lam2 / lam1) ** 2,
    "a1": START[0], "a2": START[1], "reps": REPS, "steps_t": list(range(REPS + 1)),
    "pu1": [u[0] for u in pu], "pu2": [u[1] for u in pu], "pcu1": [v[0] for v in pcu], "pcu2": [v[1] for v in pcu],
    "plen": plen, "pth": pth, "pq": pq, "perr": perr,
    "gain": GAIN, "th_g": th_g, "r12": r12, "th_r": th_r,
}
(HERE / "data.json").write_text(json.dumps(data, indent=1) + "\n")
print(f"data.json: covariance {s12:.3f}, hand {quad(HAND):.4f}, C u = ({hu[0]:.3f}, {hu[1]:.3f}) at {deg(*hu):.1f} deg; "
      f"PC1 {th_star:.2f} deg, stretch {lam1:.4f}, PC2 {lam2:.4f}; repeats: "
      + ", ".join(f"{t:.1f}" for t in pth) + f"; CD3 x{GAIN}: {th_g:.1f} deg; standardised {th_r:.0f} deg (r {r12:.3f})")
