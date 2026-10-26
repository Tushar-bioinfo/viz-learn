#!/usr/bin/env python3
"""Data for the perceptron-trick lesson: eight cells of the learner's home table (../home/cells.json, CD3 and CD19 in
arcsinh units), four T cells (label y = 1) and four B cells (y = 0), a bad starting line, the trick worked by hand on
one wrong cell, a run of updates until no cell is wrong, two runs that stop at two different lines, a ninth cell typed
wrong that no line can fit, and four thymocyte groups for the next lesson. Pure Python; seeded, so every run writes the
same file.

A line is three weights (w0, w1, w2): a cell's score is w0 + w1 * CD3 + w2 * CD19, and a score of 0 or more calls it T.
One update on a wrong cell: w <- w + eta * (y - yhat) * (1, CD3, CD19).
"""
import json, math, random
from pathlib import Path

HERE = Path(__file__).resolve().parent
HOME = json.loads((HERE.parent / "home" / "cells.json").read_text())
J = {m: HOME["col_ids"].index(m) for m in ("CD3", "CD19")}
TYPE = dict(zip(HOME["row_ids"], HOME["row_info"]["type"]))
ROW = dict(zip(HOME["row_ids"], HOME["values"]))


def cell(cid, y=None):
    t = TYPE[cid]
    return {"id": cid, "kind": t, "cd3": ROW[cid][J["CD3"]], "cd19": ROW[cid][J["CD19"]], "y": int(t == "T") if y is None else y}


# the first four T cells and all four B cells of the home table, in table order (c9, the fifth T cell, joins at the limits)
first_t = [c for c in HOME["row_ids"] if TYPE[c] == "T"][:4]
pcells = [cell(c) for c in HOME["row_ids"] if c in first_t or TYPE[c] == "B"]
assert len(pcells) == 8 and "c9" not in first_t
score = lambda w, c: w[0] + w[1] * c["cd3"] + w[2] * c["cd19"]
call = lambda w, c: int(score(w, c) >= 0)
wrong = lambda w, cs: sum(call(w, c) != c["y"] for c in cs)

START = (9.0, -2.1, 0.9)   # a bad first line: steep, through the T cells; it calls every B cell and two T cells wrong
ETA = 0.1


def run(cs, seed, eta=ETA, w=START, epochs=1000):
    """Visit every cell once per epoch, in a shuffled order; update on each wrong one. Stop after an epoch with no update."""
    g, w = random.Random(seed), list(w)
    trace, picks, ep_of, err = [tuple(w)], [], [], []
    for e in range(1, epochs + 1):
        order = list(range(len(cs)))
        g.shuffle(order)
        moved = False
        for k in order:
            c = cs[k]
            d = c["y"] - call(w, c)
            if d:
                w = [w[0] + eta * d, w[1] + eta * d * c["cd3"], w[2] + eta * d * c["cd19"]]
                trace.append(tuple(w)); picks.append(k); ep_of.append(e); moved = True
        err.append(wrong(w, cs))
        if not moved:
            return trace, picks, ep_of, err
    return trace, picks, ep_of, err


def angle(w):   # the direction of a line, in degrees
    return math.degrees(math.atan2(-w[1], w[2])) % 180


# the main run: the first seed with 8 to 14 updates, at least two of them adds (a T cell called B)
def good(sd):
    tr, pk, _, err = run(pcells, sd)
    adds = sum(pcells[k]["y"] == 1 for k in pk)
    return err[-1] == 0 and 8 <= len(pk) <= 14 and adds >= 2
seed = next(sd for sd in range(1, 5000) if good(sd))
trace, picks, ep_of, err = run(pcells, seed)
wf = trace[-1]
assert wrong(wf, pcells) == 0
nxt = picks + [picks[-1]]
plus_frame = next(f for f, k in enumerate(picks) if pcells[k]["y"] == 1)   # first frame whose next update is an add

# the trick by hand, on c5 (a B cell the start line calls T)
k5 = next(i for i, c in enumerate(pcells) if c["id"] == "c5")
c5 = pcells[k5]
assert c5["y"] == 0 and call(START, c5) == 1
x5 = [1, c5["cd3"], c5["cd19"]]
w_big = [w - 1 * x for w, x in zip(START, x5)]      # eta = 1
w_small = [w - ETA * x for w, x in zip(START, x5)]  # eta = 0.1
trick = [{"part": p, "xv": x, "wv": w} for p, x, w in zip(["offset", "CD3", "CD19"], x5, START)]

# the four cases of y - yhat
cases = [{"y": y, "call": yh, "what": what} for y, yh, what in
         [(1, 1, "right: no move"), (0, 0, "right: no move"), (1, 0, "T called B: add"), (0, 1, "B called T: subtract")]]

# limits 1: the same shuffles from all-zero weights stop at another line, also with no cell wrong. The perceptron stops at
# the first line that works, so how close it passes to a cell is luck
ZERO = (0.0, 0.0, 0.0)
tr2, pk2, _, err2 = run(pcells, seed, w=ZERO)
wf2 = tr2[-1]
assert err2[-1] == 0 and wrong(wf2, pcells) == 0
# how close a line passes to the cells: the distance from the nearest cell to it
dist = lambda w, c: abs(score(w, c)) / math.hypot(w[1], w[2])
gap = lambda w: min(dist(w, c) for c in pcells)
graze = min(pcells, key=lambda c: dist(wf, c))

# limits 2: c9, a T cell, typed B by mistake. It sits on the segment between c1 and c3, so a line with both on the T
# side has it there too: no line can get all nine right
c9 = cell("c9", y=0)
c1, c3 = (next(c for c in pcells if c["id"] == k) for k in ("c1", "c3"))
assert c9["cd19"] == c1["cd19"] == c3["cd19"] and c1["cd3"] < c9["cd3"] < c3["cd3"]
nine = pcells + [c9]
_, pk9, _, err9 = run(nine, seed, epochs=1000)
assert min(err9) > 0

# next: thymocytes on CD4 x CD8. Single-positive (SP4, SP8) against double-negative (DN) and double-positive (DP)
g = random.Random(11)
q = lambda v: round(max(0.0, v), 1)
centres = {"DN": (0.6, 0.6), "DP": (3.8, 3.8), "SP4": (3.8, 0.6), "SP8": (0.6, 3.8)}
thymo = [{"id": f"t{i + 1}", "kind": k, "cd4": q(g.gauss(cx, 0.35)), "cd8": q(g.gauss(cy, 0.35)), "y": int(k.startswith("SP"))}
         for i, (k, (cx, cy)) in enumerate((k, v) for k, v in centres.items() for _ in range(4))]


def best_line(cs, xk, yk):
    """The fewest cells any straight line gets wrong: sweep directions; for each, try every cut between projections."""
    best = len(cs)
    for a in range(0, 3600):
        u = (math.cos(math.radians(a / 10)), math.sin(math.radians(a / 10)))
        pr = sorted((u[0] * c[xk] + u[1] * c[yk], c["y"]) for c in cs)
        for i in range(len(pr) + 1):   # cells 0..i-1 called 0, i.. called 1
            best = min(best, sum(y for _, y in pr[:i]) + sum(1 - y for _, y in pr[i:]))
    return best
xor_best = best_line(thymo, "cd4", "cd8")
assert xor_best > 0

data = {
    "home": {"name": HOME["name"], "provenance": HOME["provenance"]},
    "pcells": pcells, "n": len(pcells), "cd3": [c["cd3"] for c in pcells], "cd19": [c["cd19"] for c in pcells],
    "y": [c["y"] for c in pcells], "x0": 1,
    "w0": START[0], "w1": START[1], "w2": START[2], "n_wrong0": wrong(START, pcells),
    "wrong0_ids": [c["id"] for c in pcells if call(START, c) != c["y"]],
    "sc1": score(START, c1), "c5_k": k5, "c5_cd3": c5["cd3"], "c5_cd19": c5["cd19"], "c5_y": c5["y"], "c5_call": call(START, c5),
    "c5_score": score(START, c5), "c5_small": score(w_small, c5),
    "trick": trick, "eta1": 1, "eta": ETA,
    "wb0": w_big[0], "wb1": w_big[1], "wb2": w_big[2], "n_wrong_big": wrong(w_big, pcells),
    "ws0": w_small[0], "ws1": w_small[1], "ws2": w_small[2], "n_wrong_small": wrong(w_small, pcells),
    "cases": cases,
    "seed": seed, "updates": len(picks), "epochs": ep_of[-1] + 1, "n_frames": len(trace),
    "w0_trace": [t[0] for t in trace], "w1_trace": [t[1] for t in trace], "w2_trace": [t[2] for t in trace],
    "wrong_trace": [wrong(t, pcells) for t in trace], "epoch_trace": [0] + ep_of,
    "next_x": [pcells[k]["cd3"] for k in nxt], "next_y": [pcells[k]["cd19"] for k in nxt],
    "next_id": [pcells[k]["id"] for k in nxt], "next_add": [pcells[k]["y"] for k in nxt], "has_next": [1] * len(picks) + [0],
    "plus_frame": plus_frame, "plus_id": pcells[picks[plus_frame]]["id"],
    "n_adds": sum(pcells[k]["y"] == 1 for k in picks), "n_subs": sum(pcells[k]["y"] == 0 for k in picks),
    "wf0": wf[0], "wf1": wf[1], "wf2": wf[2], "slope": -wf[1] / wf[2], "icept": -wf[0] / wf[2],
    "wg0": wf2[0], "wg1": wf2[1], "wg2": wf2[2], "updates2": len(pk2), "gap1": gap(wf), "gap2": gap(wf2), "graze_id": graze["id"],
    "graze_x": graze["cd3"], "graze_y": graze["cd19"],
    "c9": c9, "c9_cd3": c9["cd3"], "c9_cd19": c9["cd19"], "nine": nine, "epochs9": len(err9), "err9": err9, "min_err9": min(err9), "updates9": len(pk9),
    "thymo": thymo, "n_thymo": len(thymo), "xor_best": xor_best,
}
(HERE / "data.json").write_text(json.dumps(data, indent=1) + "\n")
print(f"start wrong {data['n_wrong0']} {data['wrong0_ids']}; eta=1 -> {w_big} wrong {data['n_wrong_big']}; "
      f"eta={ETA} -> {[round(v, 3) for v in w_small]} wrong {data['n_wrong_small']}")
print(f"run seed {seed}: {len(picks)} updates over {data['epochs']} epochs, adds {data['n_adds']}, picks {[pcells[k]['id'] for k in picks]}, "
      f"plus frame {plus_frame} ({data['plus_id']}); wrong per frame {data['wrong_trace']}")
print(f"final {[round(v, 3) for v in wf]} slope {data['slope']:.3f} icept {data['icept']:.3f} gap {data['gap1']:.3f}; "
      f"from zero {[round(v, 3) for v in wf2]} gap {data['gap2']:.3f}, main grazes {graze['id']}")
print(f"nine cells: min wrong over {len(err9)} epochs {min(err9)}, updates {len(pk9)}; thymocytes best line wrong {xor_best}")
