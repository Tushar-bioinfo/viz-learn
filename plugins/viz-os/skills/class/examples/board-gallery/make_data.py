#!/usr/bin/env python3
"""Data for the board gallery: six cells on three markers (CD3, CD19, CD4, 0-10 scale), two donors for a comparison,
a 12-frame perceptron run on eight other cells, and a picture of the six cells. Pure Python plus pillow for the picture; seeded, so every run writes the same files.

Variance divides by n - 1. Values are rounded to 1 decimal first; everything after is computed from the rounded values,
so the page (which works from data.json) and this script agree.
"""
import json, random
from pathlib import Path

HERE = Path(__file__).resolve().parent
rng = random.Random(11)
r1 = lambda v: round(min(9.8, max(0.2, v)), 1)

cells = [{"id": f"c{i + 1}", "cd3": r1(rng.gauss(6.0, 1.4)), "cd19": r1(rng.gauss(3.0, 1.2)), "cd4": r1(rng.gauss(4.5, 1.8))} for i in range(6)]
for i, c in enumerate(cells):
    c["i"] = i + 1   # the cell number, for a picture with cells along x
cd3 = [c["cd3"] for c in cells]
n = len(cd3)
mean = lambda a: sum(a) / len(a)
var = lambda a: sum((x - mean(a)) ** 2 for x in a) / (len(a) - 1)
xbar = mean(cd3)
dev = [x - xbar for x in cd3]
far = max(range(n), key=lambda i: abs(dev[i]))

# two donors with the same average CD3 and different spread: B is A stretched about its mean
a = [r1(rng.gauss(6.0, 0.5)) for _ in range(6)]
ma = mean(a)
b = [round(ma + 2.4 * (x - ma), 1) for x in a]

data = {
    "cells": cells, "cd3": cd3, "n": n, "xbar": xbar,
    "sum_dev": round(sum(dev), 10),   # zero, up to float rounding
    "ss": sum(d * d for d in dev), "s2": var(cd3), "sd": var(cd3) ** 0.5,
    "far_id": cells[far]["id"], "far_i": far + 1, "far_dev": abs(dev[far]),
    "mvar_cd19": var([c["cd19"] for c in cells]), "mvar_cd4": var([c["cd4"] for c in cells]),
    "donor_a": a, "donor_b": b, "mA": mean(a), "mB": mean(b), "sA": var(a), "sB": var(b), "ratio": var(b) / var(a),
}
# a perceptron run for the plane: four T cells (high CD3) and four B cells (high CD19), a wrong starting line, then
# one update per wrong cell (w += eta * y * (1, CD3, CD19), y = +1 for T, -1 for B), cells checked in order until none
# is wrong. The seed is the first that needs exactly 11 updates (12 frames, 0 = the start) with the cells apart.
def perceptron(seed, eta=0.1, w=(0.5, -0.1, 0.1)):
    g = random.Random(seed); q = lambda v: round(min(9.6, max(0.4, v)), 1)
    T = [{"cd3": q(g.gauss(7, 1.0)), "cd19": q(g.gauss(3, 1.0)), "kind": "T"} for _ in range(4)]
    B = [{"cd3": q(g.gauss(3.5, 1.0)), "cd19": q(g.gauss(6.5, 1.0)), "kind": "B"} for _ in range(4)]
    pc = [c for pair in zip(T, B) for c in pair]
    for i, c in enumerate(pc):
        c["id"] = f"p{i + 1}"
    w, trace, picks = list(w), [tuple(w)], []
    for _ in range(50):
        moved = False
        for i, c in enumerate(pc):
            y = 1 if c["kind"] == "T" else -1
            if y * (w[0] + w[1] * c["cd3"] + w[2] * c["cd19"]) <= 0:
                w = [w[0] + eta * y, w[1] + eta * y * c["cd3"], w[2] + eta * y * c["cd19"]]
                trace.append(tuple(w)); picks.append(i); moved = True
        if not moved:
            return pc, trace, picks, eta
    return pc, None, None, eta

def apart(pc, gap=0.8):   # no two cells closer than `gap` units, so a ring or a name points at one cell
    return all(((a["cd3"] - b["cd3"]) ** 2 + (a["cd19"] - b["cd19"]) ** 2) ** 0.5 >= gap for i, a in enumerate(pc) for b in pc[i + 1:])

pseed = next(sd for sd in range(1, 5000) if (lambda r: r[1] is not None and len(r[1]) == 12 and apart(r[0]))(perceptron(sd)))
pcells, trace, picks, eta = perceptron(pseed)
# the lesson's think answer says each update puts its own cell right; hold the data to it
for f, i in enumerate(picks, 1):
    c, y = pcells[i], (1 if pcells[i]["kind"] == "T" else -1)
    assert y * (trace[f][0] + trace[f][1] * c["cd3"] + trace[f][2] * c["cd19"]) > 0, f"update {f} leaves {c['id']} wrong"
# frame f's ring: the wrong cell the next update uses (none after the last frame; `has_next` hides it there)
nxt = picks + [picks[-1]]
data.update({
    "pcells": pcells, "eta": eta, "updates": len(picks), "pseed": pseed,
    "w0_trace": [t[0] for t in trace], "w1_trace": [t[1] for t in trace], "w2_trace": [t[2] for t in trace],
    "next_x": [pcells[i]["cd3"] for i in nxt], "next_y": [pcells[i]["cd19"] for i in nxt],
    "next_id": [pcells[i]["id"] for i in nxt], "has_next": [1] * len(picks) + [0],
    # the cell fixed most often: each update fixes its own cell, but a later one can push it wrong again
    "redo_id": pcells[max(set(picks), key=lambda i: (picks.count(i), -i))]["id"], "redo_n": max(picks.count(i) for i in set(picks)),
})

(HERE / "data.json").write_text(json.dumps(data, indent=1) + "\n")

# the picture: six cells in a row, brighter orange for more CD3; no words or numbers on it (the kit draws the labels)
from PIL import Image, ImageDraw
W, H = 1200, 360
img = Image.new("RGB", (W, H), (20, 20, 22))
d = ImageDraw.Draw(img)
lo, hi = min(cd3), max(cd3)
for i, x in enumerate(cd3):
    t = (x - lo) / (hi - lo)
    cx, cy, r = int((i + 0.5) * W / n), H // 2 - 20, 70
    fill = tuple(int(g + t * (o - g)) for g, o in zip((58, 58, 62), (255, 106, 51)))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill, outline=(150, 150, 150), width=4)
    d.ellipse([cx - 22, cy - 18, cx + 18, cy + 22], fill=(34, 34, 40))   # the nucleus
img.save(HERE / "cells.png", optimize=True)
print("cells", [(c["id"], c["cd3"]) for c in cells], "xbar", round(xbar, 3), "s2", round(data["s2"], 4), "far", data["far_id"],
      "donors", a, b, "ratio", round(data["ratio"], 3),
      "perceptron seed", pseed, "updates", len(picks), "picks", [pcells[i]["id"] for i in picks])
